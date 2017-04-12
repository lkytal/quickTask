let should = require("chai").should();
let vscode = require('vscode');
let loaders = require('../loaders.js');

suite("taskLoader", function () {
	test("Run", function (done) {
		console.log(vscode.workspace.rootPath);

		let check = function() {
			test.taskList.length.should.equal(0);
			done();
		}

		let test = new loaders.npmLoader({
			npmGlob: ["**/package.json"],
			enableNpm: 1,
			excludeGlob: "**/node_modules",
			useYarn: false
		}, check);

		test.loadTask();
	});
});
