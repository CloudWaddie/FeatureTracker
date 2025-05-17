import appVersionController from "./appVersions/controller";

export default async function appController() {
    await appVersionController();
    return "All tasks are running...";
}