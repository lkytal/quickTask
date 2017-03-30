'use strict';

const path = require("path");
const vscode = require('vscode');
const async = require('async');

var config;
var glob = '**/*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}';
var statusBarItem;

const data = {
	flags: {},
	taskList: {},
	enable: {},
	prefix : {
		vs: "$(code)  ",
		gulp: "$(browser)  ",
		npm: "$(package)  ",
		script: "$(terminal)  ",
		user: "$(tag)  "
	}
}

function unique(arr) {
	return Array.from(new Set(arr))
}

function getCmds() {
	var list = [];

	for (let item of config.defaultTasks) {
		list.push(generateItem(item, "user"));
	}

	for (let item of Object.keys(data.taskList)) {
		list = list.concat(data.taskList[item]);
	}

	return unique(list).sort();
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
				description: "VS Code Tasks",
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

function buildGulpTasks(file) {
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

function buildNpmTasks(file) {
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
		var cmdLine = exec + file.uri._fsPath; //.replace(vscode.workspace.rootPath, '.');
		data.taskList["script"].push(generateItem(path.normalize(cmdLine), "script"));
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
		data.taskList["vs"] = [];

		try {
			let pattern = JSON.parse(file.getText().replace(new RegExp("//.*", "gi"), ""));

			if (Array.isArray(pattern.tasks)) {
				for (let task of pattern.tasks) {
					let cmdLine = task.taskName;
					data.taskList.vsList.push(generateItem(cmdLine, "vs"));
				}
			}
			else if (pattern.command != null) {
				data.taskList["vs"].push(generateItem(pattern.command, "vs"));
			}
		}
		catch (e) {
			console.log("Invaild tasks.json");
		}
	}
}

function checkScanFinished() {
	let finished = true;

	for (let key of Object.keys(data.flags)) {
		data.flags[key] |= !data.enable[key];
		finished &= data.flags[key];
	}

	return finished;
}

function finishScan() {
	if (checkScanFinished()) {
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

function loadTasks(findSyntex, handleFunc, key) {
	if (data.enable[key] == false) {
		data.flags[key] = true;
		return;
	}

	data.flags[key] = false;
	data.taskList[key] = [];

	vscode.workspace.findFiles(findSyntex, config.excludesGlob).then(function (foundList) {
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

function loadGulpTasks() {
	loadTasks(config.gulpGlob, buildGulpTasks, "gulp");
}

function loadNpmTasks() {
	loadTasks(config.npmGlob, buildNpmTasks, "npm");
}

function loadScripts() {
	loadTasks(glob, buildScriptsDispatcher, "script");
}

function loadVsTasks() {
	loadTasks('.vscode/tasks.json', buildVsTasks, "vs");
}

function activate(context) {
	config = vscode.workspace.getConfiguration('quicktask');

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	statusBarItem.text = statusBarItem.tooltip = '$(search) Scanning Tasks...';
	statusBarItem.show();

	let showTaskCommand = addCommand();

	let createWatcher = function (files, handler, ignoreChange) {
		let watcher = vscode.workspace.createFileSystemWatcher(files, false, ignoreChange, false);

		watcher.onDidCreate(handler);
		watcher.onDidChange(handler);
		watcher.onDidDelete(handler);

		context.subscriptions.push(watcher);

		return watcher;
	}

	data.enable["gulp"] = config.enableGulp;
	data.enable["npm"] = config.enableNpm;
	data.enable["vs"] = config.enableVsTasks;
	data.enable["script"] = 1;

	createWatcher("**/gulpfile.js", loadGulpTasks, false);
	createWatcher("**/package.json", loadNpmTasks, false);
	createWatcher(glob, loadScripts, true);
	createWatcher("**/.vscode/tasks.json", loadVsTasks, false);

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
