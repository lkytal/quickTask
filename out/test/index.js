"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const path = require("path");
const Mocha = require("mocha");
const glob = require("glob");
function run() {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd'
    });
    // mocha.useColors(true);
    const testsRoot = path.resolve(__dirname, '.');
    return new Promise((c, e) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) {
                console.log('glob err: ' + err);
                return e(err);
            }
            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
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
//# sourceMappingURL=index.js.map