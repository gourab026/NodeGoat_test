"use strict";

// Local repair for CVE-2026-93687 until upstream publishes a fixed release.
// Preserve upstream package identity/version and lockfile integrity metadata.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const digest = text => createHash("sha256").update(text).digest("hex");
const guard = "    if (depth > 128) throw new SyntaxError('Brace nesting exceeds security limit (128)');\n";
const walkers = [
    ["  const walk = (node, parent = {}) => {\n", "  const walk = (node, parent = {}, depth = 0) => {\n" + guard],
    ["walk(child, node)", "walk(child, node, depth + 1)"]
];
const repairs = {
    "parse.js": {
        hash: "e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310",
        edits: [["      stack.push(block);", "      if (stack.length >= 128) {\n" +
            "        throw new SyntaxError('Brace nesting exceeds security limit (128)');\n" +
            "      }\n      stack.push(block);"]]
    },
    "compile.js": { hash: "dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f", edits: walkers },
    "expand.js": { hash: "41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7", edits: walkers },
    "stringify.js": {
        hash: "379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a",
        edits: [["  const stringify = (node, parent = {}) => {\n",
            "  const stringify = (node, parent = {}, depth = 0) => {\n" + guard],
        ["stringify(child)", "stringify(child, {}, depth + 1)"]]
    }
};

function transform(source, edits, reverse = false) {
    return edits.reduce((text, pair) => text.split(pair[reverse ? 1 : 0]).join(pair[reverse ? 0 : 1]), source);
}

function patchBraces(root = path.resolve(__dirname, ".."), apply = true) {
    const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
    const jobs = [];
    for (const name of Object.keys(lock.packages)) {
        if (!name.endsWith("node_modules/braces")) continue;
        const folder = path.join(root, name);
        if (!fs.existsSync(folder)) continue; // Optional/development package omitted by npm ci.
        const pkg = JSON.parse(fs.readFileSync(path.join(folder, "package.json"), "utf8"));
        if (pkg.name !== "braces" || pkg.version !== "3.0.3") {
            throw new Error("Review the braces repair before installing a different upstream version");
        }
        for (const filename of Object.keys(repairs)) {
            const repair = repairs[filename];
            const target = path.join(folder, "lib", filename);
            const source = fs.readFileSync(target, "utf8");
            let original = source;
            if (digest(original) !== repair.hash) original = transform(source, repair.edits, true);
            if (digest(original) !== repair.hash) {
                throw new Error(`Unrecognized braces source: ${name}/lib/${filename}`);
            }
            const patched = transform(original, repair.edits);
            if (source !== original && source !== patched) throw new Error("Incomplete braces repair");
            if (source !== patched) jobs.push({ target, patched });
        }
    }
    // Verify every installed copy before changing any file. Repeated runs are safe.
    if (apply) jobs.forEach(job => fs.writeFileSync(job.target, job.patched));
    return jobs.length;
}

if (require.main === module) console.log(`Braces depth guard: repaired ${patchBraces()} source files`);
module.exports = { patchBraces };
