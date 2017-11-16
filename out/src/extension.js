'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const vscode = require("vscode");
const loaders = require("./loaders");
const listManager = require("./listManager");
const statusBarController = require("./statusBar");
let loaderList = [];
let manager = new listManager(loaderList);
let statusBar;
function finishScan() {
    for (let loader of loaderList) {
        if (!loader.finished) {
            return;
        }
    }
    statusBar.showFinishState(manager.isEmpty());
}
function runTask(selection) {
    let targetTask = manager.findTask(selection.label, selection.description);
    if (targetTask.isVS) {
        vscode.commands.executeCommand("workbench.action.tasks.runTask", targetTask.cmdLine);
        return;
    }
    let globalConfig = vscode.workspace.getConfiguration('quicktask');
    // @ts-ignore
    let terminal = vscode.window.createTerminal(targetTask.cmdLine);
    if (globalConfig.showTerminal) {
        terminal.show();
    }
    let relativePath = targetTask.relativePath;
    if (relativePath != null && relativePath != "") {
        if (os.type() == "Windows_NT") {
            relativePath = relativePath.charAt(0).toUpperCase() + relativePath.slice(1);
            terminal.sendText(relativePath.charAt(0) + ':');
        }
        terminal.sendText(`cd "${relativePath}"`);
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
        vscode.window.showInformationMessage("No task found.", reScan).then(function (text) {
            if (text === reScan) {
                for (let loader of loaderList) {
                    loader.reload();
                }
                statusBar.showScanning();
            }
        });
        return;
    }
    let options = {
        placeHolder: 'Select a Task to Run...',
        matchOnDescription: true
    };
    vscode.window.showQuickPick(manager.getLabelList(), options).then(function (selection) {
        if (typeof selection === 'undefined') {
            return;
        }
        runTask(selection);
    });
}
function setupLoaders(globalConfig, finishScan) {
    let engines = [
        loaders.gulpLoader,
        loaders.npmLoader,
        loaders.vsLoader,
        loaders.scriptLoader,
        loaders.defaultLoader
    ];
    for (let engine of engines) {
        loaderList.push(new engine(globalConfig, finishScan));
    }
}
function activate(context) {
    statusBar = new statusBarController(context);
    statusBar.registerCommand('quicktask.showTasks', showCommand);
    setupLoaders(vscode.workspace.getConfiguration('quicktask'), finishScan);
    for (let loader of loaderList) {
        loader.loadTask();
        context.subscriptions.push(loader.setupWatcher());
    }
    let workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(e => {
        if (e.removed.length == 0) {
            return;
        }
        for (let loader of loaderList) {
            loader.loadTask();
        }
    });
    context.subscriptions.push(workspaceWatcher);
}
exports.activate = activate;
function deactivate() {
    console.log('QuickTask disabled.');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map