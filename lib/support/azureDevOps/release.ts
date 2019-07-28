import {GraphQL, logger} from "@atomist/automation-client";
import {Fulfillment, GoalWithFulfillment, IndependentOfEnvironment} from "@atomist/sdm";
import {GoalConfigurer} from "@atomist/sdm-core";
import {BuildDefinition} from "azure-devops-node-api/interfaces/BuildInterfaces";
import {ReleaseDefinition, ReleaseDefinitionEnvironment} from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import {IReleaseApi} from "azure-devops-node-api/ReleaseApi";
import {onAdoDeploymentEvent} from "../../event/azureDevOps/onAdoDeploymentEvent";
import {MyGoals} from "../../machine/goals";
import {SdmGoalState} from "../../typings/types";
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
): Promise<ReleaseDefinition> => {
    logger.debug(`Starting createReleasePlan`);
    const connection = await connectToAdo();
    const releaseApiObject: IReleaseApi = await connection.getReleaseApi();

    const newDef: ReleaseDefinition = {};
    newDef.name = name;
    newDef.description = description;

    /** Environments === Stages */
    newDef.environments = [
        // tslint:disable-next-line
        {
            name: "Copy Artifact",
            retentionPolicy: {
                daysToKeep: 30,
                releasesToKeep: 3,
                retainBuild: true,
            },
            preDeployApprovals: {
                approvals: [
                    {
                        rank: 1,
                        isAutomated: true,
                        isNotificationOn: false,
                    },
                ],
            },
            postDeployApprovals: {
                approvals: [
                    {
                        rank: 1,
                        isAutomated: true,
                        isNotificationOn: false,
                    },
                ],
            },
            deployPhases: [
                {
                    name: "Agent Job",
                    phaseType: 1,
                    rank: 1,
                    workflowTasks: [
                        {
                            taskId: "5bfb729a-a7c8-4a78-a7c3-8d717bb7c13c",
                            version: "2.*",
                            condition: "succeeded()",
                            enabled: true,
                            inputs: {
                                SourceFolder: "",
                                Contents: "**",
                                TargetFolder: "/azure/test",
                                CleanTargetFolder: "false",
                                Overwrite: "false",
                                preserveTimeStamp: "false",
                            },
                        },
                    ],
                },
            ],
        } as ReleaseDefinitionEnvironment as any,
    ];

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
        return {
            state: SdmGoalState.in_process,
            description: "Planned: Azure DevOps Deployment",
        };
    },
};

export function createReleaseUrl(project: string, releaseId: number): string {
    // TODO: Move this to config
    const org = `https://dev.azure.com/mcadorette`;
    return `${org}/${project}/_releaseProgress?_a=release-pipeline-progress&releaseId=${releaseId}`;
}
export function createReleaseDefinitionUrl(project: string, defId: number): string {
    // TODO: Move this to config
    const org = `https://dev.azure.com/mcadorette`;
    return `${org}/${project}/_releaseDefinition?definitionId=${defId}&_a=environments-editor-preview`;
}

