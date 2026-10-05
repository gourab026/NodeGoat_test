const path = require("path");

const finalEnv = process.env.NODE_ENV || "development";
if (!["development", "test", "production"].includes(finalEnv)) {
    throw new Error("NODE_ENV must be development, test, or production");
}

const allConf = require(path.resolve(__dirname + "/../config/env/all.js"));
const envConf = require(path.resolve(__dirname + "/../config/env/" + finalEnv.toLowerCase() + ".js")) || {};

const config = { ...allConf, ...envConf };

module.exports = config;
