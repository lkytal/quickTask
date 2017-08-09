let gulp = require('gulp');

gulp.task('coffee', function () {});
gulp.task('watch', function () {});
gulp.task('default', ['coffee', 'watch']);
gulp.task('copy', ['watch'], function () {});
