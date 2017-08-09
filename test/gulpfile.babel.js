import gulp from 'gulp'

export function babel() {}
export function watch() {}
export const copy = () => gulp.parallel(watch, function() {})
export default () => gulp.parallel(babel, watch)
