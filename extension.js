'use strict';
var vscode = require('vscode');

function activate(context) {
	var config = vscode.workspace.getConfiguration('quicktask');
	var glob = '**/*.{sh,py,rb,ps1,pl,bat}';
	var cmdsList = [];
	var _statusBarItem;
	var tId;
	var gulpScan = false;
	var npmScan = false;
	var scriptScan = 0;

	// Create StatusBar.
	_statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	_statusBarItem.text = _statusBarItem.tooltip = '$(search) Scanning Tasks...';
	_statusBarItem.show();

	var LoadTask = function (configKey, list, handleFunc) {
		if (configKey) {
			vscode.workspace.findFiles(list, config.excludesGlob).then(handleFunc);
		}
	}

	LoadTask(config.enableGulp, config.gulpGlob, function (file) {
		gulpScan = true;
		parseTasksFromFile(file, buildGulpCmds);
	});
	LoadTask(config.enableNpm, config.npmGlob, function (file) {
		npmScan = true;
		parseTasksFromFile(file, buildPackageCmds);
	});
	LoadTask(1, glob, function (file) {
		scriptScan += 1;
		parseFile(file);
	});

	function getCmds() {
		return cmdsList.sort();
	}

	// Builds gulp tasks array.
	function buildGulpCmds(file) {
		var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
		var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;

		if (typeof file === 'object') {
			var tmpList = file.getText().match(regexpMatcher);

			for (var i = 0; i < tmpList.length; ++i) {
				cmdsList[i] = 'gulp ' + tmpList[i].replace(regexpReplacer, "$1");
			}
		}
	}

	// Builds package tasks object.
	function buildPackageCmds(file) {
		if (typeof file === 'object') {
			var pattern = JSON.parse(file.getText());

			if (typeof pattern.scripts === 'object') {
				for (var item in pattern.scripts) {
					cmdsList.push('npm run ' + item);
				}
			}
		}
	}
	// Builds script tasks object.
	function buildCmds(file, exec) {
		if (typeof file === 'object') {
			//var scriptPath = file.uri._fsPath.replace(vscode.workspace.rootPath + '/', exec);
			//cmdsList.push(scriptPath);
			cmdsList.push(exec + file.uri._fsPath);
		}
	}

	function parseTasksFromFile(file, handleFunc) {
		if (Array.isArray(file) && file.length >= 1) {
			for (var i = 0; i < file.length; i++) {
				vscode.workspace.openTextDocument(file[i].fsPath).then(function (file) {
					handleFunc(file);
				});
			}
		}
	}

	// Read File.
	function parseFile(file) {
		parseTasksFromFile(file, function (file) {
			if (file.languageId === 'shellscript' && config.enableShell) {
				buildCmds(file, '. ');
			}
			else if (file.languageId === 'python' && config.enablePython) {
				buildCmds(file, 'python ');
			}
			else if (file.languageId === 'ruby' && config.enableRuby) {
				buildCmds(file, 'ruby ');
			}
			else if (file.languageId === 'powershell' && config.enablePowershell) {
				buildCmds(file + '"', '& "');
			}
			else if (file.languageId === 'perl' && config.enablePerl) {
				buildCmds(file, 'perl ');
			}
			else if (file.languageId === 'bat')
			{
				buildCmds(file, 'cmd ');
			}
		});
	}

	function buildStatusBar() {
		var options = {
			placeHolder: 'Select a Task to Run...'
		};

		// Register cmd for showing tasks.
		vscode.commands.registerCommand('quicktask.showTasks', function () {
			vscode.window.showQuickPick(getCmds(), options).then(function (result) {
				if (typeof result === 'undefined' || cmdsList.length < 1) {
					return;
				}

				var terminal = vscode.window.createTerminal();
				if (config.showTerminal) {
					terminal.show();
				}
				if (config.closeTerminalafterExecution) {
					terminal.sendText(result + "\nexit");
				}
				else {
					terminal.sendText(result);
				}
				vscode.window.setStatusBarMessage(`Task ${result} started`, 3000);
			});
		});

		// Loading configuration variables.
		if (cmdsList.length >= 1) {
			_statusBarItem.text = '$(clippy) Tasks';
			_statusBarItem.tooltip = 'Select a Task to Run';
			_statusBarItem.command = 'quicktask.showTasks';
			_statusBarItem.show();
		}
		else
		{
			_statusBarItem.text = '$(clippy) No Task';
		}
	}

	function checkMoreTasks() {
		if (gulpScan && npmScan && cmdsList.length >= scriptScan) {
			clearTimeout(tId);
			buildStatusBar();
		}
		else {
			tId = setTimeout(checkMoreTasks, 5000);
		}
	}

	tId = setTimeout(checkMoreTasks, 2000);
}

function deactivate() {
	console.log('QuickTask disabled.');
}

exports.activate = activate;
exports.deactivate = deactivate;
