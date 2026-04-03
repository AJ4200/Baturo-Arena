# 🚀 Baturo-Arena

> Multiplayer Gaming Platform • TypeScript Fullstack Monorepo

[![MIT License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)
[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/project?template=https://github.com/AJ4200/Baturo-Arena)
[![Made with Next.js](https://img.shields.io/badge/Made%20with-Next.js-blue?logo=next.js)](https://nextjs.org/)
[![Made with Node.js](https://img.shields.io/badge/Made%20with-Node.js-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/-TypeScript-007acc?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)

Welcome to **Baturo-Arena**, your open-source multiplayer game platform!  
Build, play, and compete—featuring a Next.js web frontend (ba_web) and a Node.js/Express backend (ba_server), powered by TypeScript.

![Baturo-Arena Preview](ba_web/public/next.svg)

---

## 🗂 Repo Structure

| Folder         | Description              | Tech / Notes                |
|----------------|-------------------------|-----------------------------|
| `ba_web`       | Frontend (Next.js app)  | Next.js, React, TailwindCSS |
| `ba_server`    | Backend API server      | Node.js, Express, REST      |
| `AGENTS.md`    | Docs/Specs/Agents       | -                           |
| `README.md`    | This file               | -                           |
| `LICENSE`      | Open Source License     | MIT                         |

---

## ✨ Features

- 🌐 **Modern Web UI:** Next.js, React, Tailwind
- 🎮 **Multiplayer Gaming:** Realtime competition in the Arena
- 🏆 **Leaderboards & Stats:** Track your ranking and global progress
- ⚡ **REST API:** Robust, documented backend for game data
- 🛡️ **TypeScript:** End-to-end types for safety and productivity
- ☁️ **Vercel-Ready:** Instant deployment and preview environments

---

## 📦 Getting Started (Monorepo Setup)

1. **Clone the repo**
   ```bash
   git clone https://github.com/AJ4200/Baturo-Arena.git
   cd Baturo-Arena
   ```

2. **Install dependencies for both workspaces**
   ```bash
   cd ba_web    && pnpm install # or npm install / yarn
   cd ../ba_server && pnpm install # or npm install / yarn
   ```

---

## 🖥️ Frontend: `ba_web`

- Built with [Next.js](https://nextjs.org/) & [Tailwind CSS](https://tailwindcss.com/)
- All UI code in `/ba_web/src`
- Media & icons in `/ba_web/public`

**Dev Start:**
```bash
cd ba_web
pnpm dev
# open http://localhost:3000
```

**Customize:**  
Edit files in `/ba_web/src` to update components, features, or styling.

**Deployment:**  
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/AJ4200/Baturo-Arena/tree/master/ba_web)

---

## 🛠️ Backend: `ba_server`

- Node.js/Express server with modular architecture
- PostgreSQL is required for persistence (`POSTGRES_URL`)
- All REST API logic in `/ba_server/src`:
    - `routes/` – Endpoint definitions
    - `services/` – Business logic
    - `db/` – Database access layer
    - `utils/`, `errors/`, `repositories/`, etc.
- Main entry: `src/app.js`, `src/server.js`

**Dev Start:**
```bash
cd ba_server
pnpm start
# runs backend server (port as per config)
```

### Environment quick start

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` (or `POSTGRES_URL`) for the API server.
3. Set `GOOGLE_CLIENT_ID` for the API server Google token verification (`ba_server`).
4. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for frontend Google Sign-In (`ba_web`).
5. Optional: set `NEXT_PUBLIC_GOOGLE_USE_FEDCM=true` to force FedCM prompt mode; default behavior is standard Google prompt mode.
6. Optional: set `AUTH_SESSION_TTL_HOURS` to control login session duration (defaults to `168` hours).
7. Optional DB resilience vars: `DB_CONNECTION_TIMEOUT_MS`, `DB_CONNECT_RETRIES`, `DB_CONNECT_RETRY_DELAY_MS`, `DB_POOL_MAX`.
8. Optional DB startup retry var: `DB_INIT_RETRY_DELAY_MS` (milliseconds between startup retries when DB is temporarily unavailable).
9. For Google Sign-In, add each frontend origin you use (for example `http://localhost:3000` and your production domain) to OAuth Authorized JavaScript origins in Google Cloud.

---

## 🌍 API Overview

- All API endpoints are hosted via the server in `/ba_server`
- See `/ba_server/src/routes/` for route definitions
- Extend or document APIs as your project evolves!

---

## 📝 Contributing

PRs, issues, and feedback are welcome!

- Fork the repo → make your changes → open a PR
- Please provide clear commit messages and update docs/examples as needed

---

## 💬 Support

- For issues or help, use [GitHub Issues](https://github.com/AJ4200/Baturo-Arena/issues)
- [Project Homepage](https://baturo-arena.vercel.app)

---

## 📄 License

Released under the [MIT License](LICENSE).

---

### ⭐️ Enjoy Baturo-Arena? Star this repo and join the competition!
