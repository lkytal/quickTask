import { retry } from "async";

class ListManager {
	protected taskArray = [];

	constructor(protected loaderList) {
	}

	public getTaskArray() {
		let list = [];

		for (const loader of this.loaderList) {
			list = list.concat(loader.taskList);
		}

		return Array.from(new Set(list));
	}

	public refresh() {
		this.taskArray = this.getTaskArray();
	}

	public isEmpty() {
		this.refresh();

		return this.taskArray.length === 0;
	}

	public getLabelList() {
		this.refresh();

		this.taskArray.sort(this.taskOrder);

		const labels = [];

		for (const item of this.taskArray) {
			labels.push({
				description: item.description,
				label: item.label
			});
		}

		return labels;
	}

	public findTask(selection, description) {
		for (const item of this.taskArray) {
			if (item.label === selection && item.description === description) {
				return item;
			}
		}

		return null;
	}

	protected taskOrder(a, b) {
		let order = a.workspace.localeCompare(b.workspace);

		if (order === 0) {
			order = a.type.localeCompare(b.type);
		}

		if (order === 0) {
			order = a.label.localeCompare(b.label);
		}

		return order;
	}
}

export = ListManager;
