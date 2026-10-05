"use strict";

const { callbackify } = require("node:util");

function MemosDAO(db) {
    if (!(this instanceof MemosDAO)) return new MemosDAO(db);
    const memos = db.collection("memos");
    this.insert = callbackify(async memo => {
        if (typeof memo !== "string" || memo.length > 10000) {
            throw new Error("Invalid memo; maximum length is 10000 characters");
        }
        return memos.insertOne({ memo, timestamp: new Date() });
    });
    this.getAllMemos = callbackify(async () => memos.find({}).sort({ timestamp: -1 }).toArray());
}

module.exports = { MemosDAO };
