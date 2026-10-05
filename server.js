"use strict";

const http = require("node:http");
const { MongoClient } = require("mongodb");
const { createApp } = require("./app/application");
const config = require("./config/config");

async function start() {
    const client = new MongoClient(config.db, { serverSelectionTimeoutMS: 10000 });
    try {
        await client.connect();
        const server = http.createServer(createApp(client.db()));
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(config.port, resolve);
        });
        console.log(`Express server listening on port ${config.port}`);
        const shutdown = () => {
            server.close(() => client.close().then(() => { process.exitCode = 0; }, () => { process.exitCode = 1; }));
        };
        process.once("SIGTERM", shutdown);
        process.once("SIGINT", shutdown);
        return { server, client };
    } catch (error) {
        await client.close();
        throw error;
    }
}

if (require.main === module) {
    start().catch(() => {
        // Connection errors can include credentials from the database URI.
        console.error("Unable to start application; check database connectivity and configuration");
        process.exitCode = 1;
    });
}

module.exports = { createApp, start };
