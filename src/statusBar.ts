"use strict";

import * as vscode from "vscode";

class StatusBarController {
	protected statusBarItem;
	protected msgBar;

	constructor(protected context: vscode.ExtensionContext) {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		this.showScanning();

		this.msgBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		this.msgBar.hide();

		context.subscriptions.push(this.statusBarItem);
		context.subscriptions.push(this.msgBar);
	}

	public showScanning() {
		this.statusBarItem.text = "$(search) Scanning Tasks...";
		this.statusBarItem.tooltip = "Scanning Tasks...";
		this.statusBarItem.show();
	}

	public showFinishState(isEmpty: boolean) {
		if (isEmpty) {
			this.statusBarItem.text = "$(x) No Task Found";
			this.statusBarItem.tooltip = "No Task Found Yet.";
			this.statusBarItem.command = "quicktask.showTasks";
		}
		else {
			this.statusBarItem.text = "$(list-unordered) Tasks";
			this.statusBarItem.tooltip = "Click to select a Task";
			this.statusBarItem.command = "quicktask.showTasks";
		}
	}

	public showMessage(task) {
		this.msgBar.text = `$(pulse) Task "${task.cmdLine}" started`;
		this.msgBar.show();

		setTimeout(() => {
			this.msgBar.hide();
		}, 2500);
	}
}

export = StatusBarController;
