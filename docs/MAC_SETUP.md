# macOS Setup Guide — inch

> **Last verified on macOS**: 2026-03-16 — Apple Silicon and Intel, Node.js v22.x, npm 10.x, before the switch to a self-managed PostgreSQL.
> **Since then:** the platform-independent steps (4–7: `npm ci`, Prisma, seed, start) were verified end to end on 2026-11-06, on Windows against PostgreSQL 14 and Redis 6 (see [WINDOWS_SETUP.md](WINDOWS_SETUP.md)). The Homebrew install steps (2–3) have not been re-run on macOS.

This guide covers running inch on macOS. The steps match the Quick start in the [README](../README.md): you provide your own PostgreSQL and Redis.

---

## Prerequisites

### Required Software

| Software | Version | Purpose | Install |
|---|---|---|---|
| Node.js | 20.x LTS or later | Runtime | [nodejs.org](https://nodejs.org/) or `nvm install --lts` |
| npm | Bundled with Node.js | Package manager | Included with Node.js |
| PostgreSQL | Any recent version | Database | `brew install postgresql@16`, or Docker |
| Redis | Latest | BullMQ + caching | `brew install redis` |
| Git | Latest | Version control | Pre-installed on macOS or via Xcode CLI |

### Optional Tools

| Software | Purpose | Notes |
|---|---|---|
| iTerm2 | Terminal | Alternative to the built-in Terminal app |
| VS Code | Editor | Install TypeScript, ESLint and Prettier extensions |

A Mistral API key is optional. Without one, the LLM helpers fall back to deterministic behaviour (see [backend/.env.example](../backend/.env.example)).

---

## Step-by-Step Setup

### 1. Install Node.js

Using Homebrew + `nvm` (recommended):

```bash
brew install nvm
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
source ~/.zshrc
nvm install --lts
node --version
npm --version
```

Or download the macOS installer from [nodejs.org](https://nodejs.org/).

### 2. Install and Start PostgreSQL

```bash
brew install postgresql@16
brew services start postgresql@16
createdb inch
```

Or run it in Docker:

```bash
docker run -d --name inch-postgres -e POSTGRES_PASSWORD=<choose-a-password> -p 5432:5432 postgres:16
```

Any PostgreSQL you can create tables in will work.

### 3. Install and Start Redis

```bash
brew install redis
brew services start redis
redis-cli ping
```

`redis-cli ping` should print `PONG`. Redis runs on port 6379 by default. Without Redis the backend still starts, but new arguments stay `UNDECIDED` because the evaluation worker does not run.

### 4. Clone the Repository and Install Dependencies

```bash
git clone <repo-url> inch
cd inch
npm ci
```

This installs every workspace (`frontend`, `backend`, `shared/types`, `experiments`) from the committed lockfile.

### 5. Configure Environment Variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

- **`DATABASE_URL`**: your PostgreSQL connection string, e.g. `postgresql://<user>@localhost:5432/inch`
- **`JWT_SECRET`**: a long random string
- **`REDIS_URL`**: `redis://localhost:6379`
- **`MISTRAL_API_KEY`**: optional

The frontend needs no `.env` when the backend runs on `http://localhost:3000`.

### 6. Generate the Prisma Client, Apply Migrations and Seed

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npm run seed
```

The seed creates demo accounts that share one demo password. Change it before seeding a database other people can reach (see "Demo accounts" in the README).

### 7. Start the Backend

From `backend/`:

```bash
npm run dev
```

`npm run dev` restarts on file changes. `npm start` runs the server once with `tsx`. The backend listens on `http://localhost:3000`.

### 8. Start the Frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

The frontend runs on `http://localhost:5173` (default Vite port).

---

## Troubleshooting

### `bcrypt` Native Compile Errors

`bcrypt` uses native bindings. On most macOS systems it works once the Xcode Command Line Tools are installed:

```bash
xcode-select --install
```

### Rollup Native Binary Issues

On macOS, Vite relies on a platform-specific Rollup binary:

- Apple Silicon: `@rollup/rollup-darwin-arm64`
- Intel: `@rollup/rollup-darwin-x64`

If `npm run dev` in `frontend` fails with a missing Rollup binary, reinstall from the lockfile:

```bash
rm -rf node_modules frontend/node_modules backend/node_modules
npm ci
```

### Database Connection Errors (P1001)

Check `DATABASE_URL` in `backend/.env`, and that PostgreSQL is running:

```bash
brew services list
```

### Redis Not Running

If the backend logs Redis connection errors (`ECONNREFUSED`):

```bash
brew services start redis
redis-cli ping
```

You should see `PONG`.

---

## Differences from Windows Setup

- **Redis and PostgreSQL**: Installed via Homebrew instead of Memurai and the Windows installer.
- **Terminal**: Use the macOS Terminal app or iTerm2 instead of PowerShell.
- **CPU Architecture**: Apple Silicon Macs use `arm64` binaries; Intel Macs use `x64`.
- **Signals**: `SIGINT` (`Ctrl+C`) behaves the same on macOS and Windows in Node.js.

---

## Quick Start Cheatsheet

```bash
# 1. From project root
npm ci

# 2. Environment
cp backend/.env.example backend/.env
# set DATABASE_URL (your PostgreSQL), JWT_SECRET, REDIS_URL=redis://localhost:6379

# 3. Database
cd backend
npx prisma generate
npx prisma migrate deploy
npm run seed

# 4. Backend (terminal 1)
npm run dev

# 5. Frontend (terminal 2)
cd ../frontend
npm run dev
```
