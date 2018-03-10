"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const ListManager = require("./listManager");
const loaders = require("./loaders");
const StatusBarController = require("./statusBar");
let loaderList = [];
let manager;
let statusBar;
function finishScan() {
    for (const loader of loaderList) {
        if (!loader.finished) {
            return;
        }
    }
    statusBar.showFinishState(manager.isEmpty());
}
function requestRescan() {
    statusBar.showScanning();
    for (const loader of loaderList) {
        loader.reload();
    }
}
function runTask(selection) {
    const targetTask = manager.findTask(selection.label, selection.description);
    if (targetTask.type === "vs") {
        vscode.commands.executeCommand("workbench.action.tasks.runTask", targetTask.cmdLine);
        return;
    }
    const globalConfig = vscode.workspace.getConfiguration("quicktask");
    const terminal = vscode.window.createTerminal(targetTask.cmdLine);
    if (globalConfig.showTerminal) {
        terminal.show();
    }
    let dirPath = targetTask.filePath ? path.dirname(targetTask.filePath) : null;
    if (dirPath != null && dirPath !== "") {
        if (os.type() === "Windows_NT") {
            dirPath = dirPath.charAt(0).toUpperCase() + dirPath.slice(1);
            terminal.sendText(dirPath.charAt(0) + ":");
        }
        terminal.sendText(`cd "${dirPath}"`);
    }
    terminal.sendText(targetTask.cmdLine);
    if (globalConfig.closeTerminalAfterExecution) {
        terminal.sendText("exit");
    }
    statusBar.showMessage(targetTask);
}
function showCommand() {
    if (manager.isEmpty()) {
        const reScan = "Rescan Tasks";
        vscode.window.showInformationMessage("No task found.", reScan).then((text) => {
            if (text === reScan) {
                requestRescan();
            }
        });
        return;
    }
    const options = {
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: "Select a Task to Run..."
    };
    vscode.window.showQuickPick(manager.getLabelList(), options).then((selection) => {
        if (typeof selection === "undefined") {
            return;
        }
        runTask(selection);
    });
}
function setupLoaders(globalConfig, finishCallback) {
    const engines = [
        loaders.GulpLoader,
        loaders.NpmLoader,
        loaders.VSLoader,
        loaders.ScriptLoader,
        loaders.DefaultLoader
    ];
    loaderList = [];
    for (const engine of engines) {
        loaderList.push(new engine(globalConfig, finishCallback));
    }
    manager = new ListManager(loaderList);
}
function registerCommand(context, command, callBack) {
    const commandObject = vscode.commands.registerCommand(command, callBack);
    context.subscriptions.push(commandObject);
}
function activate(context) {
    registerCommand(context, "quicktask.showTasks", showCommand);
    registerCommand(context, "quicktask.rescanTasks", requestRescan);
    statusBar = new StatusBarController(context);
    setupLoaders(vscode.workspace.getConfiguration("quicktask"), finishScan);
    for (const loader of loaderList) {
        loader.loadTask();
        context.subscriptions.push(loader.setupWatcher());
    }
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders((e) => {
        if (e.removed.length !== 0) {
            requestRescan();
        }
    });
    context.subscriptions.push(workspaceWatcher);
}
exports.activate = activate;
function deactivate() {
    console.log("QuickTask disabled.");
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map