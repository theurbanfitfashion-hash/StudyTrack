# StudyTrack

A personal study planner for YouTube learning playlists. Import public/unlisted playlists, manually mark lessons complete, sort and search lessons, and set daily study-time and lesson targets.

## Stack
- Next.js App Router + TypeScript
- Supabase Auth + PostgreSQL (account and data foundation)
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
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable/anon key. This is intended for browser use; Row Level Security protects user data.

Never put a Supabase service-role key or any secret in client-side code or GitHub.

## Supabase setup
1. Create a project at https://supabase.com/dashboard.
2. Open Project Settings -> API and copy the Project URL and publishable/anon key.
3. In SQL Editor, run the complete script in `supabase/schema.sql`.
4. Add the two Supabase public environment variables and `YOUTUBE_API_KEY` to your local `.env.local` and Render service environment.
5. In Authentication -> URL Configuration, set the Site URL to your deployed app URL and add your local and production redirect URLs.

The SQL creates profiles, courses, lessons, daily goals, and study sessions, with Row Level Security policies so each signed-in user can access only their own records. A signup trigger creates a profile and default daily goals.

## Current implementation status
The Supabase schema and secure SSR client/session-refresh foundations are included. The existing dashboard is still in browser-local prototype mode until the Supabase project credentials are configured and the dashboard data/auth flows are connected. No credentials are stored in this repository.

## Deploy
Connect this GitHub repository to a Render Node web service. Use `npm install` as the build command and `npm start` as the start command. GitHub Pages cannot run the Next.js server route.
