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

## Outstanding findings and next batches

| Area | Evidence and next action |
| --- | --- |
| MongoDB | Driver 2.2.36 is vulnerable. Upgrade the driver and migrate connection, CRUD, callbacks, and seeding together. |
| Templates | Swig 1.4.2 has no fixed release for the reported issue. Replace the engine, adapt templates, and validate escaping and rendering. |
| Markdown | Marked 0.3.5 is vulnerable. Upgrade it and use an explicit HTML sanitizer; preserve memo formatting. |
| Developer tooling | `grunt-npm-install` brings npm 3 and tar 2; `grunt-retire`, old Cypress, and ZAP bring request; Selenium 2 brings adm-zip. Upgrade or replace these parents while preserving their tasks and tests. |
| Remaining transitive packages | Reassess the installed dependency tree after regeneration. The full scan includes repeated advisories for different copies of packages; a newer direct dependency alone does not patch the nested copies. |
| Docker health | The finding is addressed in the Dockerfile; build and runtime verification still require Docker and regenerated dependencies. |
| Historical secrets | ZAP credentials and `artifacts/cert/server.key` were detected in initial commit `f29107fa38e4af15253d7721514c5fa3fdf23afd`. The private key is already absent at HEAD. Changing code cannot erase git history or revoke credentials. Replace any deployments using those credentials/key and its associated certificate. No history rewrite or scanner suppression was performed. |

Grade A has not been reached or claimed. The scan service evaluates pushed code.
After installing, testing, committing the lockfile, and pushing, start a new scan
of this branch and read all remaining findings.

## Validation

The redirect and configuration tests failed against the baseline and passed
after the changes. Six tests pass with `npm test` in the offline workspace.
JavaScript syntax and JSON checks also pass. Tests load the real configuration
and route registration in isolated VM contexts; unrelated handlers are stubbed
because app dependencies are unavailable. Dependency installation, database
startup, Docker, and full browser integration have not been validated here.

Patched middleware versions were checked against upstream histories:
[Express](https://raw.githubusercontent.com/expressjs/express/4.x/History.md),
[body-parser](https://raw.githubusercontent.com/expressjs/body-parser/master/HISTORY.md),
and [express-session](https://raw.githubusercontent.com/expressjs/session/master/HISTORY.md).
