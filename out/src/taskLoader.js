"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const vscode = require("vscode");
const promisify = require('util.promisify');
class taskLoader {
    constructor(key, config, globalConfig, callBack) {
        this.key = key;
        this.config = config;
        this.globalConfig = globalConfig;
        this.callBack = callBack;
        this.glob = null;
        this.enable = null;
        this.excludesGlob = null;
        this.finished = false;
        this.taskList = [];
        this.glob = config.glob;
        this.enable = config.enable;
        this.excludesGlob = globalConfig.excludesGlob;
        if (this.globalConfig.searchTaskFileInSubdirectories == true) {
            if (this.glob.indexOf("**/") != 0) {
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
            if (this.enable == false) {
                this.finished = true;
                return this.onFinish();
            }
            let foundList = yield vscode.workspace.findFiles(this.glob, this.excludesGlob);
            this.parseTasksFromFile(foundList);
        });
    }
    parseTasksFromFile(fileList) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(fileList) || fileList.length == 0) {
                return this.onFinish();
            }
            try {
                let rstList = fileList.map((item) => __awaiter(this, void 0, void 0, function* () {
                    return yield vscode.workspace.openTextDocument(item.fsPath);
                }));
                for (let file of rstList) {
                    // let handleFuncPromise = promisify(this.handleFunc);
                    // await handleFuncPromise(await file);
                    this.handleFunc(yield file, () => { });
                }
            }
            catch (err) {
                console.error('err: ', err);
            }
            this.onFinish();
        });
    }
    handleFunc(file, callback) {
        console.log(file);
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
        if (watchPath.indexOf("**/") != 0) {
            watchPath = "**/" + watchPath;
        }
        let watcher = vscode.workspace.createFileSystemWatcher(watchPath, false, ignoreChange, false);
        watcher.onDidCreate(this.onChanged);
        watcher.onDidChange(this.onChanged);
        watcher.onDidDelete(this.onChanged);
        return watcher;
    }
    onChanged() {
        this.loadTask();
    }
}
module.exports = taskLoader;
//# sourceMappingURL=taskLoader.js.map