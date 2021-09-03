"use strict";
exports.__esModule = true;
exports.run = void 0;
var path = require("path");
var Mocha = require("mocha");
var glob = require("glob");
function run() {
    // Create the mocha test
    var mocha = new Mocha({
        ui: 'tdd'
    });
    // mocha.useColors(true);
    var testsRoot = path.resolve(__dirname, '.');
    return new Promise(function (c, e) {
        glob('**/**.test.js', { cwd: testsRoot }, function (err, files) {
            if (err) {
                console.log('glob err: ' + err);
                return e(err);
            }
            // Add files to the test suite
            files.forEach(function (f) { return mocha.addFile(path.resolve(testsRoot, f)); });
            try {
                // Run the mocha test
                mocha.run(function (failures) {
                    if (failures > 0) {
                        e(new Error(failures + " tests failed."));
                    }
                    else {
                        c();
                    }
                });
            }
            catch (err) {
                console.log('test error ' + err);
                e(err);
            }
        });
    });
}
exports.run = run;
