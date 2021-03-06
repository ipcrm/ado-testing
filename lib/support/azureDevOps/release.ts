import {configurationValue, GraphQL, HttpClientFactory, HttpMethod, logger} from "@atomist/automation-client";
import {Fulfillment} from "@atomist/sdm";
import {GoalConfigurer} from "@atomist/sdm-core";
import {BuildDefinition} from "azure-devops-node-api/interfaces/BuildInterfaces";
import {
    ReleaseDefinition,
    ReleaseDefinitionEnvironment,
} from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import {IReleaseApi} from "azure-devops-node-api/ReleaseApi";
import * as request from "request-promise-native";
import {onAdoDeploymentEvent} from "../../event/azureDevOps/onAdoDeploymentEvent";
import {MyGoals} from "../../machine/goals";
import {SdmGoalState} from "../../typings/types";
import {AdoDefinitionInfo} from "./afterActions";
import {connectToAdo} from "./connect";

export const getReleasePlans = async (adoProject: string): Promise<ReleaseDefinition> => {
    const connection = await connectToAdo();
    const releaseApiObject: IReleaseApi = await connection.getReleaseApi();
    return releaseApiObject.getReleaseDefinition(adoProject, 5);
};

export const createReleaseDefinition = async (
    name: string,
    description: string,
    buildDefinition: BuildDefinition,
    environments: ReleaseDefinitionEnvironment[],
): Promise<ReleaseDefinition> => {
    logger.debug(`Starting createReleasePlan`);
    const connection = await connectToAdo();
    const releaseApiObject: IReleaseApi = await connection.getReleaseApi();

    const newDef: ReleaseDefinition = {};
    newDef.name = name;
    newDef.description = description;

    /** Environments === Stages */
    newDef.environments = environments;
    newDef.artifacts = [
        {
            sourceId: `${buildDefinition.project.id}:${buildDefinition.id}`,
            type: "Build",
            alias: `_${buildDefinition.project.name}-${buildDefinition.name}`,
            definitionReference: {
                definition: {
                    id: buildDefinition.id.toString(),
                },
                project: {
                    id: buildDefinition.project.id,
                },
            },
        },
    ];
    newDef.triggers = [
        {
            triggerType: "artifactSource",
            artifactAlias: `_${buildDefinition.project.name}-${buildDefinition.name}`,
        } as any,
    ];
    newDef.releaseNameFormat = "Release-$(rev:r)";
    logger.debug(`Start create new release....`);
    const release = await releaseApiObject.createReleaseDefinition(newDef, "testproject");
    logger.debug(`Created new release, ${JSON.stringify(release, undefined, 2)}`);

    return release;
};

export const adoIntegratedRelease: GoalConfigurer<MyGoals> = async (sdm, goals) => {
    sdm.addCommand({
        name: "getReleases",
        intent: "get releases",
        listener: async () => {
            logger.debug(JSON.stringify(await getReleasePlans("testproject"), undefined, 2));
        },
    });
    sdm.addIngester(GraphQL.ingester({ name: "AdoReleaseDeploymentEvent" }));
    sdm.addEvent(onAdoDeploymentEvent(goals.releaseGoal));
    goals.releaseGoal.with(AdoReleaseFulfillment);
};

const AdoReleaseFulfillment: Fulfillment = {
    name: "adoReleaseGoalfulfilment",
    goalExecutor: async gi => {
        const connection = await connectToAdo();
        const releaseApiObject: IReleaseApi = await connection.getReleaseApi();
        const adoInfo: AdoDefinitionInfo = JSON.parse(
            await gi.preferences.get(`ado/${gi.goalEvent.repo.owner}/${gi.goalEvent.repo.name}/definitions`));
        const releases = await releaseApiObject.getReleases(adoInfo.projectId, adoInfo.releaseId);
        const thisRelease = await releaseApiObject.getRelease(adoInfo.projectId, releases[0].id);

        for (const e of thisRelease.environments.map(env => env.id)) {
            // tslint:disable-next-line
            const patchUrl = `https://vsrm.dev.azure.com/${configurationValue("sdm.ado.org")}/${adoInfo.projectName}/_apis/Release/releases/${thisRelease.id}/environments/${e}?api-version=5.0-preview`;
            await request.patch(patchUrl,
                {
                    body: {
                        status: "inProgress",
                        scheduledDeploymentTime: "null",
                        comment: "null",
                    },
                    json: true,
                    headers: {
                        Authorization: "Basic " + Buffer.from("PAT:" + configurationValue("sdm.ado.token")).toString("base64"),
                        Accept: "application/json",
                    },
            });
        }

        return {
            state: SdmGoalState.in_process,
            description: "Azure DevOps Deployment",
            externalUrls: [
                { label: thisRelease.name, url: createReleaseUrl(adoInfo.projectId, thisRelease.id)},
            ],
        };
    },
};

export function createReleaseUrl(project: string, releaseId: number): string {
    const org = `${configurationValue("sdm.ado.baseUrl")}/${configurationValue("sdm.ado.org")}`;
    return `${org}/${project}/_releaseProgress?_a=release-pipeline-progress&releaseId=${releaseId}`;
}
export function createReleaseDefinitionUrl(project: string, defId: number): string {
    const org = `${configurationValue("sdm.ado.baseUrl")}/${configurationValue("sdm.ado.org")}`;
    return `${org}/${project}/_releaseDefinition?definitionId=${defId}&_a=environments-editor-preview`;
}
