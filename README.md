# Quick Task for VS Code

[![Version](https://img.shields.io/visual-studio-marketplace/v/lkytal.quicktask)](https://ci.appveyor.com/project/lkytal/quicktask)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/lkytal.quicktask)](https://marketplace.visualstudio.com/items?itemName=lkytal.quicktask)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/lkytal.quicktask)](https://marketplace.visualstudio.com/items?itemName=lkytal.quicktask)

> Install [Quick Task](https://marketplace.visualstudio.com/items?itemName=lkytal.quicktask) via vs market

## All in one task manager and runner for Gulp, NPM, VS Code tasks and shell scripts

Quick Task will automatically trawl your project directory for task files from npm, gulp, scripts files and VS Code tasks, and allow you to execute each task with the click of a mouse!

As shown below, all tasks will show up after clicking the task button on the status bar and you can execute any item simply by clicking on it.

## Highlights

- Auto rescan after task files changed/added/deleted.
- Support VS Code task.
- Allow you to close terminal window automatically after execution. (experimental)

![Preview](assets/screenshot.png)

Hint: Task button is usually here:

![Preview](assets/button.png)

## Support Tasks

- NPM Tasks.
- Gulp Tasks.
- VS Code Tasks.
- Shell Scripts.
- Python Scripts.
- Ruby Scripts.
- Perl Scripts.
- VBS Scripts.
- AutoHotkey Scripts.
- batch file and Powershell Scripts.

## My Other Extensions

- ### [FlatUI](https://marketplace.visualstudio.com/items?itemName=lkytal.FlatUI)
- ### [Pomodoro](https://marketplace.visualstudio.com/items?itemName=lkytal.pomodoro)
- ### [Coffee Lint](https://marketplace.visualstudio.com/items?itemName=lkytal.coffeelinter)
- ### [Translator Plus](https://marketplace.visualstudio.com/items?itemName=lkytal.translatorplus)

## Release Notes

### [3.5.8] - 2023-05-24

#### Fixed

- Respect `hide` property of task.json.

### [3.5.4] - 2019-01-13

#### Fixed

- Quote path of script tasks.

### [3.5.3] - 2018-09-28

#### Fixed

- Subdirectory gulp tasks.

### [3.5.2] - 2018-09-26

#### Feature

- Tentative support towards 'gulpfile.ts'.

### [3.5.1] - 2018-08-31

#### Fixed

- Fixed problems when VSCode tasks file doesn't exist.

### [3.5.0] - 2018-08-17

#### Fixed

- Load VSCode tasks when '.vscode' folder is hidden.

### [3.4.4] - 2018-07-28

#### Improve

- New command 'Rerun last task'.

### [3.4.3] - 2018-05-31

#### Update

- Update dependency

### [3.4.2] - 2018-04-26

#### Improve

- Use JSON5 to parse VSCode tasks.

### [3.4.1] - 2018-03-11

#### Fixed

- Fix incorrect path for user defined tasks.

### [3.4.0] - 2018-03-10

#### Improve

- Refact code.

### [3.3.3] - 2018-01-10

#### Fixed

- Fix path error for user defined tasks.

### [3.3.2] - 2017-12-15

#### Fixed

- Fix rescan doesn't work.

### [3.3.1] - 2017-11-27

#### Improve

- Combined information of workspace and path.

### [3.3.0] - 2017-11-20

#### Improve

- Group tasks by workspace.

### [3.2.0] - 2017-11-15

#### Fixed

- Indicate path for VSCode tasks.

- React to workspace remove events.

### [3.1.3] - 2017-11-13

#### Fixed

- Sometimes gulp file cannot be found.

- Capitalized path on windows.

### [3.1.2] - 2017-11-10

#### Fixed

- Absolute path.

### [3.1.1] - 2017-11-10

#### Fixed

- Incorrect relative path.

### [3.1.0] - 2017-11-09

#### Fixed

- Support Multi Root Workspace.

### [3.0.3] - 2017-10-31

#### Added

- Better message displaying when start a new task.

### [3.0.2] - 2017-10-11

#### Added

- Reload when not found.

### [3.0.1] - 2017-10-06

#### Improve

- Fix typo.

### [3.0.0] - 2017-08-10

#### Added

- Support gulpfile.babel.js.

#### Fixed

- Incorrect "cd" command.

### [2.9.1] - 2017-08-07

#### Improve

- Description for subdirectory tasks.

### [2.9.0] - 2017-08-05

#### Improve

- Support Npm and Gulp task in subdirectories.

### [2.8.1] - 2017-07-10

#### Update

- Update async lib to 2.5.0

### [2.7.0] - 2017-05-20

#### Improve

- Show task started message within the status icon.

### [2.6.1] - 2017-05-01

#### Improve

- Update Async lib.
- ".vscode-test" excluded.

### [2.6.0] - 2017-04-16

#### Improve

- Better performance.

### [2.5.1] - 2017-04-08

#### Fixed

- Read VSCode task list.
- Watch Task file change.

### [2.5.0] - 2017-04-04

#### Fixed

- Close the terminal window automatically after execution correctly.

### [2.4.2] - 2017-03-26

#### Added

- Support VS code default task.

### [2.4.1] - 2017-03-22

#### Fixed

- Generate default task correctly.

### [2.4.0] - 2017-03-18

#### Added

- Option to use yarn instead of npm.

### [2.3.1] - 2017-03-18

#### Fixed

- Script files can now execute correctly.

### [2.3.0] - 2017-03-17

#### Added

- Ability to scan for VSCode tasks (those in tasks.json).

#### Fixed

- Batch file config item.

### [2.2.2] - 2017-03-13

#### Fixed

- Tiny fixes.

### [2.2.0] - 2017-03-07

#### Added

- "defaultTask" option to add your own default tasks.

### [2.1.3] - 2017-03-02

#### Changed

- Separate rescan process of npm and gulp.

### [2.1.2] - 2017-02-28

#### Changed

- ".vbs" and ".ahk" included.

#### Fixed

- Other duplicated items.

### [2.1.1] - 2017-02-24

#### Changed

- Show error message when task loading failed.
- ".Cmd" included.

#### Fixed

- Duplicated items.

### [2.1.0] - 2017-02-22

#### Changed

- Instant reaction towards task changes.

### [2.0.1] - 2017-02-21

#### Changed

- Better performance during rescan.

#### Fixed

- Execute batch files and shell scripts correctly.

### [2.0.0] - 2017-02-18

#### Added

- Option to watch for task changes.

### [1.2.0] - 2017-02-18

#### Added

- Option to close terminal after execution finished. (experimental)

### [1.1.0] - 2017-02-16

#### Added

- Option to control show terminal or not.

#### Fixed

- Task scanning loop.

### [1.0.0] - 2017-02-16

- First release.

## Acknowledgment

> Inspired by [Task Master](https://marketplace.visualstudio.com/items?itemName=ianhoney.task-master), this extension started by forking it at first.
> <div>Icons made by <a href="https://www.flaticon.com/authors/vectors-market" title="Vectors Market">Vectors Market</a> from <a href="https://www.flaticon.com" title="Flaticon">www.flaticon.com</a> is licensed by <a href="https://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>
