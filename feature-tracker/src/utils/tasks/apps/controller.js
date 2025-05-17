import appVersionController from "./appVersions/controller.js";

export default async function appController() {
    await appVersionController();
    return "All tasks are running...";
}