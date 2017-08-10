const path = require("path");
const fs = require("fs");
const vscode = require('vscode');
const taskLoader = require('./taskLoader.js');
const child_process = require('child_process');

let prefix = {
	vs: "$(code)  ",
	gulp: "$(browser)  ",
	npm: "$(package)  ",
	script: "$(terminal)  ",
	user: "$(tag)  "
}

function generateItem(cmdLine, type, description) {
	switch (type) {
		case "npm":
		case "gulp":
		case "script":
			return {
				label: prefix[type] + cmdLine,
				cmdLine: cmdLine,
				isVS: false,
				description: description,
				relativePath: description
			};

		case "vs":
			return {
				label: prefix.vs + cmdLine,
				cmdLine: cmdLine,
				description: "VS Code tasks",
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

class vsLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("vs", {
			glob: '.vscode/tasks.json',
			enable: globalConfig.enableVsTasks
		}, globalConfig.excludesGlob, finishScan);
	}

	handleFunc(file, callback) {
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

		callback();
	}
}

class gulpLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("gulp", {
			glob: globalConfig.gulpGlob,
			enable: globalConfig.enableGulp
		}, globalConfig.excludesGlob, finishScan);
	}

	handleFunc(file, callback) {
		if (path.basename(file.fileName) == "gulpfile.js") {
			let babelGulpPath = path.dirname(file.fileName) + path.sep + "gulpfile.babel.js";
			if (fs.existsSync(babelGulpPath)) {
				return callback();
			}
		}

		let relativePath = path.relative(vscode.workspace.rootPath, path.dirname(file.fileName));

		child_process.exec('gulp --tasks-simple', {
			cwd: vscode.workspace.rootPath,
			timeout: 10000
		}, (err, stdout, stderr) => {
			if (err) {
				console.error(stderr);
				return this.oldRegexHandler(file, callback);
			}

			let tasks = stdout.trim().split("\n");

			for (let item of tasks) {
				if (item.length != 0) {
					let cmdLine = 'gulp ' + item;
					this.taskList.push(generateItem(cmdLine, "gulp", relativePath));
				}
			}

			callback();
		});
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
				console.log("Invalid gulp file");
			}
		}

		callback();
	}
}

class npmLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("npm", {
			glob: globalConfig.npmGlob,
			enable: globalConfig.enableNpm
		}, globalConfig.excludesGlob, finishScan);

		this.useYarn = globalConfig.useYarn;
	}

	handleFunc(file, callback) {
		if (typeof file === 'object') {
			try {
				let pattern = JSON.parse(file.getText());

				let relativePath = path.relative(vscode.workspace.rootPath, path.dirname(file.fileName));

				if (typeof pattern.scripts === 'object') {
					for (let item of Object.keys(pattern.scripts)) {
						let cmdLine = 'npm run ' + item;
						if (this.useYarn === true) {
							cmdLine = 'yarn run ' + item;
						}
						this.taskList.push(generateItem(cmdLine, "npm", relativePath));
					}
				}
			}
			catch (e) {
				console.log("Invalid package.json");
			}
		}

		callback();
	}
}

class scriptLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("script", {
			glob: '**/*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}',
			enable: 1
		}, globalConfig.excludesGlob, finishScan);
		this.globalConfig = globalConfig;

		this.scriptTable = {
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
	}

	handleFunc(file, callback) {
		if (typeof file != 'object') return;

		for (let type of Object.keys(this.scriptTable)) {
			if (file.languageId === type) {
				if (this.scriptTable[type].enabled) {
					let cmdLine = this.scriptTable[type].exec + file.fileName;
					this.taskList.push(generateItem(cmdLine, "script", ""));
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
		}, globalConfig.excludesGlob, finishScan);
	}

	loadTask() {
		this.finished = false;
		this.taskList = [];

		if (this.enable == false) {
			this.finished = true;
			return this.onFinish();
		}

		let defaultList = vscode.workspace.getConfiguration('quicktask').get('defaultTasks');

		for (let item of defaultList) {
			try {
				this.taskList.push(generateItem(item, "user"));
			}
			catch (e) {
				console.log("Invalid item: " + e.message);
			}
		}

		this.finished = true;
		return this.onFinish();
	}

	setupWatcher() {
		let watcher = vscode.workspace.onDidChangeConfiguration((e) => {
			this.loadTask();
		});

		return watcher;
	}
}

exports.vsLoader = vsLoader;
exports.gulpLoader = gulpLoader;
exports.npmLoader = npmLoader;
exports.scriptLoader = scriptLoader;
exports.defaultLoader = defaultLoader;

exports.generateFromList = function (list, type, description) {
	let rst = [];

	for (let item of list) {
		rst.push(generateItem(item, type, description));
	}

	return rst;
}
