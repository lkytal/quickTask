"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const vscode = require("vscode");
const taskLoader = require("./taskLoader");
const child_process = require("child_process");
const util = require("util");
let prefix = {
    vs: "$(code) \tVS Task: ",
    gulp: "$(browser) \t",
    npm: "$(package) \t",
    script: "$(terminal) \t",
    user: "$(tag) \t"
};
function generateItem(type, label, cmdLine, fileUri = null, description = null) {
    let workspace = null;
    if (!util.isNullOrUndefined(fileUri)) {
        workspace = vscode.workspace.getWorkspaceFolder(fileUri);
    }
    if (util.isNullOrUndefined(workspace)) {
        workspace = vscode.workspace.workspaceFolders[0];
    }
    let workspaceName = workspace ? workspace.name : "";
    if (util.isNullOrUndefined(description)) {
        description = workspaceName; //vscode.workspace.asRelativePath(fileUri);
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
exports.vsLoader = vsLoader;
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
exports.gulpLoader = gulpLoader;
class npmLoader extends taskLoader {
    constructor(globalConfig, finishScan) {
        super("npm", {
            glob: globalConfig.npmGlob,
            enable: globalConfig.enableNpm
        }, globalConfig, finishScan);
        this.useYarn = false;
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
exports.npmLoader = npmLoader;
class scriptLoader extends taskLoader {
    constructor(globalConfig, finishScan) {
        super("script", {
            glob: '*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}',
            enable: 1
        }, globalConfig, finishScan);
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
        };
    }
    handleFunc(file, callback) {
        if (typeof file != 'object')
            return;
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
exports.scriptLoader = scriptLoader;
class defaultLoader extends taskLoader {
    constructor(globalConfig, finishScan) {
        super("user", {
            glob: '',
            enable: globalConfig.enableVsTasks
        }, globalConfig, finishScan);
    }
    loadTask() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    setupWatcher() {
        let watcher = vscode.workspace.onDidChangeConfiguration((e) => {
            this.loadTask();
        });
        return watcher;
    }
}
exports.defaultLoader = defaultLoader;
function generateFromList(type, list, filePath = null, description = null) {
    let rst = [];
    for (let cmdLine of list) {
        rst.push(generateItem(type, cmdLine, cmdLine, filePath, description));
    }
    return rst;
}
exports.generateFromList = generateFromList;
//# sourceMappingURL=loaders.js.map