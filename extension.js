'use strict';
var vscode = require('vscode');
function activate(context) {
    var config = vscode.workspace.getConfiguration('task-master');
    var glob = '**/*.{sh,py,rb,ps1,pl}';
    var cmdsList = [];
    var _statusBarItem;
    var tId;
    var loadingString = '$(search) Scanning Tasks...';
    var gulpScan = false;
    var npmScan = false;
    var scriptScan = 0;

    // Create StatusBar.
    _statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    _statusBarItem.text = loadingString;
    _statusBarItem.tooltip = loadingString;
    _statusBarItem.show();

    // Check if gulpfile exists in project.
    if (config.enableGulp) {
        vscode.workspace.findFiles(config.gulpGlob, config.excludesGlob).then(function (file) {
            readGulpFile(file);
            gulpScan = true;
        });
    }
    // Check if package.json exists in project.
    if (config.enableNpm) {
        vscode.workspace.findFiles(config.npmGlob, config.excludesGlob).then(function (file) {
            readPackageFile(file);
            npmScan = true;
        });
    }
    // Check if scripts exists in project.
    vscode.workspace.findFiles(glob, config.excludesGlob).then(function (file) {
        scriptScan = scriptScan + 1;
        readFile(file);
    });

    tId = setInterval(doCmdsExist, 5000);
    function doCmdsExist() {
        var response = false;
        if (gulpScan && npmScan && cmdsList.length >= scriptScan) {
            response = true;
            clearInterval(tId);
            buildStatusBar();
        }
        else {
            response = false;
        }
        return response;
    }
    function getCmds() {
        return cmdsList.sort();
    }
    // Builds gulp tasks array.
    function buildGulpCmds(file) {
        var regexpMatcher = /gulp\.task\([\'\"][^\'\"]*[\'\"]/gi;
        var regexpReplacer = /gulp\.task\([\'\"]([^\'\"]*)[\'\"]/;
        cmdsList = file.getText().match(regexpMatcher);
        if (typeof file === 'object') {
            for (var i = 0; i < cmdsList.length; ++i) {
                if (cmdsList[i].match(regexpMatcher)) {
                    cmdsList[i] = 'gulp ' + cmdsList[i].replace(regexpReplacer, "$1");
                }
            }
        }
    }
    // Builds package tasks object.
    function buildPackageCmds(file) {
        if (typeof file === 'object') {
            // Parse package.json for tasks and place into array.
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
            if (file.languageId === 'powershell') {
                file.uri._fsPath = file.uri._fsPath + '"';
            }
            var scriptPath = file.uri._fsPath.replace(vscode.workspace.rootPath + '/', exec);
            cmdsList.push(scriptPath);
        }
    }
    // Read GulpFile.js.
    function readGulpFile(file) {
        if (Array.isArray(file) && file.length >= 1) {
            for (var i = 0; i < file.length; i++) {
                vscode.workspace.openTextDocument(file[i].fsPath).then(function (file) {
                    buildGulpCmds(file);
                });
            }
        }
    }
    // Read Package.json file.
    function readPackageFile(file) {
        if (Array.isArray(file) && file.length >= 1) {
            for (var i = 0; i < file.length; i++) {
                vscode.workspace.openTextDocument(file[i].fsPath).then(function (file) {
                    buildPackageCmds(file);
                });
            }
        }
    }
    // Read File.
    function readFile(file) {
        if (Array.isArray(file) && file.length >= 1) {
            for (var i = 0; i < file.length; i++) {
                vscode.workspace.openTextDocument(file[i].fsPath).then(function (file) {
                    if (file.languageId === 'shellscript' && config.enableShell) {
                        buildCmds(file, '. ');
                    }
                    if (file.languageId === 'python' && config.enablePython) {
                        buildCmds(file, 'python ');
                    }
                    if (file.languageId === 'ruby' && config.enableRuby) {
                        buildCmds(file, 'ruby ');
                    }
                    if (file.languageId === 'powershell' && config.enablePowershell) {
                        buildCmds(file, '& "');
                    }
                    if (file.languageId === 'perl' && config.enablePerl) {
                        buildCmds(file, 'perl ');
                    }
                });
            }
        }
    }
    function buildStatusBar() {
        // Create StatusBar.
        if (!_statusBarItem) {
            _statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        }

        var options = {
            placeHolder: 'Select a Task to Run...'
        };
        // Register cmd for showing tasks.
        vscode.commands.registerCommand('quicktask.showTasks', function () {
            vscode.window.showQuickPick(getCmds(), options).then(function (result) {
                if (typeof result !== 'undefined' && cmdsList.length >= 1) {
                    var terminal = vscode.window.createTerminal();
                    terminal.sendText(result);
                }
            });
        });
        // Loading configuration variables.
        if (cmdsList.length >= 1) {
            _statusBarItem.text = '$(clippy) Tasks';
            _statusBarItem.tooltip = 'Select a Task to Run';
            _statusBarItem.command = 'quicktask.showTasks';
            _statusBarItem.show();
        }
    }
}
exports.activate = activate;
function deactivate() {
    console.log('Task Master disabled.');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map