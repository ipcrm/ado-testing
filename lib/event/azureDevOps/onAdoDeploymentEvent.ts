import {GitHubRepoRef, GraphQL, logger, OnEvent, Success} from "@atomist/automation-client";
import {EventHandlerRegistration, findSdmGoalOnCommit, Goal, SdmGoalState, updateGoal} from "@atomist/sdm";
import {DeploymentStatus} from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import {IReleaseApi} from "azure-devops-node-api/ReleaseApi";
import * as _ from "lodash";
import {connectToAdo} from "../../support/azureDevOps/connect";
import {createReleaseUrl} from "../../support/azureDevOps/release";
import {FindAdoReleaseGoal, OnAdoDeploymentEvent} from "../../typings/types";

function onAdoDeploymentEventHandler(goal: Goal):
    OnEvent<OnAdoDeploymentEvent.Subscription> {
    return async (e, ctx) => {
        logger.debug(`New ADO Deployment Event: ${JSON.stringify(e.data.AdoReleaseDeploymentEvent[0], undefined, 2)}`);

        const eventType = determineEventType(e.data.AdoReleaseDeploymentEvent[0].eventType)
        logger.debug(`Event type is ${eventType}`);

        const projectId = e.data.AdoReleaseDeploymentEvent[0].resource.project.id;
        let releaseId: number;
        if (eventType < 2) {
            releaseId = e.data.AdoReleaseDeploymentEvent[0].resource.approval.release.id;
        } else {
            releaseId = e.data.AdoReleaseDeploymentEvent[0].resource.environment.release.id;
        }

        const connection = await connectToAdo();
        const releaseApiObject: IReleaseApi = await connection.getReleaseApi();
        const thisRelease = await releaseApiObject.getRelease(
            projectId,
            releaseId,
        );

        const thisDeployment = await releaseApiObject.getDeployments(
            projectId,
            thisRelease.releaseDefinition.id,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            true,
        );

        const deployStatus = DeploymentStatus[thisDeployment[0].deploymentStatus];
        const repoBase = thisRelease.artifacts[0].definitionReference.repository.id;
        const owner = repoBase.split("/")[0];
        const repo = repoBase.split("/")[1];
        const sha = thisRelease.artifacts[0].definitionReference.sourceVersion.id;

        // Check if this status is "Not Deployed", set to pending b/c "Not Deployed" makes no sense
        const status = thisDeployment[0].deploymentStatus === 1 ? "Pending" : deployStatus;
        const url = createReleaseUrl(projectId, releaseId);
        logger.debug(`Details:` + JSON.stringify({
            owner,
            repo,
            sha,
            status,
            url,
        }, undefined, 2))

        const result = await ctx.graphClient.query<FindAdoReleaseGoal.Query, FindAdoReleaseGoal.Variables>({
            name: "FindAdoReleaseGoal",
            variables: {
                name: "AdoRelease",
                sha,
            },
        });
        const thisGoal = result.SdmGoal[0];
        const repoRef = GitHubRepoRef.from({
            owner: thisGoal.push.after.repo.owner,
            repo:  thisGoal.push.after.repo.name,
            sha,
            branch: thisGoal.push.branch,
        });
        const realGoal = await findSdmGoalOnCommit(ctx, repoRef, thisGoal.push.repo.org.scmProvider.providerId, goal);

        let newGoalStatus: SdmGoalState;
        let newGoalDescription: string;
        if (thisDeployment[0].deploymentStatus === 16) {
            newGoalStatus = SdmGoalState.failure;
            newGoalDescription = goal.failureDescription;
        } else if (thisDeployment[0].deploymentStatus === 4 || thisDeployment[0].deploymentStatus === 8) {
           newGoalStatus = SdmGoalState.success;
           newGoalDescription = goal.successDescription;
        } else {
            newGoalStatus = SdmGoalState.in_process;
            newGoalDescription = goal.inProcessDescription;
        }

        await updateGoal(ctx, realGoal, {
            state: newGoalStatus,
            description: newGoalDescription,
            externalUrls: [
                {label: status, url},
            ],
        });
        return Success;
    };
}
enum AdoDeploymentEventTypes {
    "ms.vss-release.deployment-approval-pending-event" = 0,
    "ms.vss-release.deployment-approval-completed-event" = 1,
    "ms.vss-release.deployment-started-event" = 2,
    "ms.vss-release.deployment-completed-event" = 3,
}

function determineEventType(event: string): AdoDeploymentEventTypes {
    return _.get(AdoDeploymentEventTypes, event);
}

export const onAdoDeploymentEvent = (goal: Goal): EventHandlerRegistration<OnAdoDeploymentEvent.Subscription> => {
    return {
        name: "OnAdoDeploymentEvent",
        subscription: GraphQL.subscription("onAdoDeploymentEvent"),
        listener: onAdoDeploymentEventHandler(goal),
    };
};
