'use strict';
var vscode = require('vscode');

var watcher;
var scriptWatcher;
var glob = '**/*.{sh,py,rb,ps1,pl,bat}';
var cmdsList = [];
var _statusBarItem;

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
	_statusBarItem.text = '$(clippy) Tasks';
	_statusBarItem.tooltip = 'Select a Task to Run';
	_statusBarItem.command = 'quicktask.showTasks';
}

function activate(context) {
	var config = vscode.workspace.getConfiguration('quicktask');
	var checkCount = 0;

	function buildStatusBar() {
		_statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		_statusBarItem.text = _statusBarItem.tooltip = '$(search) Scanning Tasks...';
		_statusBarItem.show();

		var options = {
			placeHolder: 'Select a Task to Run...'
		};

		vscode.commands.registerCommand('quicktask.showTasks', function () {
			vscode.window.showQuickPick(getCmds(), options).then(function (result) {
				if (typeof result === 'undefined' || cmdsList.length < 1) {
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

	function enableButtonTimer() {
		if (cmdsList.length >= 1) {
			enableButton();
		}
		else {
			if (checkCount >= 5) {
				_statusBarItem.text = _statusBarItem.tooltip = '$(cross) No Task Found';
			}
			else {
				checkCount += 1;
				setTimeout(enableButton, 5000);
			}
		}
	}

	buildStatusBar();
	loadTaskFiles();

	setTimeout(enableButtonTimer, 3000);

	var rebuildStatusBar = function (file) {
		cmdsList = [];
		loadTaskFiles();

		setTimeout(enableButtonTimer, 4000);
		//vscode.window.showInformationMessage("change applied!");
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

function deactivate() {
	watcher.dispose();
	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
