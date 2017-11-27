import * as path from "path";
import * as fs from "fs";
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as util from "util";
import taskLoader = require('./taskLoader');

let prefix = {
	vs: "$(code) \tVS Task: ",
	gulp: "$(browser) \t",
	npm: "$(package) \t",
	script: "$(terminal) \t",
	user: "$(tag) \t"
}

function generateItem(type: string, label, cmdLine, fileUri = null, description = null) {
	let workspace = null;

	if (!util.isNullOrUndefined(fileUri)) {
		workspace = vscode.workspace.getWorkspaceFolder(fileUri);
	}

	if (util.isNullOrUndefined(workspace)) {
		workspace = vscode.workspace.workspaceFolders[0];
	}

	let workspaceName = workspace ? workspace.name : "";

	if (util.isNullOrUndefined(description)) {
		let relative = vscode.workspace.asRelativePath(fileUri);
		description = path.join(workspaceName, path.dirname(relative));
	}

	let item = {
		type: type,
		label: prefix[type] + label,
		cmdLine: cmdLine,
		description: description,
		filePath: fileUri ? fileUri.fsPath : "",
		workspace: workspaceName
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
			try {
				let pattern = JSON.parse(file.getText().replace(new RegExp("//.*", "gi"), ""));

				if (Array.isArray(pattern.tasks)) {
					for (let task of pattern.tasks) {
						let cmdLine = 'label' in task ? task.label : task.taskName;

						if (util.isNullOrUndefined(cmdLine)) {
							continue;
						}

						this.taskList.push(generateItem("vs", cmdLine, cmdLine, file.uri));
					}
				}
				else if (pattern.command != null) {
					this.taskList.push(generateItem("vs", pattern.command, pattern.command, file.uri));
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
			let legacyGulpPath = path.join(path.dirname(file.fileName), "gulpfile.js");
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
		let tasks = stdout.trim().split("\n");

		for (let item of tasks) {
			if (item.length != 0) {
				let cmdLine = 'gulp ' + item;
				let task = generateItem("gulp", cmdLine, cmdLine, file.uri);
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
					this.taskList.push(generateItem("gulp", cmdLine, cmdLine, file.uri));
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
				let pattern = JSON.parse(file.getText());

				if (typeof pattern.scripts === 'object') {
					for (let item of Object.keys(pattern.scripts)) {
						let cmdLine = 'npm run ' + item;
						if (this.useYarn === true) {
							cmdLine = 'yarn run ' + item;
						}

						let task = generateItem("npm", cmdLine, cmdLine, file.uri);
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
					this.taskList.push(generateItem("script", cmdLine, cmdLine, file.uri));
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
				this.taskList.push(generateItem("user", item, item, null, "User Defined Tasks"));
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

function generateFromList(type, list, filePath = null, description = null) {
	let rst = [];

	for (let cmdLine of list) {
		rst.push(generateItem(type, cmdLine, cmdLine, filePath, description));
	}

	return rst;
}

export {
	vsLoader, gulpLoader, npmLoader, scriptLoader, defaultLoader, generateFromList
};
