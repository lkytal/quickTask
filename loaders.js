const path = require("path");
const taskLoader = require('./taskLoader.js');

let prefix = {};

function setupPrefix(pre) {
	prefix = pre;
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
		}, globalConfig.excludesGlob);

		this.finishScan = finishScan;
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
		super.onFinish();
		this.finishScan();
	}
}

class gulpLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("gulp", {
			glob: globalConfig.gulpGlob,
			enable: globalConfig.enableGulp
		}, globalConfig.excludesGlob);

		this.finishScan = finishScan;
	}

	handleFunc(file) {
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
	}

	onFinish(err) {
		super.onFinish(err);
		this.finishScan();
	}
}

class npmLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("npm", {
			glob: globalConfig.npmGlob,
			enable: globalConfig.enableNpm
		}, globalConfig.excludesGlob);

		this.useYarn = globalConfig.useYarn;

		this.finishScan = finishScan;
	}

	handleFunc(file) {
		if (typeof file === 'object') {
			var pattern = JSON.parse(file.getText());

			if (typeof pattern.scripts === 'object') {
				try {
					for (let item in pattern.scripts) {
						let cmdLine = 'npm run ' + item;
						if (this.useYarn === true) {
							cmdLine = 'yarn run ' + item;
						}
						this.taskList.push(generateItem(cmdLine, "npm"));
					}
				}
				catch (e) {
					console.log("Invalid package.json");
				}
			}
		}
	}

	onFinish(err) {
		super.onFinish(err);
		this.finishScan();
	}
}

class scriptLoader extends taskLoader {
	constructor(globalConfig, finishScan) {
		super("script", {
			glob: '**/*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}',
			enable: 1
		}, globalConfig.excludesGlob);
		this.globalConfig = globalConfig;

		this.finishScan = finishScan;
	}

	generateTaskFromScript(file, exec) {
		if (typeof file === 'object') {
			var cmdLine = exec + file.uri._fsPath;
			this.taskList.push(generateItem(path.normalize(cmdLine), "script"));
		}
	}

	handleFunc(file) {
		if (file.languageId === 'shellscript' && this.globalConfig.enableShell) {
			this.generateTaskFromScript(file, '');
		}
		else if (file.languageId === 'python' && this.globalConfig.enablePython) {
			this.generateTaskFromScript(file, 'python ');
		}
		else if (file.languageId === 'ruby' && this.globalConfig.enableRuby) {
			this.generateTaskFromScript(file, 'ruby ');
		}
		else if (file.languageId === 'powershell' && this.globalConfig.enablePowershell) {
			this.generateTaskFromScript(file, 'powershell ');
		}
		else if (file.languageId === 'perl' && this.globalConfig.enablePerl) {
			this.generateTaskFromScript(file, 'perl ');
		}
		else if (file.languageId === 'bat' && this.globalConfig.enableBatchFile) {
			this.generateTaskFromScript(file, '');
		}
		else if (/.*\.ahk$/.test(file.fileName) === true) {
			this.generateTaskFromScript(file, '');
		}
		else if (/.*\.vbs$/.test(file.fileName) === true) {
			this.generateTaskFromScript(file, 'cscript ');
		}
	}

	onFinish(err) {
		super.onFinish(err);
		this.finishScan();
	}
}

exports.vsLoader = vsLoader;
exports.gulpLoader = gulpLoader;
exports.npmLoader = npmLoader;
exports.scriptLoader = scriptLoader;
exports.setupPrefix = setupPrefix;
exports.generateItem = generateItem;
