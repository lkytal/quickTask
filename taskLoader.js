"use strict";
const vscode = require("vscode");
const async = require('async');

class taskLoader {
	constructor(name, data, config, findSyntex) {
		this.name = name;
		this.data = data;
		this.config = config;
		this.findSyntex = findSyntex;

		this.finished = false;
	}

	get finished() {
		return this.data.flag[this.name];
	}
	set finished(value) {
		this.data.flag[this.name] = value;
	}

	get taskList() {
		return this.data.task[this.name];
	}
	set taskList(value) {
		this.data.task[this.name] = value;
	}

	parseTasksFromFile(fileList, handleFunc, onFinish) {
		if (!Array.isArray(fileList)) return;

		if (fileList.length == 0) {
			return onFinish();
		}

		async.each(fileList, function (item, callback) {
			vscode.workspace.openTextDocument(item.fsPath).then(function (file) {
				handleFunc(file, this.taskList);
				return callback();
			});
		}, onFinish);
	}

	loadTasks(enableFlag, handleFunc, onFinish) {
		if (!enableFlag) {
			this.finished = true
			return;
		}

		this.finished = false;

		vscode.workspace.findFiles(this.findSyntex, this.config.excludesGlob).then(function (foundList) {
			this.parseTasksFromFile(foundList, handleFunc, function (err) {
				if (err) {
					vscode.window.showInformationMessage("Error when scanning tasks.");
					return;
				}

				this.finished = true;

				onFinish();
			});
		});
	}
}

module.exports = taskLoader;
