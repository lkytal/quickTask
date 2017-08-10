'use strict';

import gulp from 'gulp';

export function babel() {
	return;
}

export function series() {
	gulp.series(babel, function() {
		return;
	});
}
