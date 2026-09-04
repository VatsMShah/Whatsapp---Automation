# Traket Transport WhatsApp Bot — Node.js

Migrated from the n8n workflow `Traket_Transport_Chatbot_with_Customer_and_Transporter_Booking_System.json`.
Database layer is Google Sheets for now (same spreadsheet the n8n workflow used), swappable later.

## Architecture — mapped from the n8n workflow

```
Meta WhatsApp webhook (POST /webhook)
        │
        ▼
  signature validation (X-Hub-Signature-256)     — webhook/verify.js
        │
        ▼
  Get Master Row (users_master, by phone)        — services/sheets.js
        │
        ▼
  Process Conversation (state machine)           — automation/processConversation.js
        │
        ▼
  Save Master Session (users_master upsert)      — services/sheets.js
        │
        ▼
  Switch on flowType → per-flow sheet upsert     — webhook/handler.js
    ├─ book      → BookVehicle sheet
    ├─ provider  → ProvideVehicle sheet
    ├─ support   → Support sheet
    └─ (other)   → skipped
        │
        ▼
  Send WhatsApp text reply                       — services/whatsapp.js
        │
        ▼
  If state === "cta_menu" → send 3-button CTA    — services/whatsapp.js
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Google Sheets access (service account, not OAuth)
The original n8n workflow used a per-user OAuth connection, which doesn't
work well for a headless server. Use a service account instead:

1. Google Cloud Console → create/select a project → **IAM & Admin → Service Accounts**
2. Create a service account → **Keys → Add Key → JSON** → download it
3. Open the JSON file, copy `client_email` and `private_key`
4. Open your Google Sheet → **Share** → paste the `client_email` → give it **Editor** access
5. Fill in `.env` (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`)

Your spreadsheet must have these exact tabs (as the original did):
`users_master`, `BookVehicle`, `ProvideVehicle`, `Support` — with header rows matching
the column names used in `src/services/sheets.js` (e.g. `user_id`, `phone`, `state`, `data`, etc.)

### 3. WhatsApp Cloud API
1. Meta Business Suite → System Users → generate a **permanent access token**
2. Meta App Dashboard → WhatsApp → API Setup → copy your **Phone Number ID**
3. Meta App Dashboard → Settings → Basic → copy the **App Secret**
4. Fill in `.env` (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`)
5. Pick any random string for `WHATSAPP_VERIFY_TOKEN` — you'll enter this same value in the Meta dashboard in step 5 below

### 4. Copy the env file
```bash
cp .env.example .env
# then fill in the values
```

### 5. Run locally + expose via tunnel
```bash
npm run dev
# in a second terminal:
npx ngrok http 3000
```
Take the `https://xxxx.ngrok-free.app` URL, go to Meta App Dashboard → WhatsApp →
Configuration → Webhook → **Edit** → set:
- Callback URL: `https://xxxx.ngrok-free.app/webhook`
- Verify Token: same value as `WHATSAPP_VERIFY_TOKEN` in your `.env`

Subscribe to the `messages` webhook field. Send your WhatsApp number a message — it
should hit your local server and reply.

## What was preserved exactly
- Every conversation state and every response message string, verbatim
- The phone-normalization + "most recently updated row wins" session lookup logic
- All field mappings into BookVehicle / ProvideVehicle / Support sheets

## What I found and flagged (did NOT silently "fix")

1. **Dead/disconnected nodes in the original workflow** — not migrated, since they had
   no path from the WhatsApp trigger to anywhere: `Chat Trigger`, `Lookup Session`,
   `Combine Chat and Session`, `Save Session`, `Edit Fields`, `Chat` (langchain chat
   node), `Execute a SQL query` (Postgres, unconnected), and an unused `Send message`
   WhatsApp node (superseded by `Send message1-summary`).

2. **Two different WhatsApp Phone Number IDs were used in the original workflow** —
   `1030974210092739` in the CTA-buttons `HTTP Request` node vs. `1240163099173755` in
   `Send message1-summary`. That's very likely a bug (messages and button prompts would
   have gone out from two different numbers). This app uses **one** phone number ID
   everywhere, from `WHATSAPP_PHONE_NUMBER_ID` — set it to whichever is actually correct.

3. **`ProvideVehicleAppendUpdateRow1` mapped the `notes` column from `provider_capacity`**,
   not `provider_notes` — looks like a copy/paste bug. Replicated as-is in
   `webhook/handler.js` (see the comment there) for exact behavior parity; flip one line
   to fix it once you confirm with the business.

4. **`cta_ai` → `ai_chat` state is a dead end.** The original workflow sends "🤖 Ask me
   anything about Traket!" but no node ever handled the `ai_chat` state — the next message
   from that user would fall into the `else` default branch ("👋 Type *Hi* to start again").
   If you want a working AI chat option, that needs new logic (e.g. call an LLM and keep
   the user in `ai_chat` state) — not something to silently invent on your behalf.

## Swapping Google Sheets for a real database later

`src/services/sheets.js` is the only file that knows about spreadsheets — it exposes
plain functions (`getMasterRowsByPhone`, `saveMasterSession`, `getBookVehicleRow`, etc.).
`webhook/handler.js` only calls those functions, never touches Sheets directly. When
you're ready for Postgres/Supabase, rewrite `sheets.js` (or add a `db.js` with the same
function signatures) and swap the `require('../services/sheets')` in `handler.js` —
no changes needed anywhere else.
