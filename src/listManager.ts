"use strict";

class listManager {
	protected taskArray = [];

	constructor(protected loaderList) {
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

	getLabelList() {
		this.refresh();

		let labels = [];

		for (let item of this.taskArray) {
			labels.push({
				label: item.label,
				description: item.description
			});
		}

		return labels.sort(function (a, b) {
			return a.label.localeCompare(b.label);
		});
	}

	findTask(selection, description) {
		for (let item of this.taskArray) {
			if (item.label == selection && item.description == description) {
				return item;
			}
		}

		return null;
	}
}

export = listManager;
