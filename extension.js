'use strict';

const vscode = require('vscode');
const loaders = require('./loaders.js');
const listManager = require('./listManager.js');
const statusBarController = require('./statusBar.js');

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

		let targetTask = manager.findTask(selection.label, selection.description);

		if (targetTask.isVS) {
			vscode.commands.executeCommand("workbench.action.tasks.runTask", targetTask.cmdLine);
		}
		else {
			let globalConfig = vscode.workspace.getConfiguration('quicktask');
			let terminal = vscode.window.createTerminal(targetTask.cmdLine);
			if (globalConfig.showTerminal) {
				terminal.show();
			}

			if (targetTask.relativePath != null && targetTask.relativePath != "") {
				terminal.sendText('cd ' + targetTask.relativePath);
			}

			terminal.sendText(targetTask.cmdLine);

			if (globalConfig.closeTerminalAfterExecution) {
				terminal.sendText("exit");
			}
		}

		statusBar.showMessage(targetTask);
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

function activate(context) {
	statusBar = new statusBarController(context);
	statusBar.registerCommand('quicktask.showTasks', showCommand);

	setupLoaders(vscode.workspace.getConfiguration('quicktask'), finishScan);

	for (let loader of loaderList) {
		loader.loadTask();
		context.subscriptions.push(loader.setupWatcher());
	}
}

function deactivate() {
	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
