"use strict";
const vscode = require("vscode");
const async = require('async');

class taskLoader {
	constructor(data, config, onFinish) {
		this.data = data;
		this.config = config;
		this.onFinish = onFinish;
	}

	parseTasksFromFile(fileList, handleFunc, onFinish) {
		if (!Array.isArray(fileList)) return;

		if (fileList.length == 0) {
			return onFinish();
		}

		async.each(fileList, function (item, callback) {
			vscode.workspace.openTextDocument(item.fsPath).then(function (file) {
				handleFunc(file);
				return callback();
			});
		}, onFinish);
	}

	loadTasks(findSyntex, handleFunc, key) {
		if (this.data.enable[key] == false) {
			this.data.flags[key] = true;
			return;
		}

		this.data.flags[key] = false;
		this.data.taskList[key] = [];

		vscode.workspace.findFiles(findSyntex, this.config.excludesGlob).then(function (foundList) {
			this.parseTasksFromFile(foundList, handleFunc, function (err) {
				if (err) {
					vscode.window.showInformationMessage("Error when scanning tasks of" + key);
					this.data.taskList[key] = [];
				}

				this.data.flags[key] = true;
				this.finishScan();
			});
		});
	}

	loadTask(key) {
		this.loadTasks(this.data.glob[key], this.data.handler[key], key);
	}
}

module.exports = taskLoader;
