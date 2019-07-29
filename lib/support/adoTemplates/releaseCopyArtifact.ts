import {ReleaseDefinitionEnvironment} from "azure-devops-node-api/interfaces/ReleaseInterfaces";

export const copyArtifact = [
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
