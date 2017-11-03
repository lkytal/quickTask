"use strict";
class listManager {
    constructor(loaderList) {
        this.loaderList = [];
        this.taskArray = [];
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
        return this.taskArray.length == 0;
    }
    getList() {
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
module.exports = listManager;
//# sourceMappingURL=listManager.js.map