'use strict';

const vscode = require('vscode');

const loaders = require('./loaders.js');

let globalConfig;

let data = {
	statusBarItem: null,
	loaderList: [],
	prefix: {
		vs: "$(code)  ",
		gulp: "$(browser)  ",
		npm: "$(package)  ",
		script: "$(terminal)  ",
		user: "$(tag)  "
	}
}

function getCmd() {
	var list = [];

	for (let item of globalConfig.defaultTasks) {
		list.push(loaders.generateItem(item, "user"));
	}

	for (let loader of data.loaderList) {
		list = list.concat(loader.taskList);
	}

	function unique(arr) {
		return Array.from(new Set(arr));
	}

	return unique(list).sort(function (a, b) {
		return a.label.localeCompare(b.label);
	});
}

function checkScanFinished() {
	for (let loader of data.loaderList) {
		if (!loader.finished) {
			return false;
		}
	}

	return true;
}

function finishScan() {
	if (checkScanFinished()) {
		if (getCmd().length >= 1) {
			data.statusBarItem.text = '$(list-unordered) Tasks';
			data.statusBarItem.tooltip = 'Click to select a Task';
			data.statusBarItem.command = 'quicktask.showTasks';
		}
		else {
			data.statusBarItem.text = '$(x) No Task Found';
			data.statusBarItem.tooltip = 'No Task Found Yet.';
			data.statusBarItem.command = 'quicktask.showTasks';
		}
	}
}

function showCommand() {
	let taskArray = getCmd();

	if (taskArray.length < 1) {
		vscode.window.showInformationMessage("No task found.");
		return;
	}

	let options = {
		placeHolder: 'Select a Task to Run...'
	};

	vscode.window.showQuickPick(taskArray, options).then(function (result) {
		if (typeof result === 'undefined') {
			return;
		}

		if (result.isVS) {
			vscode.commands.executeCommand("workbench.action.tasks.runTask", result.cmdLine);
		}
		else {
			var terminal = vscode.window.createTerminal();
			if (globalConfig.showTerminal) {
				terminal.show();
			}

			if (globalConfig.closeTerminalafterExecution) {
				terminal.sendText(result.cmdLine);
				terminal.sendText("exit");
			}
			else {
				terminal.sendText(result.cmdLine);
			}
		}

		vscode.window.setStatusBarMessage(`Task ${result.cmdLine} started`, 3000);
	});
}

function setupLoader(globalConfig) {
	loaders.setupPrefix(data.prefix);

	data.loaderList.push(new loaders.gulpLoader(globalConfig, finishScan));
	data.loaderList.push(new loaders.npmLoader(globalConfig, finishScan));
	data.loaderList.push(new loaders.vsLoader(globalConfig, finishScan));
	data.loaderList.push(new loaders.scriptLoader(globalConfig, finishScan));
}

function activate(context) {
	data.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	data.statusBarItem.text = '$(search) Scanning Tasks...';
	data.statusBarItem.tooltip = 'Scanning Tasks...';
	data.statusBarItem.show();
	context.subscriptions.push(data.statusBarItem);

	let showTaskCommand = vscode.commands.registerCommand('quicktask.showTasks', showCommand);
	context.subscriptions.push(showTaskCommand);

	globalConfig = vscode.workspace.getConfiguration('quicktask');

	setupLoader(globalConfig);

	for (let loader of data.loaderList) {
		loader.loadTask();
		context.subscriptions.push(loader.setupWatcher());
	}
}

function deactivate() {
	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
