import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ============ LIGHTWEIGHT RATE LIMIT (no login — just a cost safety net) ============ */
// Simple in-memory counter per IP. Resets every hour. Fine for a single small instance;
// if you outgrow this or run multiple instances, replace with a real rate-limit store.
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_PER_HOUR || 20);
const rateLimitCounts = new Map(); // ip -> { count, windowStart }
function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = rateLimitCounts.get(ip);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitCounts.set(ip, { count: 1, windowStart: now });
    return next();
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: `Rate limit reached (${RATE_LIMIT_MAX} uploads/hour per visitor). Try again later.`,
    });
  }
  entry.count++;
  next();
}



const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.warn(
    "WARNING: ANTHROPIC_API_KEY is not set. Set it in your environment (or Render's " +
      "dashboard) before deploying — /api/categorise will fail without it."
  );
}

/* ============ TAXONOMY REFERENCE (noslegal v4.02) ============ */
const TAXONOMY_WKT = `
wkt-dev-1|New development
wkt-dev-2|Modification / expansion
wkt-dev-3|Decommissioning
wkt-dsp-1|Consensual resolution
wkt-dsp-2|Litigation
wkt-dsp-3|Arbitration
wkt-dsp-4|Determinative resolution
wkt-dsp-5|Enforcement
wkt-enb-1|Delivery
wkt-enb-2|Revenue support
wkt-enb-3|Internal resources
wkt-enb-4|Personnel
wkt-enb-5|Entity management
wkt-enb-6|Third party relationships
wkt-enb-7|Organisational initiatives
wkt-enb-8|Authority requests
wkt-enb-9|Representation (residual)
wkt-enb-10|Advice (residual)
wkt-fin-1|Debt finance
wkt-fin-2|Equity finance
wkt-fin-3|Derivatives
wkt-fin-4|Securitisation
wkt-fin-5|Project and asset finance
wkt-fin-6|Trade and receivables finance
wkt-fin-7|Collective investments
wkt-fin-8|Loan portfolio sales
wkt-grc-1|Government affairs
wkt-grc-2|Regulatory affairs
wkt-grc-3|Risk and compliance
wkt-grc-4|Governance
wkt-ivp-1|Incident response
wkt-ivp-2|Inquiry (official)
wkt-ivp-3|Investigation (internal)
wkt-ivp-4|Investigation (official)
wkt-ivp-5|Prosecution or enforcement
wkt-dir-1|Reorganisation (solvent)
wkt-dir-2|Turnaround / liquidation
wkt-dir-3|Deceased estates
wkt-dir-4|Separation
wkt-tra-1|M&A
wkt-tra-2|Commercial contracts
wkt-tra-3|Non-commercial transaction
`.trim();

const TAXONOMY_LAW = `
law-cor-1|Business entity law
law-cor-2|Corporate finance
law-cor-3|Corporate governance
law-cor-4|Liability
law-cor-5|Securities law
law-cbo-1|Public international and supranational law
law-cbo-2|Private international law
law-cbo-3|Trade law
law-cbo-4|Sanctions
law-evp-1|Evidence law
law-evp-2|Procedural law
law-fam-1|Relationships
law-fam-2|Divorce and separation
law-fam-3|Children
law-fam-4|Domestic abuse
law-fin-1|Payment law
law-fin-2|Credit law
law-fin-3|Security and collateral law
law-fin-4|Guarantee and credit support law
law-fin-5|Financial market contracts
law-fin-6|Sovereign and public finance law
law-inf-1|Expression law
law-inf-2|Freedom of information law
law-inf-3|Data protection and privacy
law-inf-4|Digital regulation
law-inf-5|National security law
law-isv-1|Corporate insolvency law
law-isv-2|Individual insolvency law
law-isv-3|Public insolvency law
law-ipr-1|Copyright
law-ipr-2|Patent
law-ipr-3|Design right
law-ipr-4|Confidentiality
law-ipr-5|Trade mark
law-ipr-6|Plant breeders right
law-ipr-7|Database right
law-ipr-8|Indication of origin
law-lab-1|Individual employment law
law-lab-2|Employee benefits law
law-lab-3|Trade unions and collective bargaining
law-lnd-1|General land law
law-lnd-2|Planning law
law-lnd-3|Environmental law
law-obl-1|Contract law
law-obl-2|Delict / tort law
law-obl-3|Restitution and unjust enrichment
law-obl-4|Law of agency
law-paf-1|Trusts, wills and estate planning
law-paf-2|Succession and estate administration
law-paf-3|Personal capacity
law-prp-1|Goods
law-prp-2|Intangible property
law-pub-1|Administrative and constitutional law
law-pub-2|Human and individual rights
law-reg-1|Competition law
law-reg-2|State aid law
law-reg-3|Utility and monopoly regulation
law-reg-4|Consumer law
law-reg-5|Professional regulation
law-reg-6|Equality and cohesion law
law-reg-7|Climate law
law-tax-1|Direct taxation
law-tax-2|Indirect taxation
law-wro-1|Violence
law-wro-2|Financial and property wrongdoing
law-wro-3|Illicit goods and markets
law-wro-4|Environmental and safety misconduct
law-wro-5|Justice and administration misconduct
`.trim();

