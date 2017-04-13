let chai = require("chai");
let vscode = require('vscode');
let loaders = require('../loaders.js');

chai.should();

let rootPath = vscode.workspace.rootPath;

let globalConfig = {
	excludeGlob: "**/node_modules",
	npmGlob: ["**/package.json"],
	enableNpm: 1,
	useYarn: false,
	gulpGlob: ["**/gulpfile.js"],
	enableGulp: 1,
	enableVsTasks: 1,
	enableBatchFile: true
};

function loaderTest(done, builder, type, rst) {
	let check = function () {
		let list = loaders.generateFromList(rst, type);
		list.should.be.eql(test.taskList);

		//let assert = require('assert');
		// for (let i of list.keys()) {
		// 	assert.deepEqual(list[i], test.taskList[i]);
		// }

		done();
	}

	let test = new builder(globalConfig, check);

	test.loadTask();
}

suite("Npm loader", function () {
	this.timeout(5000);

	test("Npm", function (done) {
		let rst = [
			"npm run postinstall",
			"npm run test"
		];

		loaderTest(done, loaders.npmLoader, "npm", rst);
	});
});

suite("gulp loader", function () {
	test("Gulp", function (done) {
		let rst = [
			"gulp watch",
			"gulp default",
			"gulp copy"
		];

		loaderTest(done, loaders.gulpLoader, "gulp", rst);
	});
});

suite("vs loader", function () {
	test("VS", function (done) {
		let rst = ["run", "test"];

		loaderTest(done, loaders.vsLoader, "vs", rst);
	});
});

suite("script loader", function () {
	test("Script", function (done) {
		let rst = [rootPath + "\\test.bat"];

		loaderTest(done, loaders.scriptLoader, "script", rst);
	});
});

suite("user loader", function () {
	test("user", function () {
		//let cfg = ["npm update", "npm i --save-dev"];
		let check = function () {
			let cfg = vscode.workspace.getConfiguration('quicktask').get("defaultTasks");
			test.taskList.should.eql(loaders.generateFromList(cfg, "user"));
		}

		let test = new loaders.defaultLoader(globalConfig, check);

		test.loadTask();
	});
});
