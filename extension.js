'use strict';
var vscode = require('vscode');

var config;
var watcher;
var scriptWatcher;
var glob = '**/*.{sh,py,rb,ps1,pl,bat}';
var cmdsList = [];
var _statusBarItem;
var checkCount;

function getCmds() {
	return cmdsList.sort();
}

// Builds gulp tasks array.
function buildGulpCmds(file) {
	var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
	var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

	if (typeof file === 'object') {
		var tmpList = file.getText().match(regexpMatcher);

		for (var i = 0; i < tmpList.length; ++i) {
			cmdsList[i] = 'gulp ' + tmpList[i].replace(regexpReplacer, "$1");
		}
	}
}

// Builds package tasks object.
function buildPackageCmds(file) {
	if (typeof file === 'object') {
		var pattern = JSON.parse(file.getText());

		if (typeof pattern.scripts === 'object') {
			for (var item in pattern.scripts) {
				cmdsList.push('npm run ' + item);
			}
		}
	}
}
// Builds script tasks object.
function buildCmds(file, exec) {
	if (typeof file === 'object') {
		//var scriptPath = file.uri._fsPath.replace(vscode.workspace.rootPath + '/', exec);
		//cmdsList.push(scriptPath);
		cmdsList.push(exec + file.uri._fsPath);
	}
}

function parseTasksFromFile(file, handleFunc) {
	if (Array.isArray(file) && file.length >= 1) {
		for (var i = 0; i < file.length; i++) {
			vscode.workspace.openTextDocument(file[i].fsPath).then(function (file) {
				handleFunc(file);
			});
		}
	}
}

// Read File.
function parseFile(file) {
	parseTasksFromFile(file, function (file) {
		if (file.languageId === 'shellscript' && config.enableShell) {
			buildCmds(file, '. ');
		}
		else if (file.languageId === 'python' && config.enablePython) {
			buildCmds(file, 'python ');
		}
		else if (file.languageId === 'ruby' && config.enableRuby) {
			buildCmds(file, 'ruby ');
		}
		else if (file.languageId === 'powershell' && config.enablePowershell) {
			buildCmds(file, 'powershell ');
		}
		else if (file.languageId === 'perl' && config.enablePerl) {
			buildCmds(file, 'perl ');
		}
		else if (file.languageId === 'bat') {
			buildCmds(file, 'cmd ');
		}
	});
}

function enableButton() {
	_statusBarItem.text = '$(list-unordered) Tasks';
	_statusBarItem.tooltip = 'Select a Task to Run';
	_statusBarItem.command = 'quicktask.showTasks';
}

function enableButtonTimer() {
	if (cmdsList.length >= 1) {
		enableButton();
	}
	else {
		if (checkCount >= 4) {
			_statusBarItem.text = _statusBarItem.tooltip = '$(x) No Task Found';
			_statusBarItem.command = 'quicktask.showTasks';
		}
		else {
			checkCount += 1;
			setTimeout(enableButtonTimer, 5000);
		}
	}
}

function buildStatusBar() {
	_statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	_statusBarItem.text = _statusBarItem.tooltip = '$(search) Scanning Tasks...';
	_statusBarItem.show();

	var options = {
		placeHolder: 'Select a Task to Run...'
	};

	vscode.commands.registerCommand('quicktask.showTasks', function () {
		if (cmdsList.length < 1) {
			vscode.window.showInformationMessage("No task found.");
			return;
		}

		vscode.window.showQuickPick(getCmds(), options).then(function (result) {
			if (typeof result === 'undefined') {
				return;
			}

			var terminal = vscode.window.createTerminal();
			if (config.showTerminal) {
				terminal.show();
			}
			if (config.closeTerminalafterExecution) {
				terminal.sendText(result + "\nexit");
			}
			else {
				terminal.sendText(result);
			}
			vscode.window.setStatusBarMessage(`Task ${result} started`, 3000);
		});
	});
}

var LoadTask = function (configKey, list, handleFunc) {
	if (configKey) {
		vscode.workspace.findFiles(list, config.excludesGlob).then(handleFunc);
	}
}

function loadTaskFiles() {
	LoadTask(config.enableGulp, config.gulpGlob, function (file) {
		parseTasksFromFile(file, buildGulpCmds);
	});
	LoadTask(config.enableNpm, config.npmGlob, function (file) {
		parseTasksFromFile(file, buildPackageCmds);
	});
	LoadTask(1, glob, function (file) {
		parseFile(file);
	});
}

function setWatcher() {
	var rebuildStatusBar = function (file) {
		cmdsList = [];
		loadTaskFiles();

		setTimeout(enableButtonTimer, 2500);
	}

	watcher = vscode.workspace.createFileSystemWatcher("{**/gulpfile.js,**/package.json}");
	scriptWatcher = vscode.workspace.createFileSystemWatcher(glob);

	watcher.onDidChange(rebuildStatusBar);
	watcher.onDidCreate(rebuildStatusBar);
	watcher.onDidDelete(rebuildStatusBar);

	scriptWatcher.onDidChange(rebuildStatusBar);
	scriptWatcher.onDidCreate(rebuildStatusBar);
	scriptWatcher.onDidDelete(rebuildStatusBar);
}

function activate(context) {
	config = vscode.workspace.getConfiguration('quicktask');
	checkCount = 0;

	buildStatusBar();
	loadTaskFiles();
	setWatcher();

	setTimeout(enableButtonTimer, 3000);
}

function deactivate() {
	watcher.dispose();
	scriptWatcher.dispose();
	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
