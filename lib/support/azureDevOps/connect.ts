import {configurationValue} from "@atomist/automation-client";
import * as vm from "azure-devops-node-api";

export const connectToAdo = async (): Promise<vm.WebApi> => {
    const orgUrl = `${configurationValue("sdm.ado.baseUrl")}/${configurationValue("sdm.ado.org")}`;
    const token: string = configurationValue("sdm.ado.token");

    // Setup Connection
    const authHandler = vm.getPersonalAccessTokenHandler(token);
    return new vm.WebApi(orgUrl, authHandler);
};
