# Myonites

Cross-platform workout scheduling app — iOS, Android, Web — from a single codebase.

## Architecture

```
myonites/
├── apps/app/          → Expo (React Native) — iOS, Android, Web
├── packages/shared/   → TypeScript types, interfaces, business logic (zero platform deps)
├── server/            → Vercel serverless API routes
├── tools/             → Dev-time scripts (FFmpeg, Whisper, etc.)
├── content/           → Exercise events, captions, meditation data
├── turbo.json         → Turborepo task pipeline
└── pnpm-workspace.yaml
```

---

## Phase 1 Setup — Step by Step

### Prerequisites

Make sure you have these installed. Run each verify command to confirm:

```bash
node --version    # Need v20+
pnpm --version    # Need v9+   (install: npm install -g pnpm)
git --version     # Any recent version
```

### Step 1 — Clone and install

If you already created an empty GitHub repo:

```bash
git clone https://github.com/YOUR_USERNAME/myonites.git
cd myonites
```

Otherwise, start local and push later:

```bash
mkdir myonites && cd myonites
git init
```

Copy all the project files into this directory (the ones from this scaffold), then:

```bash
pnpm install
```

**What this does:** pnpm reads `pnpm-workspace.yaml`, discovers the three workspaces (`apps/app`, `packages/shared`, `server`), installs all their dependencies, and symlinks `@myonites/shared` so the app and server can import from it directly.

### Step 2 — Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials from your project dashboard (Settings → API).

### Step 3 — Build the shared package

The app depends on `@myonites/shared`, so build it first:

```bash
pnpm --filter @myonites/shared build
```

**What this does:** Runs the TypeScript compiler on `packages/shared/src/`, outputs JavaScript + type declarations to `packages/shared/dist/`. The app and server import from this built output.

### Step 4 — Run the app

**Web (fastest to verify):**
```bash
pnpm --filter @myonites/app dev:web
```
Opens in your browser. You should see "Myonites" with the platform shown as "web" and the mood labels from the shared package.

**iOS (requires Expo Go on your iPhone):**
```bash
pnpm --filter @myonites/app dev:ios
```
Scan the QR code with your phone camera. Expo Go opens the app.

**Android (requires Expo Go on your Android device):**
```bash
pnpm --filter @myonites/app dev:android
```

**All platforms at once:**
```bash
pnpm dev
```
Turborepo runs `dev` across all workspaces in parallel.

### Step 5 — Verify the setup

You know everything is wired correctly when:

- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @myonites/shared build` produces `packages/shared/dist/`
- [ ] `pnpm --filter @myonites/app dev:web` shows the home screen with mood labels
- [ ] The home screen says "Running on web" / "Running on ios" / "Running on android"
- [ ] `pnpm typecheck` passes with no errors

---

## Key Concepts for a First-Time Monorepo

### What is a monorepo?

Instead of separate Git repos for the app, server, and shared code, everything lives in one repo. The workspaces (`apps/app`, `packages/shared`, `server`) are like mini-projects that can depend on each other.

### What does pnpm workspaces do?

`pnpm-workspace.yaml` tells pnpm which folders are packages. When you write `"@myonites/shared": "workspace:*"` in a package.json, pnpm links directly to the local folder instead of downloading from npm. Changes to `packages/shared` are immediately available in the app.

### What does Turborepo do?

`turbo.json` defines a task pipeline. When you run `pnpm build`, Turborepo knows to build `packages/shared` *before* `apps/app` (because the app depends on shared). It also caches build outputs — if shared hasn't changed, it skips rebuilding it.

### How does the app import from shared?

The app's `package.json` has `"@myonites/shared": "workspace:*"`. In code:

```typescript
import { MOOD_LABELS } from '@myonites/shared';
import type { Session, Exercise } from '@myonites/shared';
```

### What is the repository pattern?

All database access goes through interfaces (in `packages/shared/src/repositories/interfaces/`). The current Supabase implementations will live in `packages/shared/src/repositories/supabase/`. When you migrate to AWS, you write new implementations without changing any app code.

### Why is shared "zero platform deps"?

`packages/shared` has no React Native, no Expo, no browser APIs. It's pure TypeScript — types, interfaces, and business logic. This means it can be used by the app, the server, future CLI tools, or tests without pulling in platform-specific code.

---

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install all dependencies across workspaces |
| `pnpm dev` | Start all workspaces in dev mode |
| `pnpm build` | Build everything (shared → app → server) |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm test` | Run all tests |
| `pnpm --filter @myonites/app dev:web` | Run just the web app |
| `pnpm --filter @myonites/shared build` | Build just the shared package |
| `pnpm clean` | Remove all build artifacts and node_modules |

---

## What's Next (Rest of Phase 1)

After this scaffold is running, Phase 1 continues with:

1. **Supabase setup** — Create the database schema (tables from the spec), enable RLS
2. **Auth flow** — Implement `AuthService` with Supabase Auth, build login/signup screens
3. **Repository implementations** — Supabase implementations of the repository interfaces
4. **PoseEstimator interface** — Already defined, web prototype with MediaPipe next
5. **CI/CD** — GitHub Actions (already scaffolded in `.github/workflows/ci.yml`)
