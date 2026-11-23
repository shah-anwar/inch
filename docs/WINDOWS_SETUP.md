# Windows Native Setup Guide — inch

> **Last verified**: 2026-11-06, end to end (steps 4–7 with `npm start`):
> - Windows 10 (10.0.19045), Node.js v26.13.0, npm 11.20.0
> - PostgreSQL 14.24 and Redis 6.0.16 running in WSL (Ubuntu 22.04), as described in [Using WSL for PostgreSQL and Redis](#using-wsl-for-postgresql-and-redis)
> - An earlier pass, before the switch to a self-managed database, used Node.js v22.14.0 and npm 10.9.2.

This guide covers running inch's Node.js code natively on Windows. The steps match the Quick start in the [README](../README.md): you provide your own PostgreSQL and Redis, natively, in Docker, or in WSL.

---

## Prerequisites

### Required Software

| Software | Version | Purpose | Install |
|----------|---------|---------|---------|
| Node.js | 20.x LTS or later (verified: v22.14.0) | Runtime | [nodejs.org](https://nodejs.org/) — use the Windows installer |
| npm | Bundled with Node.js (verified: 10.9.2) | Package manager | Included with Node.js |
| PostgreSQL | Any recent version | Database | [postgresql.org/download/windows](https://www.postgresql.org/download/windows/), or Docker |
| Redis | Latest (or Memurai) | BullMQ evaluation queue + caching | See the Redis section below |
| Git | Latest (verified: 2.31.0) | Version control | [git-scm.com](https://git-scm.com/download/win) |

### Optional Software

| Software | Purpose | Notes |
|----------|---------|-------|
| Memurai | Redis-compatible Windows cache | [memurai.com](https://www.memurai.com/) — native Windows Redis alternative |
| pgAdmin | PostgreSQL GUI | Often bundled with the PostgreSQL installer |
| VS Code | Editor | Recommended with ESLint + Prettier extensions |

A Mistral API key is optional. Without one, the LLM helpers fall back to deterministic behaviour (see [backend/.env.example](../backend/.env.example)).

---

## Step-by-Step Setup

### 1. Install Node.js

1. Download the **Windows Installer (.msi)** from [nodejs.org](https://nodejs.org/).
2. Run the installer. Ensure "Add to PATH" is checked.
3. Verify installation:

```powershell
node --version
npm --version
```

### 2. PostgreSQL (your own instance)

Install PostgreSQL locally, or run it in Docker, then create an empty database for inch:

```powershell
docker run -d --name inch-postgres -e POSTGRES_PASSWORD=<choose-a-password> -p 5432:5432 postgres:16
```

Any PostgreSQL you can create tables in will work. Note the connection details for `DATABASE_URL` in step 5.

### 3. Install Redis / Memurai (Required for evaluation)

Redis is **required** for argument evaluation. The BullMQ evaluation queue (`backend/src/queue/evaluationQueue.ts`) uses it to process an evaluation job after each argument submission. If `REDIS_URL` is unset, the backend still starts, but the worker does not, so new arguments stay `UNDECIDED`. Redis is also used as an optional cache for hot reads.

**Option A: Memurai** (recommended for Windows)
1. Download from [memurai.com](https://www.memurai.com/).
2. Install and start the Memurai service.
3. Default port: 6379 (same as Redis).

**Option B: Docker**
```powershell
docker run -d --name redis -p 6379:6379 redis:latest
```

**Option C: WSL** — see the next section.

### Using WSL for PostgreSQL and Redis

If you have WSL 2 with Ubuntu, you can run both services there and keep Node.js on Windows. This is how the guide was last verified.

```bash
# Inside WSL (wsl -d Ubuntu)
sudo apt update
sudo apt install -y postgresql redis-server
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER inch WITH PASSWORD '<choose-a-password>';"
sudo -u postgres createdb -O inch inch
redis-server --daemonize yes --port 6379
```

Both services listen on `127.0.0.1` inside WSL. WSL 2 forwards those ports to Windows, so from Windows they are reachable on `localhost`:

```env
DATABASE_URL=postgresql://inch:<your-password>@localhost:5432/inch
REDIS_URL=redis://localhost:6379
```

To check from PowerShell that the ports are reachable:

```powershell
Test-NetConnection localhost -Port 5432
Test-NetConnection localhost -Port 6379
```

Both should report `TcpTestSucceeded : True`. If they don't (for example, localhost forwarding is turned off in `.wslconfig`), use the address printed by `wsl hostname -I` instead of `localhost`, and make PostgreSQL listen on it (`listen_addresses` in `postgresql.conf`, plus a matching `pg_hba.conf` entry).

### 4. Clone and Install Dependencies

```powershell
git clone <repo-url> inch
cd inch
npm ci
```

This installs every workspace (frontend, backend, shared/types, experiments) from the committed lockfile.

### 5. Configure Environment Variables

```powershell
copy backend\.env.example backend\.env
```

Edit `backend/.env`:
- `DATABASE_URL`: your PostgreSQL connection string, e.g. `postgresql://postgres:<password>@localhost:5432/postgres`
- `JWT_SECRET`: a long random string
- `REDIS_URL`: `redis://localhost:6379`
- `MISTRAL_API_KEY`: optional

The frontend needs no `.env` when the backend runs on `http://localhost:3000`. Copy `frontend\.env.example` to `frontend\.env` only to change that.

> **Note**: Use forward slashes in `DATABASE_URL` even on Windows; it is a standard URI.

### 6. Generate the Prisma Client, Apply Migrations and Seed

```powershell
cd backend
npx prisma generate
npx prisma migrate deploy
npm run seed
```

- `prisma generate` reads `DATABASE_URL` from `backend/.env`, even though it does not connect.
- `migrate deploy` creates the tables.
- `seed` loads the schemes and demo debates, and creates the demo accounts. See "Demo accounts" in the README, and change the shared demo password before seeding a database other people can reach.

### 7. Start the Backend

```powershell
cd backend
npm run dev
```

`npm run dev` regenerates the Prisma client and restarts on file changes. `npm start` runs the server once with `tsx` and no file watching. Either way the backend listens on `http://localhost:3000`; the port is fixed in `src/server.ts`.

### 8. Start the Frontend

Open a new terminal:

```powershell
cd frontend
npm run dev
```

The frontend starts on `http://localhost:5173` (default Vite port).

---

## Audit: Windows Compatibility Issues

### package.json Scripts

| Package | Script | Command | Windows Compatible? |
|---------|--------|---------|-------------------|
| frontend | dev | `vite` | Yes |
| frontend | build | `tsc -b && vite build` | Yes (`&&` works in PowerShell and cmd) |
| frontend | lint / lint:check | `eslint src --fix` / `eslint src` | Yes |
| frontend | format / format:check | `prettier src --write` / `prettier src --check` | Yes |
| frontend | preview | `vite preview` | Yes |
| backend | dev | `prisma generate && tsx watch --ignore src/generated src/server.ts` | Yes |
| backend | start | `tsx src/server.ts` | Yes |
| backend | build | `prisma generate && tsc && tsc-alias` | Yes |
| backend | start:prod | `node dist/backend/src/server.js` | Yes |
| backend | test | `cross-env NODE_OPTIONS=--experimental-vm-modules jest` | Yes (`cross-env` sets the variable portably) |
| backend | seed | `tsx src/seed.ts` | Yes |
| backend | prisma:studio / prisma:migrate | `prisma studio` / `prisma migrate dev` | Yes |
| backend | lint / lint:check, format / format:check | as for frontend | Yes |
| backend | bench:nfr / bench:nfr:pipeline | `tsx scripts/...` | Yes |

All scripts use cross-platform Node.js tools. There are no `rm -rf`, `cp`, shebangs or other Unix-only commands.

### Path Separators

- **Vite config**: Uses `path.resolve` with `__dirname` — cross-platform.
- **TypeScript configs**: Use `/` in `paths` — TypeScript handles this cross-platform.
- **Prisma config**: Uses relative paths — cross-platform.
- **ESLint config**: No path issues.

### Line Endings

`.gitattributes` sets `eol=lf` for text files, so they are checked out with LF endings even when Git's `core.autocrlf` is `true`. This keeps `prettier --check` (which expects LF) from flagging every file on Windows.

### Signal Handling

`backend/src/server.ts` uses `process.on("SIGINT", ...)`. Node.js supports `SIGINT` on Windows in a terminal, so Ctrl+C works.

---

## Troubleshooting

### `prisma migrate deploy` fails with a connection error (P1001)
1. Check `DATABASE_URL` in `backend/.env`: host, port, user, password and database name.
2. Make sure the PostgreSQL service (or container) is running and reachable on that port.

### `prisma generate` says `DATABASE_URL is not set in .env`
`backend/prisma.config.ts` requires `DATABASE_URL` even for `generate`. Create `backend/.env` first (step 5).

### Port conflicts
If port 3000 or 5173 is already in use:
```powershell
netstat -ano | findstr :3000
# Kill the process using the PID shown
taskkill /PID <pid> /F
```

### `bcrypt` build errors
`bcrypt` requires native compilation. As of 2026-03-13, native bcrypt (v6.0.0) compiled successfully on Node.js v22.14.0 / Windows 10 without additional build tools. If you get build errors on a different machine, install Visual Studio Build Tools with the "Desktop development with C++" workload, then retry `npm ci`.

### Vite / Rollup native binary missing
If `npm run dev` in the frontend fails with:
```
Cannot find module @rollup/rollup-win32-x64-msvc
```
This is a [known npm bug](https://github.com/npm/cli/issues/4828) with optional dependencies. Remove the installed packages and reinstall from the lockfile:
```powershell
# From project root
Remove-Item -Recurse -Force node_modules, frontend\node_modules, backend\node_modules -ErrorAction SilentlyContinue
npm ci
```

### Long file paths
If you encounter `ENAMETOOLONG` errors:
```powershell
git config --system core.longpaths true
```

---

## Quick Start Cheatsheet

```powershell
# 1. Install dependencies (from project root)
npm ci

# 2. Environment
copy backend\.env.example backend\.env
# set DATABASE_URL (your PostgreSQL), JWT_SECRET, REDIS_URL=redis://localhost:6379

# 3. Database
cd backend
npx prisma generate
npx prisma migrate deploy
npm run seed

# 4. Backend (terminal 1, Redis/Memurai already running)
npm run dev

# 5. Frontend (terminal 2)
cd frontend
npm run dev
```
