# Sentrint fix loop

Baseline: branch `codex/mcp-fix-loop`, commit `a0186e36f96fec5f5a4e01d99fd6b629f4cb5eff`.
Scan `67f73764-49a0-4547-9ae9-9e9d4290fb85`: 6/100, grade F;
12 critical, 79 high, 55 medium, 11 low. All 157 findings were read,
including all seven pages of results.

## First batch

- Configuration reads signing, encryption, and ZAP credentials from the
  environment. It does not print configuration or database credentials.
- Production requires `SESSION_SECRET` with at least 32 characters. Generate
  a random value and keep it in your deployment's secret store. Local development
  generates a new random signing secret at startup if none is supplied; restarting
  then invalidates local sessions. `CRYPTO_KEY` is currently used only by the
  inactive example encryption code. ZAP tests require `ZAP_API_KEY` to match ZAP.
- `/learn` permits only the existing literal Khan Academy link and `/dashboard`.
  Unknown, repeated, and non-string query values return 400.
- Cookies are HttpOnly, SameSite=Lax, expire after one hour, and require HTTPS in
  production. Set `TRUST_PROXY=1` only behind a trusted proxy one hop away that
  terminates HTTPS and replaces client forwarding headers. Heroku sets this
  through `app.json`. Direct HTTP development continues to work.
- Express, body-parser, and express-session retain their current major APIs but
  require patched versions. Query parsing and Express's route parser have
  targeted overrides for the versions identified by the scan.
- Unused runtime packages were removed after checking imports and startup
  commands. Forever's process runner is replaced by `node server.js` in the
  Procfile; the deployment platform supervises the process. No active application
  functionality was removed. Blanket overrides forcing unrelated packages across
  major versions were removed; remaining vulnerable parents need upgrades or
  replacements, rather than incompatible substitutions.
- Docker uses Node.js 24, installs from the lockfile with `npm ci --omit=dev`, runs
  as the node user, starts the application, and checks `/login` for health. Local
  credentials and host node_modules are excluded from the build context.
- `npm test` now runs real security regression tests using Node's test runner.
  The previous Grunt unit task referred to an absent `test/unit` directory.
  Existing Cypress and ZAP suites remain in place.

The checked-in lockfile is deliberately preserved without hand-editing resolved
versions, package trees, or integrity hashes. Run `npm install --ignore-scripts`
and commit its generated lockfile before scanning this batch. Lifecycle scripts
are skipped because the old Cypress installation downloads an obsolete binary;
these runtime dependencies do not require install scripts. Browser suites need
their tools installed separately until their migration is completed.

## Second scan and batch (uncommitted)

The first batch was installed, tested (6/6), and pushed by the repository owner
as `023b2d4401d6926eb3d7304f69f3511b93c60627`.
Scan `fc18c671-00d1-4774-8aee-b729eb58d713` reports 5/100, grade F:
18 critical, 85 high, 55 medium, 6 low. All 164 findings were read.
Removing incompatible dependency overrides exposed additional vulnerable copies;
this score does not establish an improvement. Current configuration, redirect,
and Docker findings from the baseline are absent. Three historical secret
findings remain, and the other 161 findings concern dependencies.

- Migrate the MongoDB driver to 7.7 and its promise APIs, including startup,
  connection shutdown, counters, CRUD, and database seeding. The driver supports
  the existing MongoDB 4.4 development server. Updates use `$set` and numeric
  user IDs consistently, preserve unrelated fields, and propagate failures.
  Stock thresholds use a validated numeric query instead of server-side `$where`.
- Replace Swig/consolidate with Nunjucks and adapt all application and tutorial
  templates. Autoescaping protects user fields; only server-owned script markup
  is marked safe. Replace Marked with markdown-it, configured without raw HTML
  or automatic links; the parser rejects unsafe link protocols while preserving
  formatted memos. These packages still need installation and rendering tests.
- Replace obsolete bcrypt-nodejs with Node's scrypt for new users and seeded
  demo accounts, using independent random salts. Existing plaintext passwords
  are migrated after successful login so existing accounts remain usable.
  Unused accounts retain their old stored password until login; seeding replaces
  the entire demo database and is not a migration for a real deployment.
