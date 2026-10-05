"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

var APP_JS_FILES = ["app/assets/js/**/*.js", "config/**/*.js", "app/data/**/*.js",
    "app/routes/**/*.js", "app/security/**/*.js", "app/application.js", "server.js"
];

var SUPPORT_JS_FILES = ["Gruntfile.js", "artifacts/**/*.js", "test/**/*.js"];

var JS_FILES = APP_JS_FILES.concat(SUPPORT_JS_FILES);


module.exports = function(grunt) {
    // Project Configuration
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        watch: {
            js: {
                files: APP_JS_FILES,
                tasks: ["jshint"],
                options: {
                    livereload: true
                }
            },
            support: {
                files: SUPPORT_JS_FILES,
                tasks: ["jshint"]
            },
            html: {
                files: ["app/views/**"],
                options: {
                    livereload: true
                }
            },
            css: {
                files: ["app/assets/css/**"],
                options: {
                    livereload: true
                }
            }
        },
        jshint: {
            all: JS_FILES,
            options: {
                jshintrc: true
            }
        },
        jsbeautifier: {
            files: JS_FILES.concat(["app/views/**", "app/assets/css/**"]),
            options: {
                html: {
                    braceStyle: "collapse",
                    indentChar: " ",
                    indentScripts: "keep",
                    indentSize: 4,
                    maxPreserveNewlines: 10,
                    preserveNewlines: true,
                    unformatted: ["a", "sub", "sup", "b", "i", "u", "pre"],
                    wrapLineLength: 0
                },
                css: {
                    indentChar: " ",
                    indentSize: 4
                },
                js: {
                    braceStyle: "collapse",
                    breakChainedMethods: false,
                    e4x: false,
                    evalCode: false,
                    indentChar: " ",
                    indentLevel: 0,
                    indentSize: 4,
                    indentWithTabs: false,
                    jslintHappy: false,
                    keepArrayIndentation: false,
                    keepFunctionIndentation: false,
                    maxPreserveNewlines: 10,
                    preserveNewlines: true,
                    spaceBeforeConditional: true,
                    spaceInParen: false,
                    unescapeStrings: false,
                    wrapLineLength: 0
                }
            }
        },
        concurrent: {
            tasks: ["nodemon", "watch"],
            options: {
                logConcurrentOutput: true
            }
        },
        env: {
            test: {
                NODE_ENV: "test"
            }
        },


    });

    // Load NPM tasks
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-nodemon");
    grunt.loadNpmTasks("grunt-concurrent");
    grunt.loadNpmTasks("grunt-env");
    grunt.loadNpmTasks("grunt-jsbeautifier");


    function runChild(command, args, done, options = {}) {
        const child = spawn(command, args, { stdio: "inherit", ...options });
        let finished = false;
        function finish(success) {
            if (finished) return;
            finished = true;
            done(success);
        }
        child.once("error", error => {
            grunt.log.error(error.message);
            finish(false);
        });
        child.once("close", code => finish(code === 0));
    }

    grunt.registerTask("db-reset", "(Re)init the database.", function(arg) {
        const finalEnv = process.env.NODE_ENV || arg || "development";
        const done = this.async();
        if (!["development", "test", "production"].includes(finalEnv)) {
            grunt.log.error("Unknown database environment");
            return done(false);
        }
        runChild(process.execPath, [path.join(__dirname, "artifacts/db-reset.js")], done,
            { env: { ...process.env, NODE_ENV: finalEnv } });
    });

    grunt.registerTask("run-unit-tests", function() {
        runChild(process.execPath, ["--test", "--test-isolation=none", "test/regression/*.test.js"], this.async());
    });

    grunt.registerTask("check-chromedriver", function() {
        try { require.resolve("chromedriver"); }
        catch (error) {
            grunt.log.error("Install a chromedriver matching your Chrome version before running ZAP tests.");
            return false;
        }
    });

    grunt.registerTask("run-security-tests", function() {
        runChild(process.execPath, [require.resolve("mocha/bin/mocha.js"), "test/security/*.js"], this.async());
    });

    grunt.registerTask("audit-dependencies", function() {
        runChild(process.platform === "win32" ? "npm.cmd" : "npm", ["audit"], this.async());
    });

    grunt.registerTask("audit-assets", function() {
        runChild(process.execPath, [require.resolve("retire/lib/cli.js"), "--path", "app/assets"], this.async());
    });

    // Retain the dependency and browser-library audit workflow with maintained tools.
    grunt.registerTask("retire", ["audit-dependencies", "audit-assets"]);

    // Code Validation, beautification task(s).
    grunt.registerTask("precommit", ["jsbeautifier", "jshint"]);

    // Test task.
    grunt.registerTask("test", ["env:test", "run-unit-tests"]);

    // Security test task.
    grunt.registerTask("testsecurity", ["env:test", "check-chromedriver", "run-security-tests"]);

    // start server.
    grunt.registerTask("run", ["precommit", "concurrent"]);

    // Default task(s).
    grunt.registerTask("default", ["precommit", "concurrent"]);
};
