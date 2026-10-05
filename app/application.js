"use strict";

const express = require("express");
const path = require("node:path");
const favicon = require("serve-favicon");
const bodyParser = require("body-parser");
const session = require("express-session");
const nunjucks = require("nunjucks");
const MarkdownIt = require("markdown-it");
const routes = require("./routes");
const { cookieSecret } = require("../config/config");

function createApp(db) {
    const app = express();
    app.disable("x-powered-by");
    if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
    app.use((req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Cache-Control", "no-store");
        next();
    });
    app.use(favicon(path.join(__dirname, "assets/favicon.ico")));
    app.use(express.static(path.join(__dirname, "assets")));
    app.use(bodyParser.json({ limit: "100kb" }));
    app.use(bodyParser.urlencoded({ extended: false, limit: "100kb", parameterLimit: 100 }));
    app.use(session({
        secret: cookieSecret,
        saveUninitialized: false,
        resave: false,
        cookie: {
            httpOnly: true, sameSite: "lax",
            secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 1000
        }
    }));

    const views = path.join(__dirname, "views");
    const environment = nunjucks.configure(views, {
        autoescape: true, express: app, noCache: process.env.NODE_ENV !== "production"
    });
    app.set("view engine", "html");
    app.set("views", views);
    const markdown = new MarkdownIt({ html: false, linkify: false });
    environment.addGlobal("renderMemo", memo => {
        const text = typeof memo === "string" ? memo.slice(0, 10000) : "";
        // Only parser-generated HTML is trusted; raw HTML and unsafe link
        // protocols are rejected by markdown-it before marking the output safe.
        return new nunjucks.runtime.SafeString(markdown.render(text));
    });
    routes(app, db);
    return app;
}

module.exports = { createApp };
