# TraceErase

**Find it. Delete it. Prove it.** An AI-powered web app that finds every company holding your personal data,
deletes it everywhere (including the partners they shared it with), and gives you tamper-proof proof.
No company has to install or sign up for anything: TraceErase works with the email replies companies already send.

Built for DEXATHON 2026 (Blockchain & Cybersecurity, Problem 4: *Verifying whether personal data has actually been deleted*)
by Team Cranial Remission.

---

## Run it (Mac)

In Terminal run:

```bash
cd ~/Documents/TraceErase
bash start.command
```

`start.command` does everything for you:

1. checks that **Node.js 20 or newer** is installed (https://nodejs.org),
2. creates `server/.env` and asks for your **Gemini API key** the first time (it stays in `server/.env`, never in the browser),
3. runs `npm install` (all packages for the web app, the server and Gemini; about 1–2 minutes the first time),
4. tests the key and **finds the Gemini model it can use**, then saves `GEMINI_PROVIDER` and `GEMINI_MODEL` in `server/.env`,
5. starts the app and opens **http://localhost:5173**.

**Or by hand:**

```bash
cd ~/Documents/TraceErase
cp server/.env.example server/.env   # then put GEMINI_API_KEY=... in it
npm install
npm run check:ai                     # optional: lists the models your key can use and saves the working one
npm run dev
```

| What | Where |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:4000 |
| Server log | `logs/server.log` |

| Command | What it does |
|---|---|
| `npm run dev` | Starts the web app (Vite) and the API together |
| `npm run check:ai` | Tests the Gemini key, lists usable models, saves the working one to `server/.env` |
| `npm run typecheck` | TypeScript check of the web app |
| `npm test` | End-to-end test of the whole story (with the app running) |
| `npm run reset` | Deletes all local data and starts fresh |
| `npm run build` / `npm start` | Production build, served from http://localhost:4000 |

### If Gemini says "403 / API disabled"

The key belongs to a Google Cloud project where the **Generative Language API** is turned off. Either enable it in
that project (Google Cloud Console → APIs & Services → Library → "Generative Language API" → Enable), or create a
new key at **https://aistudio.google.com/apikey**. Paste the new key in **Settings → AI → Change key** (or re-run
`start.command`). Until then the app keeps working with built-in rules, and Settings → AI shows the exact reason.

---

## Who uses TraceErase (roles)

| Role | How they get in | What they can do |
|---|---|---|
| **User** (citizen, the "Data Principal") | Sign up with email + mobile, one-time codes, passkey | Scan, protected identity, deletion requests, alerts, leaks, evidence, complaints, certificates, assistant |
| **Regulator** (Data Protection Board officer) | **Regulator login** link in the footer → `/regulator/login` | Complaints queue with evidence, company ranking, AI pattern detection. Only visible after regulator login |
| **Public visitor** | No login | Landing page, public company scores, verify any receipt at `/verify` |

Companies do **not** log in: they receive requests by email (or web form) and their replies, deadlines and leaks
show up on the public scores.

**Default regulator accounts** (change them with `REGULATOR_ACCOUNTS` in `server/.env`):

| Email | Password |
|---|---|
| `regulator@traceerase.demo` | `Regulator@2026` |
| `board.officer@traceerase.demo` | `Board@2026` |

---

## How deletion is proven (no company integration needed)

1. **Every company knows you by a different protected email.** Anything sent to that address can only come from
   that company or from someone it gave the address to.
2. **You sign the deletion request with your passkey.** The request's fingerprint is the passkey challenge,
   so the signature proves you approved exactly that request.
3. **AI writes and sends the DPDP Act request** from the protected address, so the company's reply comes back to TraceErase.
4. **AI reads the reply:** is it a genuine confirmation (DKIM signature, reference number), what was deleted,
   what was kept and under which law, and **which partners received your data**. Each partner named in the reply
   gets its own deletion request automatically.
5. **Silence verifies it.** A confirmed deletion becomes *Verified* after 30 days in which nobody uses the
   address that only that company knew. If anyone does, it's a **leak**: the message is blocked and the AI leak
   investigator traces it through the companies' own disclosures.
6. **Ignored?** Day 7 reminder → day 10 formal grievance → day 15 complaint drafted by AI with an evidence pack.
7. Every step creates a **receipt** on a hash-chained Merkle ledger; anyone can check one at `/verify/<id>`.

