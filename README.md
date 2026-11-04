# StudyTrack

A personal study planner for YouTube learning playlists. Import public/unlisted playlists, manually mark lessons complete, sort and search lessons, and set daily study-time and lesson targets.

## Stack
- Next.js App Router + TypeScript
- Supabase Auth + PostgreSQL with per-user Row Level Security
- YouTube Data API v3 for playlist metadata
- Render for hosting the full Next.js application

## Run locally
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment variables
- `YOUTUBE_API_KEY`: Google Cloud YouTube Data API v3 key (server-side only).
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key. It is designed for browser use; Row Level Security protects user data.

Never put a Supabase secret/service-role key or database password in client-side code or GitHub.

## Supabase setup
The StudyTrack Supabase project already has the schema applied. The SQL source of truth is `supabase/schema.sql`. If recreating the project, run that script in Supabase SQL Editor.

Set the Supabase URL and publishable key in local `.env.local` and in the Render service environment. Set the YouTube API key in Render/local environment too.

In Supabase Authentication -> URL Configuration, set the Site URL to your deployed app URL and add local and production redirect URLs.

## Data model
The database contains profiles, courses, lessons, daily goals, and study sessions. Row Level Security ensures each authenticated user can access only their own records.

## Deploy
Connect this GitHub repository to a Render Node web service. Use `npm install` as the build command and `npm start` as the start command. GitHub Pages cannot run the Next.js server route.
