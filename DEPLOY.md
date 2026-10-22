# Putting TraceErase online (free plans only)

| Part | Where | Cost |
|---|---|---|
| Website | Firebase Hosting → https://trace-erase.web.app | Free (Spark) |
| Sign-in (email + password, Google) | Firebase Authentication | Free (Spark) |
| Database | Firestore (asia-south1) | Free (Spark) |
| API server | Render web service, from this GitHub repo | Free (sleeps when idle) |
| Wake-up + daily jobs | GitHub Actions (`.github/workflows/keep-awake.yml`) | Free |
| AI | Gemini API key | Free tier |

**Not on the free setup** (the app says so clearly; the demo shows them working):
- SMS phone verification. Firebase phone sign-in needs the paid Blaze plan.
- The protected phone number. It needs a paid phone service.
- Protected email addresses for real accounts. They need your own email domain plus the Cloudflare email worker (`cloudflare/`).
  Until then, deletion letters are sent by you from your own email, using "Open in mail app" and then "I've sent it". You paste the company's reply and AI checks it.

---

## 1. Put the code on GitHub (Mac Terminal)

```bash
cd ~/Documents/TraceErase
mkdir -p .github/workflows && cp deploy/keep-awake.yml .github/workflows/
git init -b main
git add .
git status          # make sure no .env or key file is listed
git commit -m "TraceErase"
git remote add origin https://github.com/sanchaymurugan22-prog/Trace-Erase.git
git push -u origin main
```

Later updates use `git add . && git commit -m "update" && git push`. Render redeploys by itself.

## 2. Firebase private key (lets the server use Firestore)

1. In the Firebase console, open ⚙ **Project settings → Service accounts → Generate new private key**.
2. Keep the downloaded file in Downloads. Never put it in this folder or on GitHub.

## 3. Render (the API)

1. Go to Render → **New → Blueprint** → connect GitHub → pick **Trace-Erase** → **Apply**.
2. Render asks for two values:
   - `GEMINI_API_KEY`: your Gemini key.
   - `FIREBASE_SERVICE_ACCOUNT`: open the downloaded key file in TextEdit, then copy and paste **all** of it.
3. Wait for "Live". Your address looks like `https://traceerase-api.onrender.com`.
   - If it's different, put it in `client/src/lib/public-config.ts` (`apiUrl`).
4. Check it works by opening `<your address>/api/health`. It should show `"ok":true`.

## 4. Website (Mac Terminal)

```bash
cd ~/Documents/TraceErase
npm install
npm run deploy:web
```

Open https://trace-erase.web.app.

## 5. Google sign-in and the Gmail scan (Google Cloud console, project **trace-erase**)

1. **APIs & Services → Library → Gmail API → Enable.**
2. **Google Auth Platform → Audience → Test users:** add every Gmail address that will test.
3. **Data Access → Add or remove scopes:** add `.../auth/gmail.metadata`.
4. **Credentials → Web client (auto created by Google Service) → Authorized JavaScript origins:** add
   `https://trace-erase.web.app` and `https://trace-erase.firebaseapp.com`.

## 6. Keep the API awake and run the daily jobs (GitHub)

The workflow was added in step 1. In the repo, go to **Settings → Secrets and variables → Actions**:

- **Variables → New:** `API_URL` = your Render address.
- **Secrets → New:** `CRON_SECRET` = the value Render made (Render → your service → Environment → `CRON_SECRET`).

Then open **Actions → Keep API awake → Run workflow** once to test it.

## Safety switches (Render → Environment)

| Setting | Meaning |
|---|---|
| `SEND_REAL_REQUESTS=false` | The server never emails companies. Turn it on only after your own domain is set up. |
| `DEMO_MODE=true` | Shows "Try the demo". Demo accounts are separate, use sample data, never send real email, and are deleted after 3 days. |
