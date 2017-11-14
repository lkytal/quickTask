"use strict";

import * as vscode from 'vscode';
import * as async from 'async';

abstract class taskLoader {
	protected glob = null;
	protected enable = null;
	protected excludesGlob = null;
	protected finished = false;
	public taskList = [];

	constructor(protected key, protected config, protected globalConfig, protected callBack) {
		this.glob = config.glob;
		this.enable = config.enable;
		this.excludesGlob = globalConfig.excludesGlob;

		if (this.globalConfig.searchTaskFileInSubdirectories == true) {
			if (this.glob.indexOf("**/") != 0) {
				this.glob = "**/" + this.glob;
			}
		}
	}

	public isFinished() {
		if (!this.enable) {
			this.finished = true;
		}

		return this.finished;
	}

	public async loadTask() {
		this.finished = false;
		this.taskList = [];

		if (this.enable == false) {
			this.finished = true;
			return this.onFinish();
		}

		let foundList = await vscode.workspace.findFiles(this.glob, this.excludesGlob);
		this.parseTasksFromFile(foundList);
	}

	public parseTasksFromFile(fileList) {
		if (!Array.isArray(fileList) || fileList.length == 0) {
			return this.onFinish();
		}

		async.each(fileList, (item, callback) => {
			vscode.workspace.openTextDocument(item.fsPath).then((file) => {
				this.handleFunc(file, callback);
			});
		}, (err) => this.onFinish(err));
	}

	protected handleFunc(file: vscode.TextDocument, callback) {
		console.log(file);
		callback();
	}

	public reload() {
		this.finished = false;
		this.taskList = [];

		setTimeout(this.loadTask, 10);
	}

	public onFinish(err = null) {
		if (err) {
			console.error(err);
			vscode.window.showInformationMessage("Error when scanning tasks of " + this.key);
			this.taskList = [];
		}

		this.finished = true;

		this.callBack();
	}

	public setupWatcher(ignoreChange = false): any {
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

	public onChanged() {
		this.loadTask();
	}
}

export = taskLoader;
