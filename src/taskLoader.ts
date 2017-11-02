"use strict";

import * as vscode from 'vscode';
import * as async from 'async';

class taskLoader {
	key = null;
	config = null;
	globalConfig = null;
	glob = null;
	enable = null;
	excludesGlob = null;
	callBack;
	finished = false;
	_taskList = [];

	constructor(key, config, globalConfig, callBack) {
		this.key = key;
		this.config = config;
		this.globalConfig = globalConfig;
		this.glob = config.glob;
		this.enable = config.enable;
		this.excludesGlob = globalConfig.excludesGlob;
		this.callBack = callBack;

		this.finished = false;
		this._taskList = [];

		if (this.globalConfig.searchTaskFileInSubdirectories == true) {
			if (this.glob.indexOf("**/") != 0) {
				this.glob = "**/" + this.glob;
			}
		}
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
				this.handleFunc(file, callback);
			});
		}, (err) => this.onFinish(err));
	}

	handleFunc(file, callback) {
		console.log(file);
		callback();
	}

	reload() {
		this.finished = false;
		this.taskList = [];

		setTimeout(this.loadTask, 10);
	}

	onFinish(err = null) {
		if (err) {
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

export = taskLoader;
