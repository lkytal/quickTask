"use strict";
const vscode = require("vscode");
class statusBarController {
    constructor(context) {
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.showScanning();
        this.msgBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.msgBar.hide();
        context.subscriptions.push(this.statusBarItem);
        context.subscriptions.push(this.msgBar);
    }
    registerCommand(command, callBack) {
        let showTaskCommand = vscode.commands.registerCommand(command, callBack);
        this.context.subscriptions.push(showTaskCommand);
    }
    showScanning() {
        this.statusBarItem.text = '$(search) Scanning Tasks...';
        this.statusBarItem.tooltip = 'Scanning Tasks...';
        this.statusBarItem.show();
    }
    showFinishState(isEmpty) {
        if (isEmpty) {
            this.statusBarItem.text = '$(x) No Task Found';
            this.statusBarItem.tooltip = 'No Task Found Yet.';
            this.statusBarItem.command = 'quicktask.showTasks';
        }
        else {
            this.statusBarItem.text = '$(list-unordered) Tasks';
            this.statusBarItem.tooltip = 'Click to select a Task';
            this.statusBarItem.command = 'quicktask.showTasks';
        }
    }
    showMessage(task) {
        this.msgBar.text = `$(pulse) Task "${task.cmdLine}" started`;
        this.msgBar.show();
        setTimeout(() => {
            this.msgBar.hide();
        }, 2500);
    }
}
module.exports = statusBarController;
//# sourceMappingURL=statusBar.js.map