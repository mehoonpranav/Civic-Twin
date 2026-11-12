# CivicTwin

Intelligent civic reporting: citizens post city problems with photos, AI triages them, officers resolve them in public.

This project is independent of Lovable. Hosting is Vercel, database/auth is your Supabase project, photos are Cloudflare Images.

**Setup and cutover:** see [DEPLOY.md](./DEPLOY.md). Environment template: [.env.example](./.env.example).

## Local development

```sh
cp .env.example .env
# fill in Supabase + AI keys
npm i
npm run dev
```

Open http://localhost:3000.

## Stack

- TanStack Start + Vite + Nitro
- Supabase (Postgres, Auth, optional Storage fallback)
- Cloudflare Images
- MapLibre + OpenFreeMap
- Your own vision model (OpenAI / Anthropic / OpenRouter)
