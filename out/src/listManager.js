"use strict";
class listManager {
    constructor(loaderList) {
        this.loaderList = loaderList;
        this.taskArray = [];
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
    getLabelList() {
        this.refresh();
        this.taskArray = this.taskArray.sort(function (a, b) {
            let order = a.type.localeCompare(b.type);
            if (order == 0) {
                order = a.description.localeCompare(b.description);
            }
            if (order == 0) {
                order = a.label.localeCompare(b.label);
            }
            return order;
        });
        let labels = [];
        for (let item of this.taskArray) {
            labels.push({
                label: item.label,
                description: item.description
            });
        }
        return labels;
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