- Enforce allocation ownership and administrator access to benefits. Renew and
  save authenticated sessions, and await signup provisioning before reporting
  success. Validate scalar query inputs and bound the profile routing-number
  regex to avoid its nested-quantifier denial of service.
- Stock research redirects a validated symbol to a fixed HTTPS Yahoo Finance
  URL. It no longer fetches caller-selected URLs or serves third-party HTML
  under the application's origin. Stock research remains accessible externally.
- Replace grunt-npm-install and grunt-if task orchestration with direct child
  processes; remove their obsolete bundled npm/nodeunit dependency trees. Update
  Grunt, linting, Mocha, and task parents. Preserve dependency/browser audits with
  `grunt retire` using npm audit and the maintained Retire CLI. Security tests
  retain Mocha/ZAP, require an installed chromedriver, and report child failures.
  Remove Grunt's force option so failed tasks fail the command.
- Add regression coverage for database operations, password migration, seeding,
  permissions, session renewal, SSRF, rendering, Markdown, and task failures.
  No scanner suppression was introduced. The lockfile remains intact; installation
  must regenerate it before the next commit and scan.

## Outstanding findings and next batches

| Area | Evidence and next action |
| --- | --- |
| Runtime migrations | MongoDB, Nunjucks, and Markdown replacements are prepared in this batch; validate installed packages, rendering, and a real database before considering them complete. |
| Developer tooling | Cypress 3 and ZAP still bring request; Selenium 2 brings adm-zip. Upgrade these parents and adapt their configurations/APIs in a subsequent batch. Other obsolete Grunt dependency trees are addressed in the prepared batch. |
| Remaining transitive packages | Reassess the installed dependency tree after regeneration. The full scan includes repeated advisories for different copies of packages; a newer direct dependency alone does not patch the nested copies. |
| Docker health | The finding is addressed in the Dockerfile; build and runtime verification still require Docker and regenerated dependencies. |
| Historical secrets | ZAP credentials and `artifacts/cert/server.key` were detected in initial commit `f29107fa38e4af15253d7721514c5fa3fdf23afd`. The private key is already absent at HEAD. Changing code cannot erase git history or revoke credentials. Replace any deployments using those credentials/key and its associated certificate. No history rewrite or scanner suppression was performed. |

Grade A has not been reached or claimed. The scan service evaluates pushed code.
After installing, testing, committing the lockfile, and pushing, start a new scan
of this branch and read all remaining findings.

## Third batch: template repair and remaining dependencies (uncommitted)

The owner measured the second batch on side branch `codex/round2-measure`, commit
`b99f4ce97dc0a98702096fe1f5870d6ba658a4b0`. Scan
`d78ef53f-b810-4747-8609-71e1cd2220bb` reports F, 15/100, with 51 findings:
6 critical, 25 high, 17 medium, 3 low. All three pages and all 51 findings were
read. Of these, 46 concern dependencies, two concern redirects, and three concern
historical secrets. The owner explicitly requires preserving history. The goal
is now the highest honest grade possible; the historical findings will remain.

- Reproduced the three rendering failures after installation. Swig's remaining
  `{% if !user.isAdmin %}` in the shared layout is invalid Nunjucks syntax;
  change it to `not`. All application and tutorial templates now render.
- Learning and research no longer automatically redirect users based on query
  parameters. They render explicit destination links that users can inspect and
  choose. Learning retains its exact allowlist; research retains symbol
  validation and constructs only a fixed HTTPS Yahoo destination. Unknown input
  still returns 400, and neither handler fetches remote URLs.
- Upgrade Cypress 3 to 16.1.1 and migrate cypress.json to cypress.config.js,
  preserving fixture/support/plugin locations and all spec files. Replace the
  old host-blocking configuration name. Database reset failures now fail browser
  tests. Update benefits and learning assertions for their secured behavior.
- Upgrade Selenium 2 to 4.50, replacing its obsolete control-flow/testing APIs
  with awaited browser actions and Node's test runner. Use Selenium Manager or
  `CHROMEDRIVER_PATH` for a matching driver, avoiding an obsolete npm downloader.
