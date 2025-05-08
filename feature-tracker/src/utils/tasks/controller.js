import appController from "./apps/controller.js";

export default async function runAllTasks() {
    await appController(); // Call the app controller function
    return "All tasks are running...";
}