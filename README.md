# Game Vault

Game Vault is a browser-based, RTL game library and project management dashboard. It provides a public catalogue for playable projects and a protected management workspace powered by Theia.

## Features

- Version-aware game catalogue with exact-version previews
- Markdown-rendered game descriptions and real activity tracking
- User profiles, favourites, community comments, and ratings
- Admin project management, version operations, and Theia-based editing
- AI workspace with streamed operational updates and manual file approval
- Light and dark themes with responsive mobile navigation

## Run locally

From the repository root:

```powershell
node server.js
```

Open `http://localhost:8081` in your browser. The Node.js server handles the catalogue, authentication, project files, uploads, activity storage, and the Theia integration.

## Project layout

- `frontend/` — public dashboard, management views, and shared styling
- `backend/` — catalogue, authentication, community, activity, and AI services
- `games/` — versioned game projects and their metadata
- `theia/` — Theia Studio integration and workspace extensions

Configuration secrets belong in local environment files and must never be committed.
