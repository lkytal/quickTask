"use strict";

const vscode = require('vscode');

class statusBarController {
	constructor(context) {
		this.context = context;

		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		this.statusBarItem.text = '$(search) Scanning Tasks...';
		this.statusBarItem.tooltip = 'Scanning Tasks...';
		this.statusBarItem.show();

		context.subscriptions.push(this.statusBarItem);
	}

	registerCommand(command, callBack) {
		let showTaskCommand = vscode.commands.registerCommand(command, callBack);
		this.context.subscriptions.push(showTaskCommand);
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
		this.statusBarItem.text = "$(pulse) " + `Task ${task.cmdLine} started`;
		setTimeout(() => {
			this.showFinishState(false);
		}, 2500);
	}
}

module.exports = statusBarController;