Statuses: **Verified** (confirmed + 30 days of silence) · **Deleted, some kept** (law requires part of it) ·
**Says deleted** (confirmed, being watched) · **No reply / Overdue** · **Refused**.

---

## 5-minute demo

1. **Splash (3 s) → Language → Landing → Sign up.** Picking a language translates the whole app right away. Codes appear on screen in dev mode (no email service needed).
2. **Create a passkey** (Touch ID on a Mac).
3. **Connect → Start AI scan** (sample inbox). Gemini identifies about 40 companies.
4. Open **Demo controls** (bottom right) → **Set up demo story**. Zomato and MakeMyTrip now know you by protected emails,
   and the deletion page opens with both selected → **Review → Confirm with passkey**.
5. **Demo controls → +1d.** Zomato's reply arrives. AI reads it: deleted, but invoices kept (CGST Act), and it
   names **Razorpay** and **AdNexa** as partners. Both get a deletion request automatically.
6. **+1d** again: Razorpay replies (payment records kept under PMLA). **+7d**: reminders go out; MakeMyTrip answers after its reminder.
7. **+15d**: AdNexa ignored the request, the reminder and the grievance → AI complaint with an evidence pack.
8. **Leak: AdNexa sells my Zomato email to PizzaPoint.** Blocked; the AI investigator traces it to AdNexa.
9. **File the complaint**, log out and use **Regulator login** (footer) to see it on the regulator console (AI pattern detection), then **+30d**: MakeMyTrip becomes **Verified**.
   Issue the **certificate** and verify a receipt publicly.
10. **Ask TraceErase:** "How did PizzaPoint get my email?" · switch the language (12 languages, including Arabic right-to-left) and the whole UI translates.

**Companies reply now** in Demo controls skips the waiting. Demo replies go through the same inbound pipeline as real email.

---

## What's inside

```
TraceErase/
├── client/                 Web app: React 19 + TypeScript + Vite 6 + Tailwind CSS 4
│   └── src/
│       ├── main.tsx, App.tsx, routes.tsx, index.css
│       ├── components/     ui/ (buttons, forms, cards…), layout/ (shells, nav), demo/, shared/
│       ├── lib/            api, router, session, passkeys (WebAuthn), formatting
│       ├── i18n/           I18nProvider, languages, locales/<lang>.json (11 built-in dictionaries)
│       ├── types/          API types
│       └── pages/          one folder per screen:
│           splash/ language/ landing/ auth/{signup,verify-codes,passkey,login,regulator-login}
│           onboarding/{identity,connect,scan,results} dashboard/ data-map/ companies/{list,detail,fix-account}
│           protect/ deletion/{choose,requests,request-status,target-detail} receipt/ alerts/ leaks/
│           evidence/{list,pack} complaints/ certificates/ assistant/ activity/ outbox/ settings/
│           regulator/dashboard/ public/{scores,verify-receipt} not-found/
├── server/                 Node.js API (no required dependencies), JSON database, AI agents, ledger, passkeys
├── extension/              Chrome extension: fills your protected email/number on sign-up pages, shows AI policy warnings
├── contracts/              TraceAnchor.sol for optional on-chain anchoring (Polygon Amoy)
├── scripts/                Helper scripts (cleans up files from the old JavaScript version)
└── start.command           One-step launcher for macOS
```

**Languages:** English, हिन्दी, தமிழ், తెలుగు, ಕನ್ನಡ, മലയാളം, বাংলা, मराठी, ગુજરાતી, Español, Français, العربية.
Every screen string goes through `t('English text')`; the built-in dictionaries translate the interface instantly and
offline. Text that only exists at runtime (company replies, AI summaries) is translated by Gemini. After adding UI text,
run `npm run i18n:extract -w client` to refresh `src/i18n/strings.json`.

### AI features (Google Gemini)

All AI calls run on the server; the key never reaches the browser. Your name, email and phone are replaced with
placeholders before any prompt is sent. Every feature has a rule-based fallback, so the app keeps working without
internet or without a key (the UI marks those answers as "Rules").

