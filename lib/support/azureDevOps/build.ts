import {logger} from "@atomist/automation-client";
import {CommandHandlerRegistration, ExecuteGoal, ParametersDefinition, slackErrorMessage} from "@atomist/sdm";
import {GoalConfigurer} from "@atomist/sdm-core";
import * as ba from "azure-devops-node-api/BuildApi";
import {Build, BuildDefinitionReference} from "azure-devops-node-api/interfaces/BuildInterfaces";
import * as _ from "lodash";
import {MyGoals} from "../../machine/goals";
import {connectToAdo} from "./connect";
import {getAdoProjects} from "./generator";

interface TriggerBuildI {
    owner: string;
    repo: string;
    adoProject: string;
}

const triggerBuildDef: ParametersDefinition<TriggerBuildI> = {
    owner: {
        description: "Enter the owner of the repo",
    },
    repo: {
        description: "Enter the repo name",
    },
    adoProject: {
        description: "Enter the ADO project name",
    },
};

export const getBuildDefinitionForRepo = async (adoProject: string, owner: string, repo: string): Promise<BuildDefinitionReference> => {
    const connection = await connectToAdo();
    const build: ba.IBuildApi = await connection.getBuildApi();
    const defs = await build.getDefinitions(adoProject);
    const def = defs.filter(d => d.name === `${owner}-${repo}`)[0];
    return def ? def : undefined;
};

const triggerBuild = async (owner: string, repo: string, adoProject: string): Promise<Build> => {
    const connection = await connectToAdo();
    const build: ba.IBuildApi = await connection.getBuildApi();

    const def = await getBuildDefinitionForRepo(adoProject, owner, repo);
    logger.debug(`Found the following build def => ${JSON.stringify(def, undefined, 2)}`);
    return build.queueBuild({definition: def}, adoProject);
};

export function createBuildUrl(project: string, buildId: number): string {
    // TODO: Move this to config
    const org = `https://dev.azure.com/mcadorette`;
    return `${org}/${project}/_build/results?buildId=${buildId}`;
}

export const triggerBuildRegistration: CommandHandlerRegistration<TriggerBuildI> = {
    name: "triggerAdoBuild",
    parameters: triggerBuildDef,
    intent: "run ado build",
    listener: async ctx => {
        try {
            const build = await triggerBuild(
                ctx.parameters.owner,
                ctx.parameters.repo,
                ctx.parameters.adoProject,
            );
            await ctx.addressChannels(
                `Started build ${build.buildNumber}, <${createBuildUrl(ctx.parameters.adoProject, build.id)}|here>`);
        } catch (e) {
            const msg = `Failed to start build, error => ${JSON.stringify(_.get(e, "result.message"), undefined, 2)}`;
            logger.error(msg);
            await ctx.addressChannels(slackErrorMessage(
                `Failed to start Azure DevOps Build`,
                msg,
                ctx.context,
            ));
        }
    },
};

export const triggerBuildGoal: ExecuteGoal = async gi => {
    // Get All Projects
    const projects = await getAdoProjects();

    // Get All Builds in All Projects
    let def: BuildDefinitionReference;
    for (const p of projects) {
        const thisDef = await getBuildDefinitionForRepo(p.name, gi.goalEvent.repo.owner, gi.goalEvent.repo.name);
        if (thisDef) {
            def = thisDef;
            break;
        }
    }

    if (def) {
        // Trigger build with our new knowledge
        const build = await triggerBuild(
            gi.goalEvent.repo.owner,
            gi.goalEvent.repo.name,
            def.project.name,
        );
        return {
            description: gi.goal.definition.displayName,
            externalUrls: [{ label: `Started ${build.buildNumber}`, url: createBuildUrl(def.project.name, build.id)}],
        };

    } else {
        return {
            code: 1,
            message: `Cannot find a build pipeline to trigger`,
        };
    }
};

export const adoIntegratedBuilds: GoalConfigurer<MyGoals> = async (sdm, goals) => {
    goals.triggerBuild.with({
        name: "triggerAdoBuild",
        goalExecutor: triggerBuildGoal,
    });
    goals.build.with({
        externalTool: "azureDevOps",
    });
};
