/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {Configuration, logger} from "@atomist/automation-client";
import {configure} from "@atomist/sdm-core";
import {MyGoalCreator, MyGoals} from "./lib/machine/goals";
import {adoIntegratedBuilds} from "./lib/support/azureDevOps/build";
import {adoIntegratedGenerator} from "./lib/support/azureDevOps/generator";
import {adoIntegratedRelease} from "./lib/support/azureDevOps/release";
import {ExtPacksConfigurator} from "./lib/support/extPacks";

export const configuration: Configuration = configure<MyGoals>(async sdm => {
    const setGoals = await sdm.createGoals(MyGoalCreator, [
        adoIntegratedGenerator,
        adoIntegratedBuilds,
        adoIntegratedRelease,
        ExtPacksConfigurator,
    ]);

    return {
        /**
         * GoalSet Definitions
         */
        check: {
            goals: [
                setGoals.autofix,
                setGoals.codeInspection,
            ],
        },
        build: {
            goals: [
                [setGoals.triggerBuild, setGoals.build],
            ],
            dependsOn: "check",
        },
        release: {
            goals: [
                setGoals.releaseGoal,
            ],
            dependsOn: "build",
        },
    };
}, {
    requiredConfigurationValues: [],
    postProcessors: [
    ],
});
