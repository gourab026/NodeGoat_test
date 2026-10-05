"use strict";

const { environmentalScripts } = require("../../config/config");

function ResearchHandler() {
    this.displayResearch = (req, res) => {
        const { symbol } = req.query;
        if (symbol === undefined || symbol === "") return res.render("research", { environmentalScripts });
        if (typeof symbol !== "string" || !/^\^?[A-Za-z0-9][A-Za-z0-9.-]{0,19}$/.test(symbol)) {
            return res.status(400).send("Invalid stock symbol");
        }
        // Stock data is viewed on the provider's site. Never fetch a URL supplied
        // by the caller, and never serve remote HTML under this app's origin.
        return res.redirect("https://finance.yahoo.com/quote/" + encodeURIComponent(symbol));
    };
}

module.exports = ResearchHandler;
