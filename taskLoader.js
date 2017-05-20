"use strict";

const vscode = require("vscode");
const async = require('async');

class taskLoader {
	constructor(key, config, excludesGlob, callBack) {
		this.key = key;
		this.glob = config.glob;
		this.enable = config.enable;
		this.excludesGlob = excludesGlob;
		this.callBack = callBack;

		this.finished = false;
		this._taskList = [];
	}

	get taskList() {
		return this._taskList;
	}

	set taskList(value) {
		this._taskList = value;
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

	handleFunc(file) {
		console.log(file);
	}

	onFinish(err) {
		if (err) {
			vscode.window.showInformationMessage("Error when scanning tasks of " + this.key);
			this.taskList = [];
		}

		this.finished = true;

		this.callBack();
	}

	setupWatcher(ignoreChange = false) {
		let watchPath = this.glob;
		if (watchPath.indexOf("**/") != 0) watchPath = "**/" + watchPath;

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
