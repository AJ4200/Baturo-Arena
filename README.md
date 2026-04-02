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
2. Set `POSTGRES_URL` for the API server.
3. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for Google Sign-In (used for online multiplayer account access).

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
