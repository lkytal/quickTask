'use strict';
var vscode = require('vscode');
var async = require('async');

var config;
var glob = '**/*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}';
var statusBarItem;

var taskList = {
	scriptList: [],
	gulpList: [],
	npmList: [],
	vsList: []
}

var flags = {
	npmScaned: false,
	gulpScaned: false,
	scriptScaned: false,
	vsScaned: false
};

var taskWatcher = {
	gulpWatcher: null,
	npmWatcher: null,
	scriptWatcher: null,
	vsWatcher: null
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

function isVsScaned() {
	if (!config.enableVsTasks) {
		flags.vsScaned = true;
	}

	return flags.vsScaned;
}

function unique(arr) {
	return Array.from(new Set(arr))
}

function getCmds() {
	var list = [];

	for (var item in taskList) {
		if (taskList.hasOwnProperty(item) && item != null) {
			list = list.concat(taskList[item]);
		}
	}

	return unique(list).sort();
}

const VSCodePrefix = "$(code)  ";
const NormalPrefix = "$(terminal)  ";

function buildGulpTasks(file) {
	var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
	var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

	if (typeof file === 'object') {
		taskList.gulpList = [];

		for (var item of file.getText().match(regexpMatcher)) {
			var cmdLine = 'gulp ' + item.replace(regexpReplacer, "$1");
			var gulpItem = { label: NormalPrefix + cmdLine, cmdLine: cmdLine, isVS: false }
			taskList.gulpList.push(gulpItem);
		}
	}
}

function buildNpmTasks(file) {
	if (typeof file === 'object') {
		var pattern = JSON.parse(file.getText());

		if (typeof pattern.scripts === 'object') {
			taskList.npmList = [];

			for (var item in pattern.scripts) {
				var cmdLine = 'npm run ' + item;
				var npmItem = { label: NormalPrefix + cmdLine, cmdLine: cmdLine, isVS: false }
				taskList.npmList.push(npmItem);
			}
		}
	}
}

function generateTaskFromScript(file, exec) {
	if (typeof file === 'object') {
		var cmdLine = exec + file.uri._fsPath; //.replace(vscode.workspace.rootPath, '.');
		var scriptItem = { label: NormalPrefix + cmdLine, cmd: cmdLine, isVS: false }
		taskList.scriptList.push(scriptItem);
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
	else if (file.languageId === 'bat' && config.enableBatchFile) {
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
	if (isNpmScaned() && isGulpScaned() && isScriptScaned() && isVsScaned()) {
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

			if (result.isVS) {
				vscode.commands.executeCommand("workbench.action.tasks.runTask", result.cmdLine);
			}
			else {
				var terminal = vscode.window.createTerminal();
				if (config.showTerminal) {
					terminal.show();
				}

				if (config.closeTerminalafterExecution) {
					terminal.sendText(result.cmdLine + "\nexit");
				}
				else {
					terminal.sendText(result.cmdLine);
				}
			}

			vscode.window.setStatusBarMessage(`Task ${result.cmdLine} started`, 3000);
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
	taskList.gulpList = [];

	loadTasks(config.enableGulp, config.gulpGlob, buildGulpTasks, "gulpScaned");
}

function loadNpmTasks() {
	flags.npmScaned = false;
	taskList.npmList = [];

	loadTasks(config.enableNpm, config.npmGlob, buildNpmTasks, "npmScaned");
}

function loadScripts() {
	flags.scriptScaned = false;
	taskList.scriptList = [];

	loadTasks(1, glob, buildScriptsDispatcher, "scriptScaned");
}

function loadVsTasks() {
	if (!config.enableVsTasks) {
		flags.vsScaned = true;
		return;
	}

	flags.vsScaned = false;
	taskList.vsList = [];

	vscode.workspace.openTextDocument(vscode.workspace.rootPath + "/.vscode/tasks.json")
		.then(function (file) {
			taskList.vsList = [];
			flags.vsScaned = true;

			try {
				var pattern = JSON.parse(file.getText().replace(new RegExp("//.*", "gi"), ""));

				if (Array.isArray(pattern.tasks)) {
					for (var i = 0; i < pattern.tasks.length; i++) {
						var cmdLine = pattern.tasks[i].taskName;
						var vsItem = {
							label: VSCodePrefix + cmdLine,
							description: "Task from VSCode Task.json",
							cmdLine: cmdLine,
							isVS: true
						}
						taskList.vsList.push(vsItem);
					}
				}
			}
			catch (e) {
				console.log("Invaild tasks.json");
			}
		}, function () {
			taskList.vsList = [];
			flags.vsScaned = true;
		});
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
	taskWatcher.vsWatcher = createWatcher("**/tasks.json", loadVsTasks, false);

	loadGulpTasks();
	loadNpmTasks();
	loadScripts();
	loadVsTasks();

	context.subscriptions.push(showTaskCommand);
	context.subscriptions.push(statusBarItem);
}

function deactivate() {
	for (var watcher in taskWatcher) {
		if (taskWatcher.hasOwnProperty(watcher) && watcher != null) {
			taskWatcher[watcher].dispose();
		}
	}

	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
