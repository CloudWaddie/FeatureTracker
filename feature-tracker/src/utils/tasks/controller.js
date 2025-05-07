import appController from "./apps/controller.js";

export default function runAllTasks() {
    appController(); // Call the app controller function
    return "All tasks are running...";
}