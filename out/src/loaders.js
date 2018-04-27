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
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const util = require("util");
const vscode = require("vscode");
const TaskLoader = require("./taskLoader");
const prefix = {
    gulp: "$(browser) \t",
    npm: "$(package) \t",
    script: "$(terminal) \t",
    user: "$(tag) \t",
    vs: "$(code) \tVS Task: "
};
function generateItem(type, label, cmdLine, fileUri = null, description = null) {
    const workspace = util.isNullOrUndefined(fileUri) ?
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
    handleFunc(file, callback) {
        try {
            const pattern = JSON.parse(file.getText().replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1'));
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
exports.VSLoader = VSLoader;
class GulpLoader extends TaskLoader {
    constructor(globalConfig, finishScan) {
        super("gulp", {
            enable: globalConfig.enableVsTasks,
            glob: globalConfig.gulpGlob
        }, globalConfig, finishScan);
    }
    handleFunc(file, callback) {
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
    extractTasks(file, stdout, callback) {
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
    oldRegexHandler(file, callback) {
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
exports.GulpLoader = GulpLoader;
class NpmLoader extends TaskLoader {
    constructor(globalConfig, finishScan) {
        super("npm", {
            enable: globalConfig.enableVsTasks,
            glob: globalConfig.npmGlob
        }, globalConfig, finishScan);
        this.useYarn = false;
        this.useYarn = globalConfig.useYarn;
    }
    handleFunc(file, callback) {
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
exports.NpmLoader = NpmLoader;
class ScriptLoader extends TaskLoader {
    constructor(globalConfig, finishScan) {
        super("script", {
            glob: "*.{sh,py,rb,ps1,pl,bat,cmd,vbs,ahk}",
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
        if (typeof file !== "object") {
            return;
        }
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
    setupWatcher() {
        return super.setupWatcher(true);
    }
}
exports.ScriptLoader = ScriptLoader;
class DefaultLoader extends TaskLoader {
    constructor(globalConfig, finishScan) {
        super("user", {
            enable: globalConfig.enableVsTasks,
            glob: ""
        }, globalConfig, finishScan);
    }
    loadTask() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    setupWatcher() {
        const watcher = vscode.workspace.onDidChangeConfiguration((e) => {
            this.loadTask();
        });
        return watcher;
    }
}
exports.DefaultLoader = DefaultLoader;
function generateFromList(type, list, filePath = null, description = null) {
    const rst = [];
    for (const cmdLine of list) {
        rst.push(generateItem(type, cmdLine, cmdLine, filePath, description));
    }
    return rst;
}
exports.generateFromList = generateFromList;
//# sourceMappingURL=loaders.js.map
