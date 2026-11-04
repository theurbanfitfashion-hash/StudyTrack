# StudyTrack

A personal study planner for YouTube learning playlists. Import public/unlisted playlists, manually mark lessons complete, sort and search lessons, and set daily study-time and lesson targets.

## MVP stack

- Next.js App Router + TypeScript
- Responsive client dashboard
- Browser-local persistence for this first prototype
- Server-side YouTube Data API playlist importer (API key stays on the server)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment

Copy `.env.example` to `.env.local` and set `YOUTUBE_API_KEY` from a Google Cloud project with YouTube Data API v3 enabled. Without the key, the dashboard still runs, but playlist importing is disabled.

## Persistence and deployment

This first milestone stores courses, completion status, and goals in the current browser using local storage. It does not yet provide sign-in or cross-device sync. Those require the next backend milestone: authentication plus a hosted database.

The repository is the source of truth on GitHub. GitHub Pages cannot run this Next.js server route; deploy the full app from this GitHub repository to a Node.js host such as Render.
