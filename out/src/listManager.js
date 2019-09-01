"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ListManager {
    constructor(loaderList) {
        this.loaderList = loaderList;
        this.taskArray = [];
    }
    getTaskArray() {
        let list = [];
        for (const loader of this.loaderList) {
            list = list.concat(loader.taskList);
        }
        return Array.from(new Set(list));
    }
    refresh() {
        this.taskArray = this.getTaskArray();
    }
    isEmpty() {
        this.refresh();
        return this.taskArray.length === 0;
    }
    getLabelList() {
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
    findTask(selection, description) {
        for (const item of this.taskArray) {
            if (item.label === selection && item.description === description) {
                return item;
            }
        }
        return null;
    }
    taskOrder(a, b) {
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
exports.default = ListManager;
//# sourceMappingURL=listManager.js.map