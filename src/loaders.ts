
import * as async from "async";
import * as child_process from "child_process";
import * as fs from "fs";
import * as json5 from "json5";
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

interface ITask {
	cmdLine: string;
	description: string;
	filePath: string;
	label: string;
	type: string;
	workspace: string;
}

function generateItem(type: string, label, cmdLine, fileUri = null, description = null) {
	const workspace: vscode.WorkspaceFolder = util.isNullOrUndefined(fileUri) ?
		vscode.workspace.workspaceFolders[0] :
		vscode.workspace.getWorkspaceFolder(fileUri);

	// if (util.isNullOrUndefined(fileUri)) {
	// 	fileUri = workspace ? workspace.uri : null;
	// }

	const workspaceName = workspace ? workspace.name : "";

	if (util.isNullOrUndefined(description)) {
		description = vscode.workspace.asRelativePath(fileUri);
	}

	const item: ITask = {
		cmdLine: cmdLine,
		description: "         " + description,
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

	public async getTaskFiles() {
		const taskFiles = [];

		for (const workspace of vscode.workspace.workspaceFolders) {
			const taskJson = path.join(workspace.uri.fsPath, ".vscode", "tasks.json");
			try {
				fs.statSync(taskJson);
				taskFiles.push({ fsPath: taskJson });
			}
			catch (err) {
				console.log("Task File Not found " + taskJson);
			}
		}

		return taskFiles;
	}

	public handleFunc(file: vscode.TextDocument, callback) {
		try {
			const pattern = json5.parse(file.getText());

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

	public async parseTasksFromFile(fileList: vscode.Uri[]) {
		if (!Array.isArray(fileList) || fileList.length === 0) {
			return this.onFinish();
		}

		async.each(fileList, async (uri, callback) => {
			this.handleFunc(uri, callback);
		}, (err) => this.onFinish(err));
	}

	public handleFunc(uri: vscode.Uri, callback) {
		const fileName = uri.fsPath;

		if (path.basename(fileName) === "gulpfile.js") {
			const babelGulpPath = path.join(path.dirname(fileName), "gulpfile.babel.js");
			const tsGulpPath = path.join(path.dirname(fileName), "gulpfile.ts");

			if (fs.existsSync(babelGulpPath) || fs.existsSync(tsGulpPath)) {
				return callback();
			}
		}

		if (path.basename(fileName) === "gulpfile.babel.js") {
			const tsGulpPath = path.join(path.dirname(fileName), "gulpfile.ts");
			if (fs.existsSync(tsGulpPath)) {
				return callback();
			}
		}

		child_process.exec("gulp --tasks-simple", {
			cwd: path.dirname(fileName),
			timeout: 10000
		}, (err, stdout, stderr) => {
			if (err) {
				console.error(err, stderr);
				this.oldRegexHandler(uri, callback);
				return;
			}

			this.extractTasks(uri, stdout, callback);
		});
	}

	protected extractTasks(uri: vscode.Uri, stdout: string, callback: () => void) {
		const tasks = stdout.trim().split("\n");

		for (const item of tasks) {
			if (item.length !== 0) {
				const cmdLine = "gulp " + item;
				const task = generateItem("gulp", cmdLine, cmdLine, uri);
				this.taskList.push(task);
			}
		}

		callback();
	}

	protected async oldRegexHandler(uri: vscode.Uri, callback) {
		const regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
		const regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

		try {
			const file = await vscode.workspace.openTextDocument(uri.fsPath);

			for (const item of file.getText().match(regexpMatcher)) {
				const cmdLine = "gulp " + item.replace(regexpReplacer, "$1");
				this.taskList.push(generateItem("gulp", cmdLine, cmdLine, uri));
			}
		}
		catch (e) {
			console.error("Invalid gulp file :" + e.message);
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

	public handleFunc(file: vscode.TextDocument, callback) {
		if (typeof file === "object") {
			try {
				const pattern = json5.parse(file.getText());

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
			exec: "cmd.exe /c ",
			enabled: this.globalConfig.enableBatchFile
		}
	};

	constructor(globalConfig, finishScan) {
		super("script", {
			glob: "*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}",
			enable: 1
		}, globalConfig, finishScan);
	}

	public handleFunc(file: vscode.TextDocument, callback) {
		if (typeof file !== "object") { return; }

		for (const type of Object.keys(this.scriptTable)) {
			if (file.languageId === type) {
				if (this.scriptTable[type].enabled) {
					const quoteFile = file.fileName.indexOf(" ") !== -1 ? "\"" + file.fileName + "\"" : file.fileName;
					const cmdLine = this.scriptTable[type].exec + quoteFile;
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
	// tslint:disable-next-line:no-identical-functions
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
	ITask as Task, VSLoader, GulpLoader, NpmLoader, ScriptLoader, DefaultLoader, generateFromList
};
