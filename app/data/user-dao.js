"use strict";

const { callbackify } = require("node:util");
const { userId } = require("./validation");
const { hashPassword, verifyPassword, isPasswordHash } = require("../security/passwords");

function UserDAO(db) {
    if (!(this instanceof UserDAO)) return new UserDAO(db);
    const users = db.collection("users");

    const nextSequence = async name => {
        const counter = await db.collection("counters").findOneAndUpdate(
            { _id: name }, { $inc: { seq: 1 } },
            { returnDocument: "after", includeResultMetadata: false }
        );
        if (!counter) throw new Error("User ID counter is missing; initialize the database");
        return counter.seq;
    };

    this.getNextSequence = callbackify(nextSequence);
    this.getRandomFutureDate = () => {
        const today = new Date();
        const day = Math.floor(Math.random() * 28) + 1;
        const month = Math.floor(Math.random() * 12) + 1;
        const year = Math.ceil(Math.random() * 30) + today.getFullYear();
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };

    this.addUser = callbackify(async (userName, firstName, lastName, password, email) => {
        if ([userName, firstName, lastName, password].some(value => typeof value !== "string")) {
            throw new Error("Invalid signup input");
        }
        const user = { _id: await nextSequence("userId"), userName, firstName, lastName,
            benefitStartDate: this.getRandomFutureDate(), password: await hashPassword(password) };
        if (email) {
            if (typeof email !== "string") throw new Error("Invalid email");
            user.email = email;
        }
        await users.insertOne(user);
        return user;
    });

    this.validateLogin = callbackify(async (userName, password) => {
        if (typeof userName !== "string" || typeof password !== "string") {
            const error = new Error("Invalid login input");
            error.invalidPassword = true;
            throw error;
        }
        const user = await users.findOne({ userName });
        if (!user) {
            const error = new Error("User does not exist");
            error.noSuchUser = true;
            throw error;
        }
        if (!await verifyPassword(password, user.password)) {
            const error = new Error("Invalid password");
            error.invalidPassword = true;
            throw error;
        }
        if (!isPasswordHash(user.password)) {
            const hash = await hashPassword(password);
            await users.updateOne({ _id: user._id, password: user.password }, { $set: { password: hash } });
            user.password = hash;
        }
        return user;
    });

    this.getUserById = callbackify(async value => users.findOne({ _id: userId(value) }));
    this.getUserByUserName = callbackify(async userName => {
        if (typeof userName !== "string") throw new Error("Invalid user name");
        return users.findOne({ userName });
    });
}

module.exports = { UserDAO };
