# CivicTwin — leave Lovable, run on Vercel + Supabase + Cloudflare

This app no longer depends on Lovable Cloud, Lovable Auth, Lovable email, or the Lovable AI gateway.

| Concern | Now owned by |
|---|---|
| Hosting / SSR | Vercel |
| Database, Auth, Email | **Your** Supabase project |
| Report photos | Cloudflare Images (Supabase Storage as fallback) |
| Maps | OpenFreeMap (no API key) |
| AI triage | Your own key (`AI_API_KEY` / OpenAI / Anthropic / OpenRouter) |

Do **not** keep using the Lovable-connected Supabase project (`vgoedvvkhfpbuzglsrfd`). That project sends confirmation emails through Lovable and ties Google login to Lovable Cloud Auth.

---

## 1. Create a new Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and create a project.
2. Open **SQL Editor** and paste, in order, every file in `supabase/migrations/` (oldest first). Or paste `supabase/schema.sql` once.
3. Copy these values from **Project Settings → API**:
   - Project URL → `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - `anon` / publishable key → `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY`
   - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (server only)

### Auth URLs

**Authentication → URL Configuration**

- Site URL: `https://YOUR-VERCEL-DOMAIN.vercel.app`
- Redirect URLs:
  - `https://YOUR-VERCEL-DOMAIN.vercel.app/**`
  - `http://localhost:3000/**`

### Email (so signup codes are not sent by Lovable)

**Authentication → Emails**

- Use Supabase’s built-in mail, **or**
- **Authentication → SMTP** and point it at Resend / Postmark / your domain.

Custom SMTP is required in production; Supabase’s default mailer is rate-limited and often lands in spam.

### Google login

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → create an OAuth 2.0 **Web** client.
2. Authorized JavaScript origins:
   - `https://YOUR-VERCEL-DOMAIN.vercel.app`
   - `http://localhost:3000`
3. Authorized redirect URIs:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
4. **Authentication → Providers → Google** in Supabase: enable it and paste the Client ID + Client Secret.

Email + password signup already uses native Supabase Auth. After the SMTP change, confirmation mail comes from you, not Lovable.

---

## 2. Cloudflare Images

1. Cloudflare Dashboard → **Images**.
2. Create an API token with **Account → Cloudflare Images → Edit**.
3. Copy:
   - Account ID
   - Account hash (Images → Developer resources)
   - API token

Set on Vercel:

```
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_IMAGES_API_TOKEN=...
CLOUDFLARE_IMAGES_ACCOUNT_HASH=...
```

Public photo URLs look like:

`https://imagedelivery.net/<ACCOUNT_HASH>/<IMAGE_ID>/public`

In **Images → Variants**, keep a variant named `public` (created by default when signed URLs are off).

If these three variables are missing, uploads fall back to the `report-photos` Supabase bucket.

---

## 3. AI key (this is why triage returned 500)

The old code always called `https://vyceai.com/v1` when `VYCEAI_API_KEY` was set, or Lovable’s gateway when `LOVABLE_API_KEY` was set. A raw OpenAI / Gemini / Claude key sent to those hosts returns `500 internal_error`.

Set **one** of these on Vercel (Production + Preview):

```
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

Other options:

```
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-...
AI_MODEL=openai/gpt-4o-mini
```

```
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-5
```

`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, and `VYCEAI_API_KEY` still work as fallbacks.

The key must be a **server** env var (no `VITE_` prefix). Redeploy after changing it — Vercel does not hot-reload secrets into an already-built function until the next deployment.

---

## 4. Vercel env vars (complete list)

Client (available in the browser, baked at **build** time):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Server:

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
AI_PROVIDER
AI_API_KEY
AI_MODEL
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_IMAGES_API_TOKEN
CLOUDFLARE_IMAGES_ACCOUNT_HASH
```

After adding `VITE_*` variables you **must Redeploy** so the client bundle picks them up.

Root Directory in Vercel should be the folder that contains `package.json` (if the GitHub repo still has a nested `city-pulse-main/`, set Root Directory to that folder).

---

## 5. Deploy

```sh
npm i
npm run dev          # http://localhost:3000
```

Push to GitHub and import the repo in Vercel. Framework preset: **TanStack Start** (`vercel.json` already sets this).

Promote yourself to officer after the first signup:

```sql
insert into public.user_roles (user_id, role)
values ('YOUR-USER-UUID', 'officer')
on conflict do nothing;
```

Or call the in-app `bootstrapOfficer` path while the table has zero officers.

---

## 6. Map “API KEY REQUIRED”

That watermark came from CARTO basemaps, which now refuse anonymous tile requests. The map uses OpenFreeMap Positron and needs no key.

---

## 7. Moving existing data

If you already have reports on the Lovable Supabase project:

1. Old project → **Settings → Database → Export** or `pg_dump`.
2. New project → import.
3. Existing `sb:...` photo paths keep working against the old bucket only if you also copy Storage objects. New uploads go to Cloudflare.