const TAXONOMY_SEC = `
sec-agr-1|Farming
sec-agr-2|Forestry
sec-agr-3|Fishing
sec-nar-1|Mining
sec-nar-2|Upstream oil and gas
sec-mfg-1|Food and drink
sec-mfg-2|Textiles (ex fashion)
sec-mfg-3|Fashion
sec-mfg-4|Chemicals
sec-mfg-5|Pharmaceuticals
sec-mfg-6|Electronics
sec-mfg-7|Machinery
sec-mfg-8|Vehicles (ex automotive)
sec-mfg-9|Automotive
sec-ens-1|Electricity (non-renewable)
sec-ens-2|Electricity (renewable)
sec-ens-3|Gas
sec-wtw-1|Water
sec-wtw-2|Waste disposal
sec-csn-1|Building
sec-csn-2|Infrastructure
sec-rwt-1|Wholesale
sec-rwt-2|Retail
sec-trs-1|Rail
sec-trs-2|Road transport
sec-trs-3|Water transport
sec-trs-4|Aviation
sec-trs-5|Space transport
sec-trs-6|Storage
sec-trs-7|Courier and postal services
sec-hos-1|Hotels and accommodation services
sec-hos-2|Restaurants / f&b
sec-ins-1|Software and data
sec-ins-2|Computer games
sec-ins-3|Films, TV and video
sec-ins-4|Music and audio
sec-ins-5|Arts and culture
sec-ins-6|Telecoms
sec-ins-7|Sports
sec-ins-8|Gambling
sec-fsv-1|Insurance
sec-fsv-2|Pension funds
sec-fsv-3|Investment funds
sec-fsv-4|Banking
sec-fsv-5|Financial markets
sec-fsv-6|Private wealth
sec-res-1|Commercial property
sec-res-2|Residential property
sec-res-3|Rural land
sec-pub-1|Foreign affairs
sec-pub-2|Defence
sec-pub-3|Justice
sec-pub-4|Public order and safety
sec-pub-6|Social security
sec-pub-7|Migration
sec-pub-8|General government
sec-pub-9|Charitable and not for profit activities
sec-pub-10|International organisation activities
sec-edu-1|Education
sec-cre-1|Healthcare
sec-cre-2|Social care
sec-pro-1|Lawyers
sec-pro-2|Accountants
sec-pro-3|Other regulated professions
`.trim();

const TAXONOMY_ROLE = `
role-dev-1|Owner
role-dev-2|Developer
role-dev-3|Authority
role-dev-4|Administrator
role-dev-5|Sub-contractor
role-dsp-1|Claimant
role-dsp-2|Defendant
role-dsp-3|Counterclaimant
role-dsp-4|Appellant
role-dsp-5|Respondent (appeal)
role-dsp-6|Other party to dispute
role-dsp-11|Funder
role-enb-1|Function
role-enb-2|Supplier / Third party
role-enb-3|Competent authority
role-fin-1|Lender
role-fin-2|Borrower
role-fin-3|Surety
role-fin-4|Company
role-fin-5|Adviser / Dealer
role-fin-6|Trustee / Agent
role-fin-7|Investor
role-grc-1|Public authority
role-grc-2|Regulated entity
role-grc-3|Policy respondent
role-ivp-1|Investigator / Authority
role-ivp-2|Investigated person
role-rsl-1|Company (solvent)
role-rsl-2|Insolvent party
role-rsl-3|Creditor
role-rsl-4|Insolvency officer
role-tra-1|Buyer
role-tra-2|Seller
role-tra-3|Owner / Licensor
role-tra-4|Lessee / Licensee / Charterer
role-tra-6|Agent / Broker
role-tra-6|Contractual party
role-cor-1|Shareholder / Member
role-cor-2|Director
role-cor-3|Company / Entity
role-emp-1|Employer
role-emp-2|Employee
role-emp-3|Trade union
role-emp-4|Worker
role-fam-1|Spouse
role-fam-2|Parent
role-fam-3|Child
role-fam-4|Guardian / Representative
role-ins-1|Insurer
role-ins-2|Insured / Policyholder
role-ins-3|Broker / Intermediary
role-ins-4|Reinsurer
role-ins-5|Loss adjuster
role-paf-1|Settlor
role-paf-2|Trustee
role-paf-3|Beneficiary (trust)
role-paf-4|Testator
role-paf-5|Personal representative
role-paf-6|Beneficiary (estate)
role-paf-7|Ward / Donor
role-paf-8|Guardian / Attorney
role-pub-1|Public authority
role-pub-2|Private person
role-pro-1|Adviser
role-pro-2|Client
role-wit-1|Factual witness
role-wit-2|Expert witness
`.trim();

