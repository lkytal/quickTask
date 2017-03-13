'use strict';
var vscode = require('vscode');
var async = require('async');

var config;
var glob = '**/*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}';
var scriptList = [];
var gulpList = [];
var npmList = [];
var statusBarItem;

var flags = {
	npmScaned: false,
	gulpScaned: false,
	scriptScaned: false
};

var taskWatcher = {
	gulpWatcher: null,
	npmWatcher: null,
	scriptWatcher: null
}

function isNpmScaned() {
	if (!config.enableNpm) {
		flags.npmScaned = true;
	}

	return flags.npmScaned;
}

function isGulpScaned() {
	if (!config.enableGulp) {
		flags.gulpScaned = true;
	}

	return flags.gulpScaned;
}

function isScriptScaned() {
	return flags.scriptScaned;
}

function unique(arr) {
	return Array.from(new Set(arr))
}

function getCmds() {
	return unique(scriptList.concat(gulpList).concat(npmList).concat(config.defaultTasks)).sort();
}

function buildGulpTasks(file) {
	var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
	var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

	if (typeof file === 'object') {
		gulpList = [];

		for (var item of file.getText().match(regexpMatcher)) {
			gulpList.push('gulp ' + item.replace(regexpReplacer, "$1"));
		}
	}
}

function buildNpmTasks(file) {
	if (typeof file === 'object') {
		var pattern = JSON.parse(file.getText());

		if (typeof pattern.scripts === 'object') {
			npmList = [];

			for (var item in pattern.scripts) {
				npmList.push('npm run ' + item);
			}
		}
	}
}

function generateTaskFromScript(file, exec) {
	if (typeof file === 'object') {
		var scriptPath = exec + file.uri._fsPath; //.replace(vscode.workspace.rootPath, '.');
		scriptList.push(scriptPath);
	}
}

function buildScriptsDispatcher(file) {
	if (file.languageId === 'shellscript' && config.enableShell) {
		generateTaskFromScript(file, '');
	}
	else if (file.languageId === 'python' && config.enablePython) {
		generateTaskFromScript(file, 'python ');
	}
	else if (file.languageId === 'ruby' && config.enableRuby) {
		generateTaskFromScript(file, 'ruby ');
	}
	else if (file.languageId === 'powershell' && config.enablePowershell) {
		generateTaskFromScript(file, 'powershell ');
	}
	else if (file.languageId === 'perl' && config.enablePerl) {
		generateTaskFromScript(file, 'perl ');
	}
	else if (file.languageId === 'bat') {
		generateTaskFromScript(file, '');
	}
	else if (/.*\.ahk$/.test(file.fileName) === true) {
		generateTaskFromScript(file, '');
	}
	else if (/.*\.vbs$/.test(file.fileName) === true) {
		generateTaskFromScript(file, 'cscript ');
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

function checkScanFinished() {
	if (isNpmScaned() && isGulpScaned() && isScriptScaned()) {
		if (getCmds().length >= 1) {
			statusBarItem.text = '$(list-unordered) Tasks';
			statusBarItem.tooltip = 'Click to select a Task';
			statusBarItem.command = 'quicktask.showTasks';
		}
		else {
			statusBarItem.text = statusBarItem.tooltip = '$(x) No Task Found';
			statusBarItem.command = 'quicktask.showTasks';
		}
	}
}

function addCommand() {
	return vscode.commands.registerCommand('quicktask.showTasks', function () {
		if (getCmds().length < 1) {
			vscode.window.showInformationMessage("No task found.");
			return;
		}

		var options = {
			placeHolder: 'Select a Task to Run...'
		};

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

var createWatcher = function (files, handler, ignoreChange) {
	var watcher = vscode.workspace.createFileSystemWatcher(files, false, ignoreChange, false);

	watcher.onDidCreate(handler);
	watcher.onDidChange(handler);
	watcher.onDidDelete(handler);

	return watcher;
}

function loadTasks(enableFlag, findSyntex, handleFunc, flagKey) {
	if (!enableFlag) {
		flags[flagKey] = true;
		return;
	}

	flags[flagKey] = false;

	vscode.workspace.findFiles(findSyntex, config.excludesGlob).then(function (foundList) {
 		parseTasksFromFile(foundList, handleFunc, function (err) {
			if (err) {
				vscode.window.showInformationMessage("Error when scanning tasks.");
				return;
			}

			flags[flagKey] = true;
			checkScanFinished();
		});
	});
}

function loadGulpTasks() {
	flags.gulpScaned = false;
	gulpList = [];

	loadTasks(config.enableGulp, config.gulpGlob, buildGulpTasks, "gulpScaned");
}

function loadNpmTasks() {
	flags.npmScaned = false;
	npmList = [];

	loadTasks(config.enableNpm, config.npmGlob, buildNpmTasks, "npmScaned");
}

function loadScripts() {
	flags.scriptScaned = false;
	scriptList = [];

	loadTasks(1, glob, buildScriptsDispatcher, "scriptScaned");
}

function activate(context) {
	config = vscode.workspace.getConfiguration('quicktask');

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	statusBarItem.text = statusBarItem.tooltip = '$(search) Scanning Tasks...';
	statusBarItem.show();

	var showTaskCommand = addCommand();

	taskWatcher.gulpWatcher = createWatcher("**/gulpfile.js", loadGulpTasks, false);
	taskWatcher.npmWatcher = createWatcher("**/package.json", loadNpmTasks, false);
	taskWatcher.scriptWatcher = createWatcher(glob, loadScripts, true);

	loadGulpTasks();
	loadNpmTasks();
	loadScripts();

	context.subscriptions.push(showTaskCommand);
	context.subscriptions.push(statusBarItem);
}

function deactivate() {
	for (var watcher in taskWatcher) {
		if (taskWatcher.hasOwnProperty(watcher) && watcher != null) {
			watcher.dispose();
		}
	}

	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
