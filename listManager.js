"use strict";

class listManager {
	constructor(loaderList) {
		this.loaderList = loaderList;

		this.taskArray = [];

		this.getTaskArray();
	}

	getTaskArray() {
		let list = [];

		for (let loader of this.loaderList) {
			list = list.concat(loader.taskList);
		}

		return Array.from(new Set(list));
	}

	refresh() {
		this.taskArray = this.getTaskArray();
	}

	isEmpty() {
		this.refresh();

		return this.taskArray.length == 0
	}

	getLabels() {
		let labels = [];

		for (let item of this.taskArray) {
			labels.push(item.label);
		}

		return labels.sort();

		// .sort(function (a, b) {
		// 	return a.localeCompare(b);
		// });
	}

	findTask(selection) {
		for (let item of this.taskArray) {
			if (item.label == selection) {
				return item;
			}
		}

		return null;
	}
}

module.exports = listManager;
