# Contract Sorter

Upload contracts (PDF / DOCX / TXT), and Claude tags each one against the
**noslegal taxonomy v4.02** — Work type, Area(s) of law, Sector, Roles, and
governing law — then lets you search/filter the results.

This is the **simple testing version**: no login, and nothing is saved
anywhere.

- Everything you upload lives only in your own browser tab, for as long as
  that tab stays open. Nobody else visiting the site sees it.
- Refresh the page (or close the tab) and it's gone — a clean slate every
  time. There's no database, nothing to set up beyond the app itself.
- Text extraction (PDF via pdf.js, Word via mammoth.js) happens in the
  browser. The extracted text is sent to this app's own `/api/categorise`
  endpoint, which calls the Anthropic API **server-side** — your API key
  never reaches the browser.
- A lightweight **rate limit** (20 uploads/hour per visitor by default)
  protects you from a runaway bill — a bug, a bot, someone re-uploading
  the same folder repeatedly. Adjust with `RATE_LIMIT_PER_HOUR`.

## Run it locally

```bash
npm install
cp .env.example .env
# edit .env and paste in a real Anthropic API key
npm start
```

Then open http://localhost:3000 — straight into the app, no login.

Get an Anthropic API key from https://console.anthropic.com/settings/keys
— this requires an Anthropic account with billing set up.

## Deploy on Render

This version needs **only one thing on Render**: the web service itself.
No database to create first.

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

2. **In the Render dashboard**: New → Web Service → connect your GitHub
   account → pick the `contract-sorter` repo.

3. **Settings**:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance type: free tier is fine (it sleeps after inactivity and
     takes ~30s to wake back up — fine for testing)

4. **Environment variables**: under the service's "Environment" tab, add
   - `ANTHROPIC_API_KEY` = your real Anthropic key
   - `RATE_LIMIT_PER_HOUR` = optional, defaults to `20` if you don't set it
   (Render sets `PORT` itself.)

5. **Deploy**. You'll get a URL like `https://contract-sorter.onrender.com`
   — open it, upload something, it's live.

Any time you `git push` to `main`, Render redeploys automatically.

## What "nothing is saved" actually means

Worth being precise about this, since it matters if you ever want to
change it:

- Uploaded files and their extracted text are only ever handled
  in-memory, both in your browser and on the server while processing a
  request — never written to disk, never stored in a database.
- The list of categorised contracts you see lives in a plain JavaScript
  array in your browser tab. Reload, and that array is recreated empty.
- The only thing that touches your Anthropic account per upload is the
  categorisation API call itself — Anthropic's own data-handling terms
  apply to that, same as any API call.

## If you later want this to remember things

That's a real, well-defined next step, not a small tweak — it means
adding a database and deciding who's allowed to see what (this
conversation has an earlier version of this app with exactly that: a
shared login and Postgres storage). Worth being intentional about that
step when it comes, rather than backing into it — "does everyone share
one list, or does each person only see their own?" is a real design
decision, not just a checkbox.



