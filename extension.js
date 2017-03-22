'use strict';

var path = require("path");
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

	for (let item of config.defaultTasks) {
		list.push(generateItem(item, "user"));
	}

	for (let item in taskList) {
		if (taskList.hasOwnProperty(item) && item != null) {
			list = list.concat(taskList[item]);
		}
	}

	return unique(list).sort();
}

const prefix = {
	vs: "$(code)  ",
	gulp: "$(browser)  ",
	npm: "$(package)  ",
	script: "$(terminal)  ",
	user: "$(tag)  "
}

function generateItem(cmdLine, type) {
	switch (type) {
		case "npm":
		case "gulp":
		case "script":
			return {
				label: prefix[type] + cmdLine,
				cmdLine: cmdLine,
				isVS: false
			};

		case "vs":
			return {
				label: prefix.vs + cmdLine,
				cmdLine: cmdLine,
				description: "Task from VS Code Task.json",
				isVS: true
			};

		case "user":
			return {
				label: prefix.user + cmdLine,
				cmdLine: cmdLine,
				description: "User defined tasks",
				isVS: false
			};
	}
}

function buildGulpTasks(file) {
	var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
	var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

	if (typeof file === 'object') {
		taskList.gulpList = [];

		for (let item of file.getText().match(regexpMatcher)) {
			let cmdLine = 'gulp ' + item.replace(regexpReplacer, "$1");
			taskList.gulpList.push(generateItem(cmdLine, "gulp"));
		}
	}
}

function buildNpmTasks(file) {
	if (typeof file === 'object') {
		var pattern = JSON.parse(file.getText());

		if (typeof pattern.scripts === 'object') {
			taskList.npmList = [];

			for (let item in pattern.scripts) {
				let cmdLine = 'npm run ' + item;
				if (config.useYarn === true) {
					cmdLine = 'yarn run ' + item;
				}
				taskList.npmList.push(generateItem(cmdLine, "npm"));
			}
		}
	}
}

function generateTaskFromScript(file, exec) {
	if (typeof file === 'object') {
		var cmdLine = exec + file.uri._fsPath; //.replace(vscode.workspace.rootPath, '.');
		taskList.scriptList.push(generateItem(path.normalize(cmdLine), "script"));
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

function buildVsTasks(file) {
	if (typeof file === 'object') {
		taskList.vsList = [];

		try {
			let pattern = JSON.parse(file.getText().replace(new RegExp("//.*", "gi"), ""));

			if (Array.isArray(pattern.tasks)) {
				for (let task of pattern.tasks) {
					let cmdLine = task.taskName;
					taskList.vsList.push(generateItem(cmdLine, "vs"));
				}
			}
		}
		catch (e) {
			console.log("Invaild tasks.json");
		}
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
			statusBarItem.text = '$(x) No Task Found';
			statusBarItem.tooltip = 'No Task Found Yet.';
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
	flags.vsScaned = false;
	taskList.vsList = [];

	loadTasks(config.enableVsTasks, '.vscode/tasks.json', buildVsTasks, "vsScaned");
}

function activate(context) {
	config = vscode.workspace.getConfiguration('quicktask');

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	statusBarItem.text = statusBarItem.tooltip = '$(search) Scanning Tasks...';
	statusBarItem.show();

	var showTaskCommand = addCommand();

	let createWatcher = function (files, handler, ignoreChange) {
		let watcher = vscode.workspace.createFileSystemWatcher(files, false, ignoreChange, false);

		watcher.onDidCreate(handler);
		watcher.onDidChange(handler);
		watcher.onDidDelete(handler);

		context.subscriptions.push(watcher);

		return watcher;
	}

	taskWatcher.gulpWatcher = createWatcher("**/gulpfile.js", loadGulpTasks, false);
	taskWatcher.npmWatcher = createWatcher("**/package.json", loadNpmTasks, false);
	taskWatcher.scriptWatcher = createWatcher(glob, loadScripts, true);
	taskWatcher.vsWatcher = createWatcher("**/.vscode/tasks.json", loadVsTasks, false);

	loadGulpTasks();
	loadNpmTasks();
	loadScripts();
	loadVsTasks();

	context.subscriptions.push(showTaskCommand);
	context.subscriptions.push(statusBarItem);
}

function deactivate() {
	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
