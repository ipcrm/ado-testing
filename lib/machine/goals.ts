import {AutoCodeInspection, Autofix, CodeInspection, DefaultGoalNameGenerator, Goal, GoalWithFulfillment} from "@atomist/sdm";
import {AllGoals, GoalCreator} from "@atomist/sdm-core";
import {Build} from "@atomist/sdm-pack-build";

export const MyGoalCreator: GoalCreator<MyGoals> = async () => {
        const goals: MyGoals = {
            autofix: new Autofix(),
            codeInspection: new AutoCodeInspection(),
            triggerBuild: new GoalWithFulfillment({
                displayName: `Trigger Azure DevOps Build`,
                uniqueName: `triggerAdoBuild`,
            }),
            build: new Build(),
            releaseGoal: new GoalWithFulfillment({
                displayName: `Azure DevOps Release`,
                uniqueName: `AdoRelease`,
            }),

        };
        return goals;
};

export interface MyGoals extends AllGoals {
    autofix: Autofix;
    codeInspection: AutoCodeInspection;
    build: Build;
    triggerBuild: GoalWithFulfillment;
    releaseGoal: GoalWithFulfillment;
}
