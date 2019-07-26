import {GraphQL, logger, OnEvent} from "@atomist/automation-client";
import {EventHandlerRegistration} from "@atomist/sdm";
import {postWebhook} from "@atomist/sdm-core";
import * as ba from "azure-devops-node-api/BuildApi";
import {BuildResult} from "azure-devops-node-api/interfaces/BuildInterfaces";
import {createBuildUrl} from "../../support/azureDevOps/build";
import {connectToAdo} from "../../support/azureDevOps/connect";
import {GetAdoBuild} from "../../typings/types";

function onAdoBuildHandler():
    OnEvent<GetAdoBuild.Subscription> {
        return async (e, ctx) => {
            logger.info(`ADO Build Event recieved, ${JSON.stringify(e.data.AdoBuild, undefined, 2)}`);
            const thisBuildEvent = e.data.AdoBuild[0];

            const connection = await connectToAdo();
            const build: ba.IBuildApi = await connection.getBuildApi();
            const thisBuild = await build.getBuild(thisBuildEvent.resourceContainers.project.id, thisBuildEvent.resource.id, undefined);
            await updateBuildStatus(
                parseBuildStatus(BuildResult[thisBuild.result]),
                createBuildUrl(thisBuild.project.name, thisBuildEvent.resource.id),
                thisBuild.buildNumber,
                thisBuild.repository.id.split("/")[0],
                thisBuild.repository.id.split("/")[1],
                thisBuild.sourceVersion,
                thisBuild.sourceBranch.split("/").pop(),
                ctx.workspaceId,
            );

            return {
                code: 0,
            };
        };
}

export const onAdoBuild: EventHandlerRegistration<GetAdoBuild.Subscription> = {
    name: "OnAdoBuild",
    subscription: GraphQL.subscription("GetAdoBuild"),
    listener: onAdoBuildHandler(),
};

function parseBuildStatus(status: string): "started" | "failed" | "error" | "passed" | "canceled" {
    if (status === "None") {
        return "failed";
    } else if (status === "PartiallySucceeded") {
        return "failed";
    } else if (status === "Succeeded") {
        return "passed";
    } else if (status === "Failed") {
        return "failed";
    } else if (status === "Canceled") {
        return "canceled";
    }

    // If we got a status we don't understand, mark it failed
    return "failed";
}

function updateBuildStatus(status: "started" | "failed" | "error" | "passed" | "canceled",
                           url: string,
                           buildNo: string,
                           owner: string,
                           name: string,
                           sha: string,
                           branch: string,
                           team: string): Promise<any> {
    const data = {
        repository: {
            owner_name: owner,
            name,
        },
        name: `Build #${buildNo}`,
        number: +buildNo,
        type: "push",
        build_url: url,
        status,
        commit: sha,
        branch,
        provider: "azureDevOps",
        started_at: status === "started" ? new Date().toISOString() : undefined,
        finished_at: status !== "started" ? new Date().toISOString() : undefined,
    };
    return postWebhook("build", data, team);
}
