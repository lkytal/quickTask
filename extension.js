'use strict';

const path = require("path");
const vscode = require('vscode');
const async = require('async');

var config;

const data = {
	statusBarItem: null,
	flags: {},
	taskList: {},
	enable: {},
	glob: {},
	handler: {},
	prefix: {
		vs: "$(code)  ",
		gulp: "$(browser)  ",
		npm: "$(package)  ",
		script: "$(terminal)  ",
		user: "$(tag)  "
	}
}

function unique(arr) {
	return Array.from(new Set(arr));
}

function getCmd() {
	var list = [];

	for (let item of config.defaultTasks) {
		list.push(generateItem(item, "user"));
	}

	for (let item of Object.keys(data.taskList)) {
		list = list.concat(data.taskList[item]);
	}

	return unique(list).sort(function (a, b) {
		return a.label.localeCompare(b.label);
	});
}

function generateItem(cmdLine, type) {
	switch (type) {
		case "npm":
		case "gulp":
		case "script":
			return {
				label: data.prefix[type] + cmdLine,
				cmdLine: cmdLine,
				isVS: false
			};

		case "vs":
			return {
				label: data.prefix.vs + cmdLine,
				cmdLine: cmdLine,
				description: "VS Code tasks",
				isVS: true
			};

		case "user":
			return {
				label: data.prefix.user + cmdLine,
				cmdLine: cmdLine,
				description: "User defined tasks",
				isVS: false
			};
	}
}

data.handler["gulp"] = function buildGulpTasks(file) {
	var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
	var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

	if (typeof file === 'object') {
		data.taskList["gulp"] = [];

		for (let item of file.getText().match(regexpMatcher)) {
			let cmdLine = 'gulp ' + item.replace(regexpReplacer, "$1");
			data.taskList["gulp"].push(generateItem(cmdLine, "gulp"));
		}
	}
}

data.handler["npm"] = function buildNpmTasks(file) {
	if (typeof file === 'object') {
		var pattern = JSON.parse(file.getText());

		if (typeof pattern.scripts === 'object') {
			data.taskList["npm"] = [];

			for (let item in pattern.scripts) {
				let cmdLine = 'npm run ' + item;
				if (config.useYarn === true) {
					cmdLine = 'yarn run ' + item;
				}
				data.taskList["npm"].push(generateItem(cmdLine, "npm"));
			}
		}
	}
}

function generateTaskFromScript(file, exec) {
	if (typeof file === 'object') {
		var cmdLine = exec + file.uri._fsPath;
		data.taskList["script"].push(generateItem(path.normalize(cmdLine), "script"));
	}
}

data.handler["script"] = function buildScriptsDispatcher(file) {
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

data.handler["vs"] = function buildVsTasks(file) {
	if (typeof file === 'object') {
		data.taskList["vs"] = [];

		try {
			let pattern = JSON.parse(file.getText().replace(new RegExp("//.*", "gi"), ""));

			if (Array.isArray(pattern.tasks)) {
				for (let task of pattern.tasks) {
					let cmdLine = task.taskName;
					data.taskList["vs"].push(generateItem(cmdLine, "vs"));
				}
			}
			else if (pattern.command != null) {
				data.taskList["vs"].push(generateItem(pattern.command, "vs"));
			}
		}
		catch (e) {
			console.log("Invalid tasks.json");
		}
	}
}

function checkScanFinished() {
	for (let key of Object.keys(data.flags)) {
		if (!data.flags[key] && data.enable[key]) {
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
			if (config.showTerminal) {
				terminal.show();
			}

			if (config.closeTerminalafterExecution) {
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

function loadTasks(findSyntax, handleFunc, key) {
	if (data.enable[key] == false) {
		data.flags[key] = true;
		return;
	}

	data.flags[key] = false;
	data.taskList[key] = [];

	vscode.workspace.findFiles(findSyntax, config.excludesGlob).then(function (foundList) {
		parseTasksFromFile(foundList, handleFunc, function (err) {
			if (err) {
				vscode.window.showInformationMessage("Error when scanning tasks of" + key);
				data.taskList[key] = [];
			}

			data.flags[key] = true;
			finishScan();
		});
	});
}

function loadTaskFromKey(key) {
	loadTasks(data.glob[key], data.handler[key], key);
}

function setupWatcher(key, ignoreChange) {
	let watchPath = data.glob[key];
	if (watchPath.indexOf("**/") != 0) watchPath = "**/" + watchPath;

	let watcher = vscode.workspace.createFileSystemWatcher(watchPath, false, ignoreChange, false);
	let handler = function () {
		loadTaskFromKey(key);
	}

	watcher.onDidCreate(handler);
	watcher.onDidChange(handler);
	watcher.onDidDelete(handler);

	return watcher;
}

function loadConfig() {
	config = vscode.workspace.getConfiguration('quicktask');

	data.enable["gulp"] = config.enableGulp;
	data.enable["npm"] = config.enableNpm;
	data.enable["vs"] = config.enableVsTasks;
	data.enable["script"] = 1;

	data.glob["gulp"] = config.gulpGlob;
	data.glob["npm"] = config.npmGlob;
	data.glob["vs"] = '.vscode/tasks.json';
	data.glob["script"] = '**/*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}';
}

function activate(context) {
	loadConfig();

	data.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	data.statusBarItem.text = '$(search) Scanning Tasks...';
	data.statusBarItem.tooltip = 'Scanning Tasks...';
	data.statusBarItem.show();
	context.subscriptions.push(data.statusBarItem);

	let showTaskCommand = vscode.commands.registerCommand('quicktask.showTasks', showCommand);
	context.subscriptions.push(showTaskCommand);

	for (let item of Object.keys(data.glob)) {
		loadTaskFromKey(item);
		context.subscriptions.push(setupWatcher(item, false));
	}
}

function deactivate() {
	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
