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

		this.ignoreChange = false; //temp
	}

	isFinished() {
		if (!this.enable) {
			this.finished = true;
		}

		return this.finished;
	}

	loadTask() {
		this.finished = false;
		this.taskList = [];

		if (this.enable == false) {
			this.finished = true;
			return this.onFinish();
		}

		vscode.workspace.findFiles(this.glob, this.excludesGlob).then((foundList) => {
			this.parseTasksFromFile(foundList);
		});
	}

	parseTasksFromFile(fileList) {
		if (!Array.isArray(fileList) || fileList.length == 0) {
			return this.onFinish();
		}

		async.each(fileList, (item, callback) => {
			vscode.workspace.openTextDocument(item.fsPath).then((file) => {
				this.handleFunc(file);
				return callback();
			});
		}, (err) => this.onFinish(err));
	}

	onFinish(err) {
		if (err) {
			vscode.window.showInformationMessage("Error when scanning tasks of " + this.key);
			this.taskList = [];
		}

		this.finished = true;
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
