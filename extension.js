'use strict';
var vscode = require('vscode');
var async = require('async');

var config;
var jsWatcher;
var scriptWatcher;
var glob = '**/*.{sh,py,rb,ps1,pl,bat}';
var scriptList = [];
var gulpList = [];
var npmList = [];
var _statusBarItem;
var npmScaned = false;
var gulpScaned = false;
var scriptScaned = false;

function isJsScaned() {
	if (!config.enableNpm) {
		npmScaned = true;
	}

	if (!config.enableGulp) {
		gulpScaned = true;
	}

	return npmScaned && gulpScaned;
}

function isScriptScaned() {
	return scriptScaned;
}

function getCmds() {
	return scriptList.concat(gulpList).concat(npmList).sort();
}

function buildGulpTasks(file) {
	var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
	var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

	if (typeof file === 'object') {
		var tmpList = file.getText().match(regexpMatcher);

		for (var i = 0; i < tmpList.length; ++i) {
			gulpList[i] = 'gulp ' + tmpList[i].replace(regexpReplacer, "$1");
		}
	}
}

function buildNpmTasks(file) {
	if (typeof file === 'object') {
		var pattern = JSON.parse(file.getText());

		if (typeof pattern.scripts === 'object') {
			for (var item in pattern.scripts) {
				npmList.push('npm run ' + item);
			}
		}
	}
}

function buildScripts(file, exec) {
	if (typeof file === 'object') {
		var scriptPath = exec + file.uri._fsPath; //.replace(vscode.workspace.rootPath, '.');
		scriptList.push(scriptPath);
	}
}

function buildScriptsDispatcher(file) {
	if (file.languageId === 'shellscript' && config.enableShell) {
		buildScripts(file, '');
	}
	else if (file.languageId === 'python' && config.enablePython) {
		buildScripts(file, 'python ');
	}
	else if (file.languageId === 'ruby' && config.enableRuby) {
		buildScripts(file, 'ruby ');
	}
	else if (file.languageId === 'powershell' && config.enablePowershell) {
		buildScripts(file, 'powershell ');
	}
	else if (file.languageId === 'perl' && config.enablePerl) {
		buildScripts(file, 'perl ');
	}
	else if (file.languageId === 'bat') {
		buildScripts(file, '');
	}
}

function parseTasksFromFile(fileList, handleFunc, onFinish) {
	if (!Array.isArray(fileList)) return;

	if (fileList.length == 0) {
		return onFinish();
	}

	async.each(fileList, function (item, callback) {
		vscode.workspace.openTextDocument(item.fsPath).then(function (file) {
			handleFunc(file);
			return callback();
		});
	}, onFinish);
}

function LoadTask(configKey, findSyntex, handleFunc, onFinish) {
	if (!configKey) return;

	vscode.workspace.findFiles(findSyntex, config.excludesGlob).then(function (foundList) {
		parseTasksFromFile(foundList, handleFunc, onFinish);
	});
}

function loadJsTasks() {
	LoadTask(config.enableGulp, config.gulpGlob, buildGulpTasks, function (err) {
		gulpScaned = true;
		checkScanFinished();
	});
	LoadTask(config.enableNpm, config.npmGlob, buildNpmTasks, function (err) {
		npmScaned = true;
		checkScanFinished();
	});
}

function loadScripts() {
	LoadTask(1, glob, buildScriptsDispatcher, function (err) {
		scriptScaned = true;
		checkScanFinished();
	});
}

function loadAll() {
	loadScripts();
	loadJsTasks();
}

function enableButton() {
	_statusBarItem.text = '$(list-unordered) Tasks';
	_statusBarItem.tooltip = 'Click to select a Task';
	_statusBarItem.command = 'quicktask.showTasks';
}

function checkScanFinished() {
	if (isJsScaned() && isScriptScaned()) {
		if (getCmds().length >= 1) {
			enableButton();
		}
		else {
			_statusBarItem.text = _statusBarItem.tooltip = '$(x) No Task Found';
			_statusBarItem.command = 'quicktask.showTasks';
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
		if (getCmds().length < 1) {
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

function setWatcher() {
	var rebuildJs = function (file) {
		npmScaned = gulpScaned = false;
		npmList = gulpList = [];
		loadJsTasks();
	}

	var rebuildScripts = function (file) {
		scriptScaned = false;
		scriptList = [];
		loadScripts();
	}

	var setupWatcher = function (files, handler) {
		var watcher = vscode.workspace.createFileSystemWatcher(files);

		watcher.onDidChange(handler);
		watcher.onDidCreate(handler);
		watcher.onDidDelete(handler);

		return watcher;
	}

	jsWatcher = setupWatcher("{**/gulpfile.js,**/package.json}", rebuildJs);
	scriptWatcher = setupWatcher(glob, rebuildScripts);
}

function activate(context) {
	config = vscode.workspace.getConfiguration('quicktask');

	buildStatusBar();
	setWatcher();
	loadAll();
}

function deactivate() {
	jsWatcher.dispose();
	scriptWatcher.dispose();
	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
