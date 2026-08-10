# Contract Sorter

Upload contracts (PDF / DOCX / TXT), and Claude tags each one against the
**noslegal taxonomy v4.02** — Work type, Area(s) of law, Sector, Roles, and
governing law — then lets you search/filter the results.

This version is built for **one client's team to use together**:
- A single shared team password (`APP_PASSWORD`) gates the whole app.
- Contracts are stored in a real **Postgres database**, so everyone on the
  team sees the same list, from any device.
- Text extraction (PDF via pdf.js, Word via mammoth.js) happens in the
  browser. The extracted text is sent to this app's own `/api/categorise`
  endpoint, which calls the Anthropic API **server-side** — your API key
  never reaches the browser.

## Run it locally

```bash
npm install
cp .env.example .env
# edit .env: paste in a real Anthropic API key, pick a team password,
# and point DATABASE_URL at a Postgres database (see below)
npm start
```

Then open http://localhost:3000 — you'll be asked for the team password
before you can do anything.

Get an Anthropic API key from https://console.anthropic.com/settings/keys
— this requires an Anthropic account with billing set up; it's a
different key from anything used inside claude.ai.

For local development you need a Postgres database running somewhere.
Easiest options: install Postgres locally, or just skip local DB testing
and develop against your Render database (see below) by pointing
`DATABASE_URL` at it.

## Deploy on Render

1. **Push this project to a GitHub repo** (Render deploys from Git, not
   from a zip upload):
   ```bash
   git init
   git add .
   git commit -m "Contract Sorter MVP"
   git branch -M main
   git remote add origin https://github.com/<your-username>/contract-sorter.git
   git push -u origin main
   ```
   (Create the empty repo on GitHub first if you haven't.)

2. **Create the database first**: in the Render dashboard, New → PostgreSQL.
   Pick a region close to your client (e.g. Frankfurt for an EU client).
   Once it's created, copy its **Internal Database URL** — you'll need it
   in step 4.

3. **In the Render dashboard**: New → Web Service → connect your GitHub
   account → pick the `contract-sorter` repo.

4. **Settings**:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Region: same region as the database you created in step 2
   - Instance type: the free tier is fine to try it out (it sleeps after
     inactivity and takes ~30s to wake back up — fine for testing, not
     for a client who'll actually use this day to day)

5. **Environment variables**: under the service's "Environment" tab, add
   - `ANTHROPIC_API_KEY` = your real Anthropic key
   - `APP_PASSWORD` = the shared password you'll give the client's team
   - `SESSION_SECRET` = any long random string (this signs login
     sessions — treat it like a password, don't reuse it elsewhere)
   - `DATABASE_URL` = the Internal Database URL you copied in step 2
   - `NODE_ENV` = `production`
   (Render sets `PORT` itself — the server already reads
   `process.env.PORT`, so you don't need to set it.)

6. **Deploy**. Render will build, connect to the database, and create the
   `contracts` table automatically on first boot. You'll get a URL like
   `https://contract-sorter.onrender.com` — open it, log in with the team
   password, and it's live.

Any time you `git push` to `main`, Render redeploys automatically.

## What this MVP deliberately does NOT have yet

Worth being upfront with the client about these, so nobody's surprised:

- **One shared login for the whole team** — not individual accounts.
  Anyone with the password sees everything; there's no per-person
  audit trail of who uploaded or deleted what.
- **Original files aren't kept** — the app reads the text out of each
  upload and discards the file itself. If the team will want to open the
  original PDF/Word file later (not just Claude's summary), that needs
  file storage added (e.g. an S3-compatible bucket) — a well-defined next
  step, just not in this version.
- **No rate limiting** — each upload costs a real API call. Keep an eye on
  usage in the Anthropic console for the first few weeks, and consider
  adding a daily cap before handing this to a team that might batch-upload
  a lot at once.
- **Single shared password, stored in plaintext comparison** — fine for
  an MVP with one trusted team, but if this grows into something with
  more sensitive access needs, move to per-user accounts with hashed
  passwords (or Google/Microsoft SSO) rather than one shared secret.

## Next steps if you outgrow this

- **Per-person accounts** instead of one shared password, if the client
  wants to know who uploaded what.
- **Store the original files**, not just extracted text.
- **Manual tag editing** in the UI — right now Claude's tags are final;
  a "fix this tag" option would help catch and correct edge cases.
- **Bigger files / more pages**: contract text is currently truncated at
  ~14,000 characters before being sent to Claude, and PDF extraction
  stops at 40 pages — fine for most contracts, adjust in
  `public/index.html` (`extractText`) and `server.js` if you need more.

