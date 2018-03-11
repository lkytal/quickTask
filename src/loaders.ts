import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as vscode from "vscode";
import TaskLoader = require("./taskLoader");

const prefix = {
	gulp: "$(browser) \t",
	npm: "$(package) \t",
	script: "$(terminal) \t",
	user: "$(tag) \t",
	vs: "$(code) \tVS Task: "
};

function generateItem(type: string, label, cmdLine, fileUri = null, description = null) {
	const workspace: vscode.WorkspaceFolder = util.isNullOrUndefined(fileUri) ?
		vscode.workspace.workspaceFolders[0] :
		vscode.workspace.getWorkspaceFolder(fileUri);

	// if (util.isNullOrUndefined(fileUri)) {
	// 	fileUri = workspace ? workspace.uri : null;
	// }

	const workspaceName = workspace ? workspace.name : "";

	if (util.isNullOrUndefined(description)) {
		const relative = vscode.workspace.asRelativePath(fileUri);
		description = path.join(workspaceName, path.dirname(relative));
	}

	const item = {
		cmdLine: cmdLine,
		description: description,
		filePath: fileUri ? fileUri.fsPath : "",
		label: prefix[type] + label,
		type: type,
		workspace: workspaceName
	};

	return item;
}

class VSLoader extends TaskLoader {
	constructor(globalConfig, finishScan) {
		super("vs", {
			enable: globalConfig.enableVsTasks,
			glob: ".vscode/tasks.json"
		}, globalConfig, finishScan);
	}

	public handleFunc(file, callback) {
		try {
			const pattern = JSON.parse(file.getText().replace(new RegExp("//.*", "gi"), ""));

			if (Array.isArray(pattern.tasks)) {
				for (const task of pattern.tasks) {
					const cmdLine = "label" in task ? task.label : task.taskName;

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

		callback();
	}
}

class GulpLoader extends TaskLoader {
	constructor(globalConfig, finishScan) {
		super("gulp", {
			enable: globalConfig.enableVsTasks,
			glob: globalConfig.gulpGlob
		}, globalConfig, finishScan);
	}

	public handleFunc(file, callback) {
		if (path.basename(file.fileName) === "gulpfile.babel.js") {
			const legacyGulpPath = path.join(path.dirname(file.fileName), "gulpfile.js");
			if (fs.existsSync(legacyGulpPath)) {
				return callback();
			}
		}

		child_process.exec("gulp --tasks-simple", {
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

	protected extractTasks(file, stdout, callback) {
		const tasks = stdout.trim().split("\n");

		for (const item of tasks) {
			if (item.length !== 0) {
				const cmdLine = "gulp " + item;
				const task = generateItem("gulp", cmdLine, cmdLine, file.uri);
				this.taskList.push(task);
			}
		}

		callback();
	}

	protected oldRegexHandler(file, callback) {
		const regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
		const regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

		if (typeof file === "object") {
			try {
				for (const item of file.getText().match(regexpMatcher)) {
					const cmdLine = "gulp " + item.replace(regexpReplacer, "$1");
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

class NpmLoader extends TaskLoader {
	protected useYarn = false;

	constructor(globalConfig, finishScan) {
		super("npm", {
			enable: globalConfig.enableVsTasks,
			glob: globalConfig.npmGlob
		}, globalConfig, finishScan);

		this.useYarn = globalConfig.useYarn;
	}

	public handleFunc(file, callback) {
		if (typeof file === "object") {
			try {
				const pattern = JSON.parse(file.getText());

				if (typeof pattern.scripts === "object") {
					for (const item of Object.keys(pattern.scripts)) {
						let cmdLine = "npm run " + item;
						if (this.useYarn === true) {
							cmdLine = "yarn run " + item;
						}

						const task = generateItem("npm", cmdLine, cmdLine, file.uri);
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

class ScriptLoader extends TaskLoader {
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
	};

	constructor(globalConfig, finishScan) {
		super("script", {
			glob: "*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}",
			enable: 1
		}, globalConfig, finishScan);
	}

	public handleFunc(file, callback) {
		if (typeof file !== "object") { return; }

		for (const type of Object.keys(this.scriptTable)) {
			if (file.languageId === type) {
				if (this.scriptTable[type].enabled) {
					const cmdLine = this.scriptTable[type].exec + file.fileName;
					this.taskList.push(generateItem("script", cmdLine, cmdLine, file.uri));
				}
				break;
			}
		}

		callback();
	}

	public setupWatcher() {
		return super.setupWatcher(true);
	}
}

class DefaultLoader extends TaskLoader {
	constructor(globalConfig, finishScan) {
		super("user", {
			enable: globalConfig.enableVsTasks,
			glob: ""
		}, globalConfig, finishScan);
	}

	public async loadTask() {
		this.finished = false;
		this.taskList = [];

		if (this.enable === false) {
			this.finished = true;
			return this.onFinish();
		}

		try {
			const defaultList = vscode.workspace.getConfiguration("quicktask").defaultTasks;

			for (const item of defaultList) {
				this.taskList.push(generateItem("user", item, item, null, "User Defined Tasks"));
			}
		}
		catch (err) {
			console.error(err);
		}

		this.finished = true;
		this.onFinish();
	}

	public setupWatcher() {
		const watcher = vscode.workspace.onDidChangeConfiguration((e) => {
			this.loadTask();
		});

		return watcher;
	}
}

function generateFromList(type, list, filePath = null, description = null) {
	const rst = [];

	for (const cmdLine of list) {
		rst.push(generateItem(type, cmdLine, cmdLine, filePath, description));
	}

	return rst;
}

export {
	VSLoader, GulpLoader, NpmLoader, ScriptLoader, DefaultLoader, generateFromList
};
