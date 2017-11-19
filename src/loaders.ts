import * as path from "path";
import * as fs from "fs";
import * as vscode from 'vscode';
import taskLoader = require('./taskLoader');
import * as child_process from 'child_process';
import { isNull, isNullOrUndefined } from "util";

let prefix = {
	vs: "$(code) \tVS Task: ",
	gulp: "$(browser) \t",
	npm: "$(package) \t",
	script: "$(terminal) \t",
	user: "$(tag) \t"
}

function generateItem(cmdLine, type, description = '', label = cmdLine, relativePath = '') {
	let item = {
		label: prefix[type] + label,
		cmdLine: cmdLine,
		type: type,
		description: description,
		relativePath: relativePath
	};

	return item;
}

class vsLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("vs", {
			glob: '.vscode/tasks.json',
			enable: globalConfig.enableVsTasks
		}, globalConfig, finishScan);
	}

	handleFunc(file, callback) {
		if (typeof file === 'object') {
			let description = vscode.workspace.getWorkspaceFolder(file.uri).name;

			try {
				let pattern = JSON.parse(file.getText().replace(new RegExp("//.*", "gi"), ""));

				if (Array.isArray(pattern.tasks)) {
					for (let task of pattern.tasks) {
						let cmdLine = 'label' in task ? task.label : task.taskName;

						if (isNullOrUndefined(cmdLine)) {
							continue;
						}

						this.taskList.push(generateItem(cmdLine, "vs", description));
					}
				}
				else if (pattern.command != null) {
					this.taskList.push(generateItem(pattern.command, "vs", description));
				}
			}
			catch (e) {
				console.error("Invalid tasks.json" + e.message);
			}
		}

		callback();
	}
}

class gulpLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("gulp", {
			glob: globalConfig.gulpGlob,
			enable: globalConfig.enableGulp
		}, globalConfig, finishScan);
	}

	handleFunc(file, callback) {
		if (path.basename(file.fileName) === "gulpfile.babel.js") {
			let legacyGulpPath = path.dirname(file.fileName) + path.sep + "gulpfile.js";
			if (fs.existsSync(legacyGulpPath)) {
				return callback();
			}
		}

		child_process.exec('gulp --tasks-simple', {
			cwd: path.dirname(file.fileName),
			timeout: 10000
		}, (err, stdout, stderr) => {
			if (err) {
				console.error(err);
				this.oldRegexHandler(file, callback);
				return;
			}

			this.extractTasks(file, stdout, callback);
		});
	}

	extractTasks(file, stdout, callback) {
		let description = vscode.workspace.asRelativePath(file.uri);
		let relativePath = path.dirname(file.fileName);
		let tasks = stdout.trim().split("\n");

		for (let item of tasks) {
			if (item.length != 0) {
				let cmdLine = 'gulp ' + item;
				let task = generateItem(cmdLine, "gulp", description, cmdLine, relativePath);
				this.taskList.push(task);
			}
		}

		callback();
	}

	oldRegexHandler(file, callback) {
		var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
		var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

		if (typeof file === 'object') {
			try {
				for (let item of file.getText().match(regexpMatcher)) {
					let cmdLine = 'gulp ' + item.replace(regexpReplacer, "$1");
					this.taskList.push(generateItem(cmdLine, "gulp"));
				}
			}
			catch (e) {
				console.error("Invalid gulp file :" + e.message);
			}
		}

		callback();
	}
}

class npmLoader extends taskLoader {
	protected useYarn = false;

	constructor(globalConfig, finishScan) {
		super("npm", {
			glob: globalConfig.npmGlob,
			enable: globalConfig.enableNpm
		}, globalConfig, finishScan);

		this.useYarn = globalConfig.useYarn;
	}

	handleFunc(file, callback) {
		if (typeof file === 'object') {
			try {
				let description = vscode.workspace.asRelativePath(file.uri);
				let relativePath = path.dirname(file.fileName);
				let pattern = JSON.parse(file.getText());

				if (typeof pattern.scripts === 'object') {
					for (let item of Object.keys(pattern.scripts)) {
						let cmdLine = 'npm run ' + item;
						if (this.useYarn === true) {
							cmdLine = 'yarn run ' + item;
						}

						let task = generateItem(cmdLine, "npm", description, cmdLine, relativePath);
						this.taskList.push(task);
					}
				}
			}
			catch (err) {
				console.error(err);
			}
		}

		callback();
	}
}

class scriptLoader extends taskLoader {
	protected scriptTable = {
		shellscript: {
			exec: "",
			enabled: this.globalConfig.enableShell
		},
		python: {
			exec: "python ",
			enabled: this.globalConfig.enablePython
		},
		ruby: {
			exec: "ruby ",
			enabled: this.globalConfig.enableRuby
		},
		powershell: {
			exec: "powershell ",
			enabled: this.globalConfig.enablePowershell
		},
		perl: {
			exec: "perl ",
			enabled: this.globalConfig.enablePerl
		},
		bat: {
			exec: "",
			enabled: this.globalConfig.enableBatchFile
		}
	}

	constructor(globalConfig, finishScan) {
		super("script", {
			glob: '*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}',
			enable: 1
		}, globalConfig, finishScan);
	}

	handleFunc(file, callback) {
		if (typeof file != 'object') return;

		for (let type of Object.keys(this.scriptTable)) {
			if (file.languageId === type) {
				if (this.scriptTable[type].enabled) {
					let cmdLine = this.scriptTable[type].exec + file.fileName;
					this.taskList.push(generateItem(cmdLine, "script"));
				}
				break;
			}
		}

		callback();
	}

	setupWatcher() {
		return super.setupWatcher(true);
	}
}

class defaultLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("user", {
			glob: '',
			enable: globalConfig.enableVsTasks
		}, globalConfig, finishScan);
	}

	public async loadTask() {
		this.finished = false;
		this.taskList = [];

		if (this.enable == false) {
			this.finished = true;
			return this.onFinish();
		}

		try {
			let defaultList = vscode.workspace.getConfiguration('quicktask')['defaultTasks'];

			for (let item of defaultList) {
				this.taskList.push(generateItem(item, "user", "User Defined Tasks"));
			}
		}
		catch (err) {
			console.error(err);
		}

		this.finished = true;
		this.onFinish();
	}

	setupWatcher() {
		let watcher = vscode.workspace.onDidChangeConfiguration((e) => {
			this.loadTask();
		});

		return watcher;
	}
}

function generateFromList(list, type, description = '', relativePath = '') {
	if (relativePath != '' && relativePath[relativePath.length - 1] == "\\") {
		relativePath = relativePath.slice(0, relativePath.length - 1);
	}

	let rst = [];

	for (let item of list) {
		rst.push(generateItem(item, type, description, item, relativePath));
	}

	return rst;
}

export {
	vsLoader, gulpLoader, npmLoader, scriptLoader, defaultLoader, generateFromList
};
