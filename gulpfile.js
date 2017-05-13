var del = require('del');

var gulp = require('gulp');
var babel = require('gulp-babel');
var changed = require('gulp-changed');
var nodemon = require('gulp-nodemon');
var plumber = require('gulp-plumber');
var sourcemaps = require('gulp-sourcemaps');
var eslint = require('gulp-eslint');

var runSequence = require('run-sequence');
var vinylPaths = require('vinyl-paths');

/*
  Task to clean up dist-server directory
 */
gulp.task('clean', function() {
  return gulp.src(['dist-server'])
    .pipe(vinylPaths(del));
});

gulp.task('eslint', function () {
  return gulp.src('src-server/**/*.js')
  .pipe(eslint())
  .pipe(eslint.format())
  .pipe(eslint.failAfterError());
});

/*
  Task to compile server js code with babel
 */
gulp.task('build-server-js', ['eslint'], function () {
  var compilerOptions = {
    modules: 'common',
    moduleIds: false,
    comments: false,
    compact: false,
    stage:2,
    optional: ["es7.decorators", "es7.classProperties"]
  };
  return gulp.src('src-server/**/*.js')
    .pipe(plumber())
    .pipe(changed('dist-server/', {extension: '.js'}))
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write({includeContent: false, sourceRoot: '/src-server/' }))
    .pipe(gulp.dest('dist-server/'));
});


/*
  Task to clean and build the entire application
 */
gulp.task('build', function(callback) {
  return runSequence(['build-server-js'], callback);
});

gulp.task('watch', ['build'], function () {
  nodemon({
    watch: ['./src-server'],
    ext: 'js',
    // script: './dist-server/server.js',
    tasks: ['build']
  });
});

/*
  Task to start up the server in debug mode with nodemon and
  rebuild/restart if any source changes
 */
gulp.task('debug', ['build'], function () {
  nodemon({
    watch: ['./src-server'],
    ext: 'html',
    script: './dist-server/server.js',
    tasks: ['build'],
    env: { 'DEBUG' : 'socket*' }
  });
});


gulp.task('default', ['watch']);
