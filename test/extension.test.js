let path = require('path');
let fs = require('fs');
let util = require('util');
let chai = require("chai");
let vscode = require("vscode");
let loaders = require('../out/src/loaders.js');

chai.should();

let rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

function fullPath(p) {
	return path.join(rootPath, p);
}

let globalConfig = {
	excludesGlob: "**/{node_modules,.vscode-test,.git}",
	npmGlob: "package.json",
	searchTaskFileInSubdirectories: false,
	enableNpm: 1,
	useYarn: false,
	gulpGlob: "gulpfile{,.babel}.js",
	enableGulp: 1,
	enableVsTasks: 1,
	enableBatchFile: true,
	enablePython: true,
	defaultTasks: []
};

function loaderTest(done, builder, type, list, filePath = null, description = null) {
	let fileUri;

	if (util.isNullOrUndefined(filePath)) {
		fileUri = vscode.workspace.workspaceFolders[0].uri;
	}
	else {
		fileUri = vscode.Uri.file(path.join(rootPath, filePath));
	}

	let check = function () {
		let rst = loaders.generateFromList(type, list, fileUri, description);
		try {
			tester.taskList.should.be.eql(rst);
		}
		catch (e) {
			throw 'expecting: ' + JSON.stringify(rst) + '\nbut get: ' + JSON.stringify(tester.taskList);
		}

		done();
	}

	let tester = new builder(globalConfig, check);

	tester.loadTask();
}

function watcherTest(done, builder, taskFile) {
	let test = new builder(globalConfig, () => console.log("On finish"));

	test.onChanged = function () {
		watcher.dispose();
		done();
	}

	let watcher = test.setupWatcher();

	let content = fs.readFileSync(path.join(rootPath, taskFile), "utf-8");
	fs.writeFileSync(path.join(rootPath, taskFile), content, "utf-8");
}

suite("Npm", function () {
	this.timeout(10000);

	test("Npm loader", function (done) {
		let rst = [
			"npm run postinstall",
			"npm run test"
		];

		loaderTest(done, loaders.NpmLoader, "npm", rst, "package.json");
	});

	test("Npm watcher", function (done) {
		watcherTest(done, loaders.NpmLoader, "package.json");
	});
});

suite("gulp", function () {
	this.timeout(10000);

	test("gulp loader", function (done) {
		let rst = [
			"gulp legacy",
			"gulp watch",
			"gulp copy",
			"gulp default"
		];

		//fs.renameSync(rootPath + "gulpfile.babel.js", rootPath + "gulp.bk");
		loaderTest(done, loaders.GulpLoader, "gulp", rst, "gulpfile.js");
		//fs.renameSync(rootPath + "gulp.bk", rootPath + "gulpfile.babel.js");
	});

	test("gulp watcher", function (done) {
		watcherTest(done, loaders.GulpLoader, "gulpfile.js");
	});
});

suite("vs loader", function () {
	test("VS first load", function (done) {
		let rst = ["run", "test"];

		loaderTest(done, loaders.VSLoader, "vs", rst, ".vscode\\tasks.json");
	});

	test("VS watcher", function (done) {
		watcherTest(done, loaders.VSLoader, ".vscode\\tasks.json");
	});
});

suite("script", function () {
	this.timeout(10000);

	let testBat = path.join(rootPath, "a.bat");

	try {
		//fs.accessSync(testBat, fs.constants.F_OK);
		fs.unlinkSync(testBat);
	}
	catch (e) { }

	test("script loader", function (done) {
		let rst = ["cmd.exe /c " + path.join(rootPath, "test.bat"),
		"python " + path.join(rootPath, "test.py")];

		loaderTest(done, loaders.ScriptLoader, "script", rst);
	});

	test("script watcher", function (done) {
		let test = new loaders.ScriptLoader(globalConfig, () => console.log("On finish"));

		test.onChanged = function () {
			fs.unlinkSync(testBat);
			watcher.dispose();
			done();
		}

		let watcher = test.setupWatcher();
		fs.writeFileSync(testBat, "test" + Date.now(), "utf-8");
	});
});

suite("user", function () {
	test("user loader", function () {
		let realDefaultTasks = vscode.workspace.getConfiguration('quicktask').get("defaultTasks");
		globalConfig.defaultTasks = realDefaultTasks;

		let check = function () {
			let rst = loaders.generateFromList("user", globalConfig.defaultTasks, null, "User Defined Tasks");
			test.taskList.should.eql(rst);
		}

		let test = new loaders.DefaultLoader(globalConfig, check);

		test.loadTask();
	});

	test("user watcher", function (done) {
		let test = new loaders.DefaultLoader(globalConfig, () => console.log('test user load'));

		test.onChanged = function () {
			done();
		}

		let watcher = test.setupWatcher();

		let cfg = ["npm update", "npm i --save-dev", "npm run test"];
		vscode.workspace.getConfiguration('quicktask').update("defaultTasks", cfg, false);
	});
});