const SYSTEM_PROMPT = `You are a legal taxonomist applying the "noslegal" open taxonomy (v4.02) to categorise a single uploaded contract.

Read the contract text the user provides, then respond with ONLY a single JSON object — no markdown code fences, no preamble, no commentary before or after. Exact shape:

{
  "title": "short descriptive title, e.g. Cloud Software Subscription Agreement",
  "partyA": "name of first party, with its role label in brackets if the document gives one",
  "partyB": "name of second party, same convention",
  "date": "effective/signature date or key dates as given in the document; write n/d if genuinely absent",
  "gov": "governing law / jurisdiction as stated in the document, e.g. England and Wales, or a country name if that's all that's given",
  "isTemplate": true or false — true only if this is a blank pro-forma/unexecuted template with placeholder party names, dates, or amounts,
  "summary": "<=70 words, plain English, what the contract does and its key commercial terms",
  "tags": {
    "wkt": [["code","name"]],
    "law": [["code","name"], ["code","name"]],
    "sec": [["code","name"]],
    "role": [["code","name (Party A label)"], ["code","name (Party B label)"]],
    "place": [["ISO-3166-1 alpha-2 code","country name"]]
  },
  "rationale": "<=60 words explaining the Work type and Area of law choices, and flagging anything the taxonomy doesn't fit cleanly"
}

Rules:
- Keep the whole response compact — this is being parsed by code, not read by a person, so brevity matters more than completeness. Treat the word limits below as hard caps, not targets: a cut-off, invalid JSON response is worse than a slightly terser one.
- wkt: exactly ONE tag — the single best-fit Work type.
- law: 1 to 3 tags, primary substantive law first, then any clearly-engaged secondary regime (data protection, IP, employment, land, consumer law, etc).
- sec: exactly ONE tag — the industry sector of the contract's actual subject matter, not either party's general business, unless they're the same.
- role: exactly one role tag per party (two total). If the contract is symmetric/mutual (e.g. a mutual NDA) use role-tra-6 "Contractual party" for both.
- place: the governing law jurisdiction as an ISO country code, or the closest country-level equivalent if the document names a sub-national court.
- Use ONLY codes from the reference lists below — never invent a code. If truly nothing fits well, pick the closest parent-level code (e.g. wkt-tra-2) and say so in the rationale.
- Respond in English regardless of the contract's own language, except keep party names exactly as given in the document.

WORK TYPES (facet 1):
${TAXONOMY_WKT}

AREAS OF LAW (facet 2):
${TAXONOMY_LAW}

SECTORS (facet 5):
${TAXONOMY_SEC}

ROLES (facet 4):
${TAXONOMY_ROLE}`;

/* ============ ROUTES ============ */

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasApiKey: !!ANTHROPIC_API_KEY, rateLimitPerHour: RATE_LIMIT_MAX });
});

app.post("/api/categorise", rateLimit, async (req, res) => {
  try {
    const { text, filename } = req.body || {};
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return res.status(400).json({ error: "Missing or too-short 'text' in request body" });
    }
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY" });
    }

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1536,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Filename: ${filename || "unknown"}\n\nContract text:\n\n${text}`,
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const detail = await anthropicResponse.text();
      console.error("Anthropic API error", anthropicResponse.status, detail);
      return res
        .status(502)
        .json({ error: `Anthropic API request failed (${anthropicResponse.status})` });
    }

    const data = await anthropicResponse.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "No text response from model" });
    }

    let raw = textBlock.text.trim();
    raw = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Fallback: the model may have added stray text before/after the JSON
      // despite instructions not to. Try pulling out just the {...} block.
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (e2) {
          /* still broken — fall through to the error below */
        }
      }
    }

    if (!parsed) {
      const truncated = data.stop_reason === "max_tokens";
      console.error(
        `Failed to parse model JSON (stop_reason=${data.stop_reason}):`,
        raw.slice(0, 2000)
      );
      return res.status(502).json({
        error: truncated
          ? "Model response was cut off before finishing (contract may be unusually complex) — try again"
          : "Could not parse model response as JSON — check server logs for the raw response",
      });
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// SPA fallback — anything not matched above serves the front end
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Contract Sorter listening on port ${PORT}`);
});
