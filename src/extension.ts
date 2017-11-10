'use strict';

import os = require('os');
import * as vscode from 'vscode';
import * as loaders from './loaders';
import listManager = require('./listManager');
import statusBarController = require('./statusBar');

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

	if (targetTask.relativePath != null && targetTask.relativePath != "") {
		let cd = 'cd "';
		if (os.type() == "Windows_NT") {
			cd = 'cd /d "'
		}
		terminal.sendText(cd + targetTask.relativePath + '"');
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

	vscode.window.showQuickPick(manager.getList(), options).then(function (selection) {
		if (typeof selection === 'undefined') {
			return;
		}

		runTask(selection);
	});
}

function setupLoaders(globalConfig, finishScan) {
	let usedLoaders = [
		loaders.gulpLoader,
		loaders.npmLoader,
		loaders.vsLoader,
		loaders.scriptLoader,
		loaders.defaultLoader
	];

	for (let loaderEngine of usedLoaders) {
		loaderList.push(new loaderEngine(globalConfig, finishScan));
	}
}

export function activate(context) {
	statusBar = new statusBarController(context);
	statusBar.registerCommand('quicktask.showTasks', showCommand);

	setupLoaders(vscode.workspace.getConfiguration('quicktask'), finishScan);

	for (let loader of loaderList) {
		loader.loadTask();
		context.subscriptions.push(loader.setupWatcher());
	}
}

export function deactivate() {
	console.log('QuickTask disabled.');
}
