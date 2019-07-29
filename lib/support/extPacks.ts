import {GoalConfigurer, goalStateSupport} from "@atomist/sdm-core";
import {springSupport} from "@atomist/sdm-pack-spring";
import {MyGoals} from "../machine/goals";

export const ExtPacksConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
    sdm.addExtensionPacks(
        goalStateSupport(),
        springSupport({
            review: {
                springStyle: true,
                cloudNative: true,
            },
            autofix: {
                springStyle: true,
            },
            inspectGoal: goals.codeInspection,
            autofixGoal: goals.autofix,
            reviewListeners: [],
        }),
    );
};
