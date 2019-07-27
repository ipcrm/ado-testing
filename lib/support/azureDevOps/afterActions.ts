import {logger} from "@atomist/automation-client";
import {ProjectAction, slackErrorMessage, slackSuccessMessage} from "@atomist/sdm";
import {createAdoBuildPipeline} from "./buildPipeline";
import {AdoCreationParams} from "./generator";
import {createReleaseDefinition} from "./release";

export const createAdoPipelines: ProjectAction<AdoCreationParams> = async (p, papi) => {
    logger.debug(`Begin createAdoBuildPipeline`);
    const project = papi.parameters.project.split(":");
    const target = {
        owner: (papi.parameters as any).target.owner,
        repo: (papi.parameters as any).target.repo,
    };
    const repoSlug = `${target.owner}/${target.repo}`;

    try {
        const newBuildDef = await createAdoBuildPipeline(repoSlug, project[0], project[1]);
        const newReleaseDef = await createReleaseDefinition(
            repoSlug,
            `Release pipeline for ${repoSlug}`,
            newBuildDef,
        );

        await papi.addressChannels(slackSuccessMessage(
            `Created Azure DevOps Pipelines`,
            `Created release pipeline ${newReleaseDef.name} and build pipeline ${newBuildDef.name}`,
        ));
    } catch (e) {
        const msg = `Failed to create Azure DevOps Pipelines, error found ${JSON.stringify(e, undefined, 2)}`
        await papi.addressChannels(slackErrorMessage(
            `Failed to create Azure DevOps Pipelines`,
            msg,
            papi.context,
        ));
    }
};
