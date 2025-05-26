import appController from "./apps/controller.js";
import webController from "./web/controller.js";

const controllers = [appController, webController];

export default async function runAllTasks() {
    const results = await Promise.all(controllers.map(controller => controller()));
    return "All tasks are running...";
}