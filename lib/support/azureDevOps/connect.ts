import * as vm from "azure-devops-node-api";

export const connectToAdo = async (): Promise<vm.WebApi> => {
    // TODO: Move all this to SDM Configuration
    // TODO: Break this into two args one for base URL and one for org
    const orgUrl = "https://dev.azure.com/mcadorette";
    const token: string = process.env.AZURE_PERSONAL_ACCESS_TOKEN;

    // Setup Connection
    const authHandler = vm.getPersonalAccessTokenHandler(token);
    return new vm.WebApi(orgUrl, authHandler);
};
