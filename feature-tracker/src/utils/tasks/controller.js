import appController from "./apps/controller.js";
import webController from "./web/controller.js";

export default async function runAllTasks() {
    await appController(); // Call the app controller function
    await webController(); // Call the web controller function
    return "All tasks are running...";
}