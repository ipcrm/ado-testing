import {GitCommandGitProject, GitHubRepoRef} from "@atomist/automation-client";
import {Option} from "@atomist/automation-client/lib/metadata/automationMetadata";
import {CommandListenerInvocation, ParametersDefinition} from "@atomist/sdm";
import {GoalConfigurer} from "@atomist/sdm-core";
import * as core from "azure-devops-node-api/CoreApi";
import {TeamProjectReference} from "azure-devops-node-api/interfaces/CoreInterfaces";
import {MyGoals} from "../../machine/goals";
import {createAdoPipelines} from "./afterActions";
import {triggerBuildRegistration} from "./build";
import {connectToAdo} from "./connect";

export interface AdoCreationParams {
    project: string;
}

export const AdoCreationParamsDefinition: ParametersDefinition<AdoCreationParams> = {
    project: {
        description: "Please select a project",
        required: false,
    },
};

export const getAdoProjects = async (): Promise<TeamProjectReference[]> => {
    const connection = await connectToAdo();
    const c: core.ICoreApi = await connection.getCoreApi();
    return c.getProjects();
};

export const adoIntegratedGenerator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
    sdm.addCommand(triggerBuildRegistration);
    sdm.addGeneratorCommand<AdoCreationParams>({
        name: "adoIntegratedGenerator",
        parameters: AdoCreationParamsDefinition,
        startingPoint: async pi => {
            const projectValues: Option[] = [];
            const adoProjects = await getAdoProjects();
            for (const a of adoProjects) {
                projectValues.push({description: a.name, value: `${a.name}:${a.id}`});
            }
            const params = await (pi as any as CommandListenerInvocation<any>)
                .promptFor<{ project: string }>({
                    project: {
                        description: "Please select a project",
                        type: { options: projectValues},
                    },
                });

            pi.parameters.project = params.project;

            return GitCommandGitProject.cloned(
                pi.credentials,
                GitHubRepoRef.from({owner: "atomist-seeds", repo: "dotnet-core-service"}),
                { depth: 1 });
        },
        transform: [],
        intent: "create dotnet",
        afterAction: [
            createAdoPipelines,
        ],
    });

};
