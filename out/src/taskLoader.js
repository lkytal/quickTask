"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require("async");
const vscode = require("vscode");
class TaskLoader {
    constructor(key, config, globalConfig, callBack) {
        this.key = key;
        this.config = config;
        this.globalConfig = globalConfig;
        this.callBack = callBack;
        this.taskList = [];
        this.enable = false;
        this.finished = false;
        this.glob = "";
        this.excludesGlob = "";
        this.glob = config.glob;
        this.enable = config.enable;
        this.excludesGlob = globalConfig.excludesGlob;
        if (this.globalConfig.searchTaskFileInSubdirectories === true) {
            if (this.glob.indexOf("**/") !== 0) {
                this.glob = "**/" + this.glob;
            }
        }
    }
    isFinished() {
        if (!this.enable) {
            this.finished = true;
        }
        return this.finished;
    }
    loadTask() {
        return __awaiter(this, void 0, void 0, function* () {
            this.finished = false;
            this.taskList = [];
            if (this.enable === false) {
                this.finished = true;
                return this.onFinish();
            }
            const foundList = yield this.getTaskFiles();
            this.parseTasksFromFile(foundList);
        });
    }
    getTaskFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const foundList = yield vscode.workspace.findFiles(this.glob, this.excludesGlob);
                return foundList;
            }
            catch (_a) {
                return [];
            }
        });
    }
    parseTasksFromFile(fileList) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(fileList) || fileList.length === 0) {
                return this.onFinish();
            }
            async.each(fileList, (item, callback) => __awaiter(this, void 0, void 0, function* () {
                const file = yield vscode.workspace.openTextDocument(item.fsPath);
                this.handleFunc(file, callback);
            }), (err) => this.onFinish(err));
        });
    }
    handleFunc(file, callback) {
        callback();
    }
    reload() {
        this.finished = false;
        this.taskList = [];
        setTimeout(this.loadTask.bind(this), 10);
    }
    onFinish(err = null) {
        if (err) {
            console.error(err);
            vscode.window.showInformationMessage("Error when scanning tasks of " + this.key);
            this.taskList = [];
        }
        this.finished = true;
        this.callBack();
    }
    setupWatcher(ignoreChange = false) {
        let watchPath = this.glob;
        if (watchPath.indexOf("**/") !== 0) {
            watchPath = "**/" + watchPath;
        }
        const watcher = vscode.workspace.createFileSystemWatcher(watchPath, false, ignoreChange, false);
        watcher.onDidCreate(this.onChanged);
        watcher.onDidChange(this.onChanged);
        watcher.onDidDelete(this.onChanged);
        return watcher;
    }
    onChanged() {
        this.reload();
    }
}
exports.default = TaskLoader;
//# sourceMappingURL=taskLoader.js.map