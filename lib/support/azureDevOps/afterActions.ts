import {configurationValue, logger} from "@atomist/automation-client";
import {ProjectAction, slackErrorMessage, slackInfoMessage, slackSuccessMessage} from "@atomist/sdm";
import * as slack from "@atomist/slack-messages";
import {mavenPipeline} from "../adoTemplates/maven";
import {copyArtifact} from "../adoTemplates/releaseCopyArtifact";
import {createBuildDefinitionUrl} from "./build";
import {createAdoBuildPipeline} from "./buildPipeline";
import {AdoCreationParams} from "./generator";
import {createReleaseDefinition, createReleaseDefinitionUrl} from "./release";

export const createAdoPipelines: ProjectAction<AdoCreationParams> = async (p, papi) => {
    logger.debug(`Begin createAdoBuildPipeline`);
    const project = papi.parameters.project.split(":");
    const target = {
        owner: (papi.parameters as any).target.owner,
        repo: (papi.parameters as any).target.repo,
    };
    const repoSlug = `${target.owner}/${target.repo}`;

    try {
        const newBuildDef = await createAdoBuildPipeline(
            repoSlug,
            project[0],
            project[1],
            mavenPipeline,
            configurationValue("sdm.ado.ghServiceId"),
            "GitHub",
            `https://github.com/${project[0]}/${project[1]}.git`,
        );
        const newReleaseDef = await createReleaseDefinition(
            repoSlug,
            `Release pipeline for ${repoSlug}`,
            newBuildDef,
            copyArtifact,
        );

        const buildUrl = createBuildDefinitionUrl(newBuildDef.project.id, newBuildDef.id);
        const releaseUrl = createReleaseDefinitionUrl(
            newReleaseDef.artifacts[0].definitionReference.project.id,
            newReleaseDef.id,
        );

        await papi.addressChannels(slackSuccessMessage(
            `Created Azure DevOps Pipelines`,
            `Created release pipeline ${slack.url(releaseUrl, newReleaseDef.name)}`
            + ` and build pipeline ${slack.url(buildUrl, newBuildDef.name)}`,
        ));

        await papi.addressChannels(slackInfoMessage(
            `Azure DevOps: Next Steps!`,
            `You need to set the agent pool for your deployment pipeline.  You can navigate to the new pipeline definition `
            + `${slack.url(releaseUrl, "here")}`,
        ));
    } catch (e) {
        const msg = `Failed to create Azure DevOps Pipelines, error found ${JSON.stringify(e, undefined, 2)}`;
        await papi.addressChannels(slackErrorMessage(
            `Failed to create Azure DevOps Pipelines`,
            msg,
            papi.context,
        ));
    }
};
