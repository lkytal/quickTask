"use strict";

const vscode = require("vscode");
const async = require('async');

class taskLoader {
	constructor(key, config, excludesGlob) {
		this.key = key;
		this.glob = config.glob;
		this.enable = config.enable;
		this.excludesGlob = excludesGlob;

		this.finished = false;
		this.taskList = [];
	}

	isFinished() {
		if(!this.enable) {
			this.finished = true;
		}

		return this.finished;
	}

	loadTask() {
		if (this.enable == false) {
			this.finished = true;
			return;
		}

		this.finished = false;
		this.taskList = [];

		vscode.workspace.findFiles(this.glob, this.excludesGlob).then((foundList) => {
			this.parseTasksFromFile(foundList, (err) => {
				if (err) {
					vscode.window.showInformationMessage("Error when scanning tasks of " + this.key);
					this.taskList = [];
				}

				this.finished = true;
				this.onFinish();
			});
		});
	}

	parseTasksFromFile(fileList, finishCallback) {
		if (!Array.isArray(fileList)) return;

		if (fileList.length == 0) {
			return finishCallback();
		}

		async.each(fileList, (item, callback) => {
			vscode.workspace.openTextDocument(item.fsPath).then((file) => {
				this.handleFunc(file);
				return callback();
			});
		}, finishCallback);
	}

	handleFunc(file) {
		return;
	}

	onFinish() {
		return;
	}

	setupWatcher() {
		let watchPath = this.glob;
		if (watchPath.indexOf("**/") != 0) watchPath = "**/" + watchPath;

		let watcher = vscode.workspace.createFileSystemWatcher(watchPath, false, this.ignoreChange, false);

		watcher.onDidCreate(this.loadTask);
		watcher.onDidChange(this.loadTask);
		watcher.onDidDelete(this.loadTask);

		return watcher;
	}
}

module.exports = taskLoader;