| Agent | What it does |
|---|---|
| Discovery agent | Identifies which inbox senders are companies holding your data, with category and data types |
| Scan summariser | One-line insight and where to start |
| Policy reader | Downloads a company's privacy policy: retention, sharing, deletion method, grievance email |
| Request writer | Writes DPDP Act deletion / access / reminder / grievance letters in 12 languages |
| Reply checker | Decides if a reply genuinely confirms deletion; extracts what was deleted, what was kept and **which partners got your data** |
| Leak investigator | Works out which company passed your protected address to a stranger |
| Complaint drafter | Drafts the complaint to the Data Protection Board from the evidence |
| SMS/call guard | Allows or blocks messages to your protected number |
| Assistant | "Ask TraceErase" chat grounded in your own receipts, requests and leaks (voice input too) |
| Daily summary | Two-sentence update on the dashboard |
| Regulator patterns | Finds repeat offenders across complaints |
| UI translator | Translates runtime text (replies, summaries) into the chosen language and caches it |

Works with **Google AI Studio keys** (`AIza…`) and **Vertex AI express keys** (`AQ.…`). On start-up the server tries
the current Gemini Flash models in order (`gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.8-flash`,
`gemini-3.1-flash-lite`, `gemini-flash-latest`, `gemini-2.5-flash`), uses the first one your key can call and saves it
as `GEMINI_MODEL` in `server/.env`. Set `GEMINI_MODEL` yourself to pin a model.

### Security

- **Passkeys (WebAuthn)** implemented with Node's crypto (ES256 / RS256 / EdDSA).
- **Receipt ledger:** SHA-256 fingerprints, Merkle batches every minute, batch roots chained. Optional Polygon anchoring (`contracts/README.md`).
- **Protected identity:** one address per app plus one protected number; allowed senders; strict mode; rotation; spoof detection (DKIM fail).
- One-time codes are hashed, sessions are HMAC-signed httpOnly cookies, AI never sees real identifiers.
- Deletion letters are **not** emailed to real companies unless you set `SEND_REAL_REQUESTS=true`; until then they wait in the Dev outbox.

---

## Settings (`server/.env`)

| Variable | Needed? | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | For AI | AI Studio or Vertex AI express key |
| `GEMINI_PROVIDER` / `GEMINI_MODEL` | Automatic | Filled in by the start-up check; set them to pin a model |
| `REGULATOR_ACCOUNTS` | Optional | Regulator logins as `email:password` pairs, comma-separated |
| `SMTP_*` | Optional | Send real emails (codes, forwarding, letters). Otherwise see **Dev outbox** |
| `SEND_REAL_REQUESTS` | Optional | `true` to actually email deletion letters to companies (off by default) |
| `TWILIO_*` | Optional | Real SMS codes |
| `GOOGLE_CLIENT_ID/SECRET` | Optional | Real Gmail scan (OAuth, `gmail.metadata` scope, redirect `http://localhost:4000/api/gmail/callback`) |
| `ANCHOR_*` | Optional | On-chain anchoring |
| `DEMO_MODE` | Default on | Demo controls and simulated company replies |

### Wiring real protected email and SMS

Protected addresses use `PROTECTED_EMAIL_DOMAIN` (default `te.mail`). For real delivery, point a domain's inbound
email (Cloudflare Email Routing worker, Mailgun routes or SendGrid Inbound Parse) to
`POST /api/inbound/email` with `to, from, subject, text, dkim`; for SMS and calls point a Twilio number's webhooks to
`/api/inbound/sms` and `/api/inbound/call`. Set `INBOUND_SECRET` and send it as `X-Inbound-Secret`.

---

## Honest limits of this prototype

- Gmail scanning needs your own Google OAuth client; without it the scan uses a realistic sample inbox or an uploaded `.mbox`/CSV.
- Protected email/SMS delivery needs a domain and a provider (above); in demo mode, company replies are simulated.
- "Verified" means a confirmed deletion plus 30 days of silence on the company-only address. It proves the address
  stopped being used, not what is on the company's disks; that is as far as anyone can check from outside.
- Complaints are recorded in TraceErase and printable; filing on the Board's official portal is still manual.
- Public-score rows marked "Sample" use illustrative figures until enough real requests exist.
- Demo replies from Zomato, Razorpay and MakeMyTrip are simulated and not from those companies. AdNexa and PizzaPoint are fictional.
