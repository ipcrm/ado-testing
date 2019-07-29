import {BuildAuthorizationScope, DesignerProcess} from "azure-devops-node-api/interfaces/BuildInterfaces";

// tslint:disable-next-line
export const mavenPipeline = {
    phases: [
        { steps: [
                    { environment: {},
                        enabled: true,
                        continueOnError: true,
                        alwaysRun: true,
                        displayName: "Task group: Maven Build And Upload ",
                        timeoutInMinutes: 0,
                        condition: "succeededOrFailed()",
                        task: {
                            id: "e6529d83-2c22-4b5d-bbc2-5b699986ed6b",
                            versionSpec: "1.*",
                            definitionType: "metaTask",
                        },
                        inputs: {},
                    },
                ],
                name: "Agent job 1",
                refName: "Job_1",
                condition: "succeeded()",
                target: {
                    executionOptions: {
                        type: 0,
                    },
                    allowScriptsAuthAccessOption: false,
                    type: 1,
                } as any,
                jobAuthorizationScope: BuildAuthorizationScope.ProjectCollection,
        },
    ],
    type: 1,
/* Yep, we have to do this. DesignerProcess gets us typing above, but the type on process is BuildProcess which DesignerProcess extends */
} as DesignerProcess as any;