- Replace zaproxy 0.2 with a small Node-fetch client for ZAP's documented API.
  Keep the real authenticated profile setup, spider, active scan, passive queue
  wait, HTML report, and existing threshold of three alerts. API, browser, scan,
  and report failures fail the suite. API keys use the header, redirect following
  is disabled, and polling has deadlines. Credentials remain in environment
  configuration. Native tests replace Mocha/should/async; their direct packages
  are removed after replacing their only callers, eliminating serialization/diff
  dependencies as well as the old request/form-data/lodash chain.
- Replace grunt-nodemon's bundled Nodemon 1 with the maintained direct Nodemon 3
  CLI, retaining the concurrent/watch workflow. This removes the obsolete
  chokidar/braces/micromatch/source-map/decode-uri-component tree and its updater.
- Add same-series patch overrides for ini 1.3.8 and tmp 0.2.7 where old ranges
  otherwise retain vulnerable lockfile versions. Scope basic-ftp 6.2.2 to get-uri:
  upstream documents its sole major break as rejecting separate transfer hosts
  by default, a security improvement retained here. Its Client/access/lastMod/
  list/downloadTo/close APIs used by get-uri remain available. The tooling check
  verifies the installed client and loads the Retire CLI after installation.

38 regression tests pass locally, including the previously failing rendering
tests, navigation allowlist checks, and ZAP orchestration/error propagation.
Lint and whitespace checks pass. New Cypress/Selenium/FTP packages have not been
installed in this sandbox; their smoke check and actual browser/ZAP runs remain
pending. The owner's previous install-generated lockfile is preserved, and must
be regenerated again for these dependency changes. No suppressions or history
rewrites were used, and no post-batch grade is claimed.

Run these commands before committing:

```sh
npm install --ignore-scripts
npm test
npm run check:tooling
```

For browser validation, install the current binary with `npx cypress install`,
then `npm run cy:verify`. With an initialized disposable test database and the
app running in test mode, run `npm run test:ci`. For the ZAP suite, also run ZAP
and Chrome, set `ZAP_API_KEY`, optionally `ZAP_HOST`/`ZAP_PORT` and
`CHROMEDRIVER_PATH`, then run `npm run test:security`. These tests scan and modify
the demo database; use a dedicated test environment. Do not seed a real database.

Versions and migrations checked against primary sources:
[Cypress 16.1.1](https://www.cypress.io/releases),
[Cypress migration guide](https://docs.cypress.io/app/references/migration-guide),
[Selenium releases](https://github.com/SeleniumHQ/selenium/releases),
[ZAP API](https://www.zaproxy.org/docs/api/), and
[basic-ftp changelog](https://github.com/patrickjuchli/basic-ftp/blob/master/CHANGELOG.md).

## Validation

The redirect and configuration tests failed against the baseline and passed
after the changes. Six tests pass with `npm test` in the offline workspace.
JavaScript syntax and JSON checks also pass. Tests load the real configuration
and route registration in isolated VM contexts; unrelated handlers are stubbed
because app dependencies are unavailable.

For the second batch, all 30 tests that can run with installed dependencies pass.
The full `npm test` runs 34 tests: 30 pass and the four application rendering tests
fail because the new Nunjucks dependency is not installed. These four tests load
the real application and render templates; they must pass after installation.
JavaScript lint and whitespace checks pass for the modified code. Database
startup against the real MongoDB driver/server, Docker, and full browser
integration have not been validated here. Dependency installation is delegated
to the owner because the workspace cannot reach the registry.

Patched middleware versions were checked against upstream histories:
[Express](https://raw.githubusercontent.com/expressjs/express/4.x/History.md),
[body-parser](https://raw.githubusercontent.com/expressjs/body-parser/master/HISTORY.md),
and [express-session](https://raw.githubusercontent.com/expressjs/session/master/HISTORY.md).
Migration APIs and versions were checked against upstream documentation:
[MongoDB compatibility](https://www.mongodb.com/docs/drivers/node/current/reference/compatibility/),
[MongoDB driver](https://github.com/mongodb/node-mongodb-native),
[Nunjucks](https://mozilla.github.io/nunjucks/api.html),
[markdown-it](https://github.com/markdown-it/markdown-it), and
[Retire.js](https://github.com/RetireJS/retire.js).
