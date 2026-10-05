"use strict";

const { environmentalScripts } = require("../../config/config");

function ResearchHandler() {
    this.displayResearch = (req, res) => {
        const { symbol } = req.query;
        if (symbol === undefined || symbol === "") return res.render("research", { environmentalScripts });
        if (typeof symbol !== "string" || !/^\^?[A-Za-z0-9][A-Za-z0-9.-]{0,19}$/.test(symbol)) {
            return res.status(400).send("Invalid stock symbol");
        }
        // Show the provider and destination before the user chooses to leave.
        // Never fetch a caller-selected URL or serve remote HTML under our origin.
        return res.render("research", { symbol, environmentalScripts,
            stockUrl: "https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) });
    };
}

module.exports = ResearchHandler;
