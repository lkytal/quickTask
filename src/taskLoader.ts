"use strict";

import * as async from "async";
import * as vscode from "vscode";
import { ITask } from "./ITask";

abstract class TaskLoader {
	public taskList: ITask[] = [];
	public enable: boolean = false;
	public finished: boolean = false;

	protected glob: string = "";
	protected excludesGlob: string = "";

	constructor(protected key: string, protected config, protected globalConfig: vscode.WorkspaceConfiguration, protected callBack: () => void) {
		this.glob = config.glob;
		this.enable = config.enable;
		this.excludesGlob = globalConfig.excludesGlob;

		if (this.globalConfig.searchTaskFileInSubdirectories === true) {
			if (this.glob.indexOf("**/") !== 0) {
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

		if (this.enable === false) {
			this.finished = true;
			return this.onFinish();
		}

		const foundList = await this.getTaskFiles();
		this.parseTasksFromFile(foundList);
	}

	public async getTaskFiles() {
		try {
			const foundList = await vscode.workspace.findFiles(this.glob, this.excludesGlob);
			return foundList;
		}
		catch {
			return [];
		}
	}

	public async parseTasksFromFile(fileList: vscode.Uri[]) {
		if (!Array.isArray(fileList) || fileList.length === 0) {
			return this.onFinish();
		}

		async.each(fileList, async (item, callback) => {
			const file = await vscode.workspace.openTextDocument(item.fsPath);
			this.handleFunc(file, callback);
		}, (err) => this.onFinish(err));
	}

	public handleFunc(file: any, callback: Function) {
		callback();
	}

	public reload() {
		this.finished = false;
		this.taskList = [];

		setTimeout(this.loadTask.bind(this), 10);
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
		if (watchPath.indexOf("**/") !== 0) {
			watchPath = "**/" + watchPath;
		}

		const watcher = vscode.workspace.createFileSystemWatcher(watchPath, false, ignoreChange, false);

		watcher.onDidCreate(this.onChanged);
		watcher.onDidChange(this.onChanged);
		watcher.onDidDelete(this.onChanged);

		return watcher;
	}

	public onChanged() {
		this.reload();
	}
}

export default TaskLoader;
