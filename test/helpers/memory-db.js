"use strict";

// A small in-memory store implementing the promise-based MongoDB operations used
// by the DAOs. No callback or deprecated driver APIs are implemented.
const copy = value => value === undefined ? undefined : global.structuredClone(value);

function matches(doc, filter) {
    return Object.entries(filter).every(([key, expected]) => {
        if (key === "$where") throw new Error("Server-side JavaScript is forbidden");
        if (expected && typeof expected === "object") {
            if ("$gt" in expected) return doc[key] > expected.$gt;
            if ("$ne" in expected) return doc[key] !== expected.$ne;
        }
        return doc[key] === expected;
    });
}

module.exports = function memoryDb(initial = {}) {
    const data = copy(initial);
    return {
        data,
        collection(name) {
            const rows = data[name] || (data[name] = []);
            return {
                async findOne(filter) { return copy(rows.find(doc => matches(doc, filter))) || null; },
                async insertOne(doc) { rows.push(copy(doc)); return { insertedId: doc._id }; },
                async insertMany(docs) { rows.push(...copy(docs)); return { insertedCount: docs.length }; },
                async updateOne(filter, update, options = {}) {
                    let doc = rows.find(doc => matches(doc, filter));
                    if (!doc && options.upsert) { doc = copy(filter); rows.push(doc); }
                    if (!doc) return { matchedCount: 0 };
                    Object.assign(doc, copy(update.$set || {}));
                    for (const [key, amount] of Object.entries(update.$inc || {})) doc[key] = (doc[key] || 0) + amount;
                    return { matchedCount: 1 };
                },
                async findOneAndUpdate(filter, update) {
                    const doc = rows.find(doc => matches(doc, filter));
                    if (!doc) return null;
                    for (const [key, amount] of Object.entries(update.$inc || {})) doc[key] += amount;
                    return copy(doc);
                },
                find(filter) {
                    let selected = rows.filter(doc => matches(doc, filter));
                    return {
                        sort(order) {
                            const [key, direction] = Object.entries(order)[0];
                            selected = selected.slice().sort((a, b) =>
                                (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * direction);
                            return this;
                        },
                        async toArray() { return copy(selected); }
                    };
                }
            };
        },
        async dropCollection(name) {
            if (!data[name]) { const error = new Error("missing"); error.code = 26; throw error; }
            delete data[name];
        }
    };
};
