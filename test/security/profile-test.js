"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const proxy = require("selenium-webdriver/proxy");
const config = require("../../config/config");
const { ZapClient, scanProfile } = require("../../artifacts/zap-scan");

describe("profile ZAP regression suite", { timeout: 25 * 60 * 1000 }, () => {
    let driver;
    let api;
    const target = `http://${config.hostName}:${config.port}/`;

    before(async () => {
        api = new ZapClient(`http://${config.zapHostName}:${config.zapPort}`, config.zapApiKey);
        await api.call("core", "view", "version");
        const options = new chrome.Options().addArguments("--headless=new");
        const builder = new Builder().forBrowser("chrome").setChromeOptions(options)
            .setProxy(proxy.manual({ http: `${config.zapHostName}:${config.zapPort}`,
                https: `${config.zapHostName}:${config.zapPort}` }));
        // Selenium Manager resolves the matching driver by default. Offline users
        // can provide an already-installed driver instead of downloading one.
        if (process.env.CHROMEDRIVER_PATH) {
            builder.setChromeService(new chrome.ServiceBuilder(process.env.CHROMEDRIVER_PATH));
        }
        driver = await builder.build();
        await driver.manage().setTimeouts({ pageLoad: 30000, script: 30000, implicit: 0 });
        await driver.get(target + "login");
        await driver.findElement(By.name("userName")).sendKeys("user1");
        await driver.findElement(By.name("password")).sendKeys("User1_123");
        await driver.findElement(By.css("button[type='submit']")).click();
        await driver.wait(until.urlContains("/dashboard"), 10000);
        await driver.get(target + "profile");
        const values = { firstName: "seleniumJohn", lastName: "seleniumDoe", ssn: "seleniumSSN",
            dob: "12/23/5678", bankAcc: "seleniumBankAcc", bankRouting: "0198212#", address: "seleniumAddress" };
        for (const name of Object.keys(values)) {
            const element = await driver.findElement(By.name(name));
            await element.clear();
            await element.sendKeys(values[name]);
        }
        await driver.findElement(By.name("submit")).click();
        await driver.wait(until.elementLocated(By.css(".alert-success")), 10000);
        assert.equal(await driver.findElement(By.name("firstName")).getAttribute("value"), "seleniumJohn");
    }, { timeout: 120000 });

    after(async () => {
        if (driver) await driver.quit();
    }, { timeout: 30000 });

    it("does not exceed the existing threshold of three profile alerts", async () => {
        const reportPath = path.join(__dirname, `report_${Date.now()}.html`);
        await scanProfile(api, { target, userName: "user1", password: "User1_123",
            interval: config.zapApiFeedbackSpeed,
            writeReport: html => fs.writeFile(reportPath, html) });
        console.log(`ZAP report: ${reportPath}`);
    });
});
