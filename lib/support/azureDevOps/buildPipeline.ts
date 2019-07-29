import {configurationValue, logger} from "@atomist/automation-client";
import * as ba from "azure-devops-node-api/BuildApi";
import {
    BuildDefinition,
    DesignerProcess,
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import {connectToAdo} from "./connect";

enum LabelSources {
    SuccessOnly = "6",
    Always = "46",
    Never = "0",
}

export const createAdoBuildPipeline = async (
    repoSlug: string,
    adoProjectName: string,
    adoProjectId: string,
    process: Partial<DesignerProcess>,
    connectedServiceId: string,
    repoType: string,
    repoUrl: string,
    fetchDepth: string = "2",
    defaultBranch: string = "master",
    cleanOptions: string = "0",
) => {
    const connection = await connectToAdo();
    const build: ba.IBuildApi = await connection.getBuildApi();

    // Create an Empty Def object to create the build pipeline
    const newDef: BuildDefinition = {};
    newDef.description = `Build pipeline for ${repoSlug}`;
    newDef.name = repoSlug.replace("/", "-");
    newDef.badgeEnabled = true; /* Should a public badge be available for embedding $places */
    newDef.buildNumberFormat = "$(date:yyyyMMdd)$(rev:.r)";
    // tslint:disable-next-line
    newDef.process = process;
    newDef.queue = { id: 10 };  /* What "queue" -> ie build resource, should this pipeline use */
    newDef.type = 2; /* What type of definition is this, Build or Xaml?  Xaml is deprecated so this should always be 2 */
    newDef.repository = {
        /* From what I've found, properties are undocumented.  You have to set them in the UI and read them back in the API to determine values */
        properties: {
            connectedServiceId,
            fetchDepth, /* 0 is full clone, any positive number is how deep the shallow clone should be */
            defaultBranch,
            /**
             * 0 is "Sources".  Other options exist to delete the working directory on the agent before running the job
             * https://docs.microsoft.com/en-us/azure/devops/pipelines/repos/pipeline-options-for-git? \
             * view=azure-devops#azure-pipelines-tfs-2018-tfs-20172-tfs-20173
             */
            cleanOptions,
            labelSourcesFormat: "$(build.buildNumber)", /* Tag commits */
            labelSources: LabelSources.Always, /* Should ADO tag the commits with the above labelSourcesFormat.  See Enum above for options */
            reportBuildStatus: "true", /* Should the commit be marked as passed/failed based on the job result */
        },
        id: repoSlug,
        type: repoType,
        name: repoSlug,
        url: repoUrl,
        defaultBranch,
        clean: "true",
        checkoutSubmodules: false,
    };
    newDef.project = {id: adoProjectId}; /* TeamProject Reference requires an id, not string */
    logger.debug(`Definition to be created, ${JSON.stringify(newDef)}`);
    try {
        const newBuildDef = await build.createDefinition(newDef, adoProjectName);
        logger.debug(`Successfully created new build definition ${newDef.name}!`);
        return newBuildDef;
    } catch (e) {
        const msg = `Failed to create new build definition ${newDef.name}, error => ${JSON.stringify(e)}`;
        logger.error(msg);
        throw e;
    }

};

/** Other repo properties */
// apiUrl: "https://api.github.com/repos/ipcrmdemo/aac",
// branchesUrl: "https://api.github.com/repos/ipcrmdemo/aac/branches",
// cloneUrl: "https://github.com/ipcrmdemo/aac.git",
// fullName: "ipcrmdemo/aac",
// hasAdminPermissions: "True",
// isFork: "False",
// isPrivate: "False",
// manageUrl: "https://github.com/ipcrmdemo/aac",
// orgName: "ipcrmdemo",
// refsUrl: "https://api.github.com/repos/ipcrmdemo/aac/git/refs",
// safeRepository: "ipcrmdemo/aac",
// shortName: "aac",
// archived: "False",
// ownerIsAUser: "False",
// checkoutNestedSubmodules: "false",
// gitLfsSupport: "false",
// skipSyncSource: "false",
