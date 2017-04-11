'use strict';

const path = require("path");
const vscode = require('vscode');

const taskLoader = require('./taskLoader.js');

var globalConfig;

const data = {
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

function unique(arr) {
	return Array.from(new Set(arr));
}

function getCmd() {
	var list = [];

	for (let item of globalConfig.defaultTasks) {
		list.push(generateItem(item, "user"));
	}

	for (let loader of data.loaderList) {
		list = list.concat(loader.taskList);
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

class vsLoader extends taskLoader {
	constructor(config) {
		super("vs", config, globalConfig.excludesGlob);
	}

	handleFunc(file) {
		if (typeof file === 'object') {
			try {
				let pattern = JSON.parse(file.getText().replace(new RegExp("//.*", "gi"), ""));

				if (Array.isArray(pattern.tasks)) {
					for (let task of pattern.tasks) {
						let cmdLine = task.taskName;
						this.taskList.push(generateItem(cmdLine, "vs"));
					}
				}
				else if (pattern.command != null) {
					this.taskList.push(generateItem(pattern.command, "vs"));
				}
			}
			catch (e) {
				console.log("Invalid tasks.json");
			}
		}
	}

	onFinish() {
		finishScan();
	}
}

class gulpLoader extends taskLoader {
	constructor(config) {
		super("gulp", config, globalConfig.excludesGlob);
	}

	handleFunc(file) {
		var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
		var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

		if (typeof file === 'object') {
			for (let item of file.getText().match(regexpMatcher)) {
				let cmdLine = 'gulp ' + item.replace(regexpReplacer, "$1");
				this.taskList.push(generateItem(cmdLine, "gulp"));
			}
		}
	}

	onFinish() {
		finishScan();
	}
}

class npmLoader extends taskLoader {
	constructor(config) {
		super("npm", config, globalConfig.excludesGlob);
	}

	handleFunc(file) {
		if (typeof file === 'object') {
			var pattern = JSON.parse(file.getText());

			if (typeof pattern.scripts === 'object') {
				for (let item in pattern.scripts) {
					let cmdLine = 'npm run ' + item;
					if (globalConfig.useYarn === true) {
						cmdLine = 'yarn run ' + item;
					}
					this.taskList.push(generateItem(cmdLine, "npm"));
				}
			}
		}
	}

	onFinish() {
		finishScan();
	}
}

class scriptLoader extends taskLoader {
	constructor(config) {
		super("script", config, globalConfig.excludesGlob);
	}

	generateTaskFromScript(file, exec) {
		if (typeof file === 'object') {
			var cmdLine = exec + file.uri._fsPath;
			this.taskList.push(generateItem(path.normalize(cmdLine), "script"));
		}
	}

	handleFunc(file) {
		if (file.languageId === 'shellscript' && globalConfig.enableShell) {
			this.generateTaskFromScript(file, '');
		}
		else if (file.languageId === 'python' && globalConfig.enablePython) {
			this.generateTaskFromScript(file, 'python ');
		}
		else if (file.languageId === 'ruby' && globalConfig.enableRuby) {
			this.generateTaskFromScript(file, 'ruby ');
		}
		else if (file.languageId === 'powershell' && globalConfig.enablePowershell) {
			this.generateTaskFromScript(file, 'powershell ');
		}
		else if (file.languageId === 'perl' && globalConfig.enablePerl) {
			this.generateTaskFromScript(file, 'perl ');
		}
		else if (file.languageId === 'bat' && globalConfig.enableBatchFile) {
			this.generateTaskFromScript(file, '');
		}
		else if (/.*\.ahk$/.test(file.fileName) === true) {
			this.generateTaskFromScript(file, '');
		}
		else if (/.*\.vbs$/.test(file.fileName) === true) {
			this.generateTaskFromScript(file, 'cscript ');
		}
	}

	onFinish() {
		finishScan();
	}
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

function setupLoader() {
	data.loaderList.push(new gulpLoader({
		glob: globalConfig.gulpGlob,
		enable: globalConfig.enableGulp
	}));

	data.loaderList.push(new npmLoader({
		glob: globalConfig.npmGlob,
		enable: globalConfig.enableNpm
	}));

	data.loaderList.push(new vsLoader({
		glob: '.vscode/tasks.json',
		enable: globalConfig.enableVsTasks
	}));

	data.loaderList.push(new scriptLoader({
		glob: '**/*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}',
		enable: 1
	}));
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

	setupLoader();

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
