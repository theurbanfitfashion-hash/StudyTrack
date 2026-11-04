# StudyTrack

A personal study planner for YouTube learning playlists. Track courses, manually mark lessons complete, and set daily study-time and lesson targets.

## MVP stack

- Next.js App Router + TypeScript
- Responsive client dashboard
- Local persistence for the first prototype
- YouTube playlist import API integration planned behind a server route

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deployment

The source code lives on GitHub. GitHub Pages only hosts static sites and cannot run the server-side playlist API or a full authentication/database backend. For the complete account-based app, deploy the GitHub repository to Render (or another Node.js host) and connect a persistent database. The initial prototype can be published as a static preview, but its local data stays in that browser until cloud authentication and storage are connected.
