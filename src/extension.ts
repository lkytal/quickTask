"use strict";

import os = require("os");
import * as path from "path";
import * as vscode from "vscode";
import ListManager = require("./listManager");
import * as loaders from "./loaders";
import StatusBarController = require("./statusBar");

let loaderList = [];
let manager;
let statusBar;
let lastTask;

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

	let dirPath: string = targetTask.filePath ? path.dirname(targetTask.filePath) : null;
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

		lastTask = selection
		runTask(selection);
	});
}

function runLastTask() {
	if (lastTask) {
		runTask(lastTask);
	}
	else {
		showCommand()
	}
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

export function activate(context: vscode.ExtensionContext) {
	registerCommand(context, "quicktask.showTasks", showCommand);
	registerCommand(context, "quicktask.runLastTask", runLastTask);
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

export function deactivate() {
	console.log("QuickTask disabled.");
}
