import * as vscode from "vscode";
import { ITask } from "./ITask";
import TaskLoader from "./taskLoader";

class ListManager {
	protected taskArray: ITask[] = [];

	constructor(protected loaderList: TaskLoader[]) {
	}

	public getTaskArray() {
		let list: ITask[] = [];

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

		const labels: vscode.QuickPickItem[] = [];

		for (const item of this.taskArray) {
			labels.push({
				description: item.description,
				label: item.label
			});
		}

		return labels;
	}

	public findTask(selection: string, description: string) {
		for (const item of this.taskArray) {
			if (item.label === selection && item.description === description) {
				return item;
			}
		}

		return null;
	}

	protected taskOrder(a: ITask, b: ITask) {
		let order = a.workspace.localeCompare(b.workspace);

		if (order === 0) {
			order = a.type.localeCompare(b.type);
		}

		if (order === 0) {
			order = a.filePath.localeCompare(b.filePath);
		}

		if (order === 0) {
			order = a.label.localeCompare(b.label);
		}

		return order;
	}
}

export default ListManager;
