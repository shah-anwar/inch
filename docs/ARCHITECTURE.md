# Architecture — inch

## High-Level Overview

inch follows a **client-server architecture** with a clear separation between presentation, business logic, data persistence, and caching layers.

```
┌─────────────┐     HTTP (REST)     ┌─────────────────┐     PostgreSQL     ┌──────────────┐
│   Browser    │ ◄─────────────────► │  Backend Server  │ ◄───────────────► │  PostgreSQL   │
│  (React SPA) │     WebSocket       │   (Fastify)      │                   │   Database    │
└─────────────┘                     └─────────────────┘                   └──────────────┘
                                           │
                                           │ (optional)
                                           ▼
                                   ┌──────────────┐
                                   │    Redis      │
                                   │ (Cache+Queue) │
                                   └──────────────┘
```

## Frontend

| Concern | Technology | Version | Notes |
|---------|-----------|---------|-------|
| Framework | React | 19.2.0 | Component-based SPA |
| Language | TypeScript | 5.9.3 | Strict mode enabled |
| Build Tool | Vite | 7.3.1 | Fast HMR, ES modules |
| Styling | Tailwind CSS | 4.1.18 | Utility-first, v4 (no config file) |
| UI Components | shadcn/ui | 0.0.4 | New York style, gray base colour |
| Graph Visualisation | Cytoscape.js | 3.33.1 | Interactive argument graphs |
| State Management | Zustand | 5.0.11 | debateStore, graphStore, schemeStore |
| Server State | TanStack Query | 5.90.21 | Configured with QueryClientProvider; hooks in `hooks/useApi.ts` for topics, arguments, search, admin, and LLM-backed text preview / release endpoints |
| Forms | react-hook-form | 7.71.1 | With @hookform/resolvers |
| Validation | Zod | 4.3.6 | Shared schemas with backend |
| Routing | react-router-dom | 7.13.0 | Client-side routing |
| HTTP Client | Axios | 1.13.5 | API calls |
| Icons | Lucide React | 0.574.0 | Icon library |

### Frontend Structure

```
frontend/src/
├── main.tsx              # Entry point (AuthProvider + QueryClientProvider + App)
├── App.tsx               # ThemeProvider + BrowserRouter + Routes
├── components/
│   ├── ArgumentDetail.tsx    # Argument detail panel stub (transitional)
│   ├── ArgumentGraph.tsx     # Cytoscape graph visualisation (real data, minimap + fullscreen)
│   ├── ArgumentView.tsx      # Argument card with stored prose text, variables, status, view count
│   ├── ChildrenList.tsx      # Cursor-paginated children with 5 sort options
│   ├── CondensedView.tsx     # Compact ancestor thread using stored argument text
│   ├── CounterArgumentDrawer.tsx # CQ → scheme → variables → text selection counter-argument drawer
│   ├── InitialArgumentDrawer.tsx # Scheme → variables → text selection initial argument drawer
│   ├── SchemeSuggester.tsx       # LLM-assisted scheme suggestion in InitialArgumentDrawer
│   ├── SearchResultRow.tsx       # Individual search result row
│   ├── AuthGuard.tsx         # Route protection (redirect to /login, preserves URL)
│   ├── Navbar.tsx            # Navigation bar (breadcrumb, search, admin link, user menu)
│   ├── UserMenu.tsx          # User dropdown menu
│   ├── login-form.tsx        # Login form with API integration
│   ├── signup-form.tsx       # Signup form with API and auto-login
│   ├── theme-provider.tsx    # Dark/light/system theme context
│   ├── mode-toggle.tsx       # Theme toggle button
│   ├── password-eye-toggle.tsx
│   └── ui/                   # shadcn/ui primitives (Input, Button, Textarea, Skeleton, etc.)
├── hooks/
│   ├── useAuth.tsx           # Auth context (token, user, localStorage)
│   ├── useUserData.tsx       # Wrapper around useAuth().user
│   ├── useArgumentUpdates.ts # WebSocket hook for real-time status updates
│   └── useApi.ts             # TanStack Query hooks (topics, arguments, search, admin, LLM preview/suggest)
├── lib/
│   ├── api.ts                # Shared Axios apiClient with auth interceptor
│   ├── argument.ts           # Argument types and status enums (mock/local)
│   ├── argumentForm.ts       # buildVariableSchema(), conclusionPreview() utilities
│   └── utils.ts              # cn() class merge utility
├── stores/
│   ├── index.ts              # Barrel export for all stores
│   ├── debateStore.ts        # Selected topic/subtopic/argument navigation state
│   ├── graphStore.ts         # Graph layout, fullscreen, minimap, highlight/hover
│   └── schemeStore.ts        # Scheme registry (populated from @inch/types)
└── pages/
    ├── MainPage.tsx          # Primary argument exploration view (mock data); / redirects to /topics
    ├── TopicsPage.tsx        # /topics — card grid, useTopics()
    ├── SubtopicsPage.tsx     # /topics/:topicId — card grid, useSubtopics()
    ├── SubtopicPage.tsx      # /topics/:topicId/:subtopicId — initial arguments + sort + InitialArgumentDrawer
    ├── ArgumentPage.tsx      # /arg/:argumentId — thread, detail, children, minimap
    ├── SearchPage.tsx        # /search?q=term — paginated full-text results
    ├── LoginPage.tsx         # Login page
    ├── SignupPage.tsx        # Signup page
    ├── ProfilePage.tsx       # User profile (fetches GET /me, AuthGuard protected)
    ├── AboutPage.tsx         # Placeholder
    ├── ContactPage.tsx       # Placeholder
    ├── HomePage.tsx          # Unused placeholder
    └── AdminPage.tsx         # Admin-only scheme and CQ management UI (route: /admin)
```

## Backend

| Concern | Technology | Version | Notes |
|---------|-----------|---------|-------|
| Framework | Fastify | 5.7.4 | High-performance HTTP server |
| Language | TypeScript | 5.9.3 | ES modules, NodeNext |
| ORM | Prisma | 7.4.1 | Type-safe DB access (spec says Drizzle) |
| Database | PostgreSQL | via pg 8.18.0 | Relational storage |
| Auth | bcrypt + jsonwebtoken | 6.0.0 / 9.0.3 | Password hashing + JWT |
| Validation | Zod | 4.3.6 | Shared schemas |
| Cache + Queue | ioredis | 5.9.3 | Required for BullMQ evaluation queue; also provides optional cache-aside for hot reads. The app starts without Redis (`REDIS_URL` unset) but argument evaluation will not run. |
| AI | Mistral HTTP API | via `axios` | Used for creation-time argument text variants in `backend/src/modules/argumentation/llm/argument-text.ts` and optional backend-only path dialogue rendering |
| Dev Server | tsx | 4.21.0 | Watch mode for development |

### Backend Structure

```
backend/src/
├── server.ts                 # Fastify entry point (CORS, routes, listen)
├── db/
│   └── prisma.ts             # Prisma client instance
├── modules/
│   ├── user/
│   │   ├── user.routes.ts    # /me, /users, /login routes
│   │   ├── user.service.ts   # createUser, loginUser
│   │   └── user.repository.ts
│   ├── topic/
│   │   ├── topic.routes.ts       # /topics, /topics/:id/subtopics routes
│   │   ├── topic.service.ts      # Topic/subtopic business logic
│   │   └── topic.repository.ts   # Topic/subtopic data access
│   ├── argumentation/
│   │   ├── argument.routes.ts    # /arguments/* routes: creation, text preview, retrieval, ancestors, children, render, suggest, path-dialogue
│   │   ├── argument.service.ts   # Submission, creation-time text preview, enriched argument, context, ancestors, children
│   │   ├── argument.repository.ts # Argument data access, child statuses, cursor pagination
│   │   ├── scheme.repository.ts   # List schemes from DB (for LLM prompts; admin-managed set)
│   │   ├── evaluation.ts         # Grounded semantics pure function
│   │   ├── llm/
│   │   │   ├── argument-text.ts  # Mistral-backed creation-time text generation + stored text lookup
│   │   │   ├── mistral.ts        # Shared Mistral client wrapper
│   │   │   ├── moderation.ts     # Variable-input moderation (before text preview) + submission-time text hook
│   │   │   └── scheme-matcher.ts # Free-text → ranked schemes + prefill (Mistral JSON, validates against DB)
│   │   ├── nlrender.ts           # Stored argument text response wrapper
│   │   ├── scheme-suggester.ts   # Re-exports rankSchemesFromFreeText as suggestSchemes
│   │   └── schemes.json          # Empty placeholder (schemes in @inch/types)
│   ├── search/
│   │   ├── search.routes.ts     # GET /search — full-text search
│   │   └── search.service.ts    # Search across topics, subtopics, argument variables
│   └── admin/
│       ├── admin.routes.ts       # /admin/schemes, /admin/critical-questions admin-only routes
│       └── admin.service.ts      # Scheme and critical question management logic
├── queue/
│   ├── evaluationQueue.ts    # BullMQ queue definition
│   └── evaluationWorker.ts   # Evaluation worker (branch load, evaluate, write, WS emit)
├── websocket/
│   └── ws.ts                 # @fastify/websocket plugin, subtopic rooms, STATUS_UPDATE
├── cache/
│   └── redis.ts              # Optional Redis client getter + BullMQ connection helper
├── seed.ts                   # Database seed script
├── load-test-seed.ts         # Diagnostic seed + grounded semantics load test (100-argument chain)
├── types/
│   └── fastify.d.ts          # Fastify type augmentations
└── utils/
    ├── auth.ts               # getAuthenticatedUser, getAdminUser (JWT verification + admin guard)
    └── validate.ts           # Validation utilities
```

### Shared Types Package

```
shared/types/
├── package.json              # @inch/types
└── src/
    ├── index.ts              # Re-exports all modules
    ├── data/
    │   ├── schemes.json      # 8 argumentation schemes, 27 CQs (Phase 1)
    │   └── index.ts          # Loads and validates schemes, exports helpers (schemes, getSchemeById, getCriticalQuestion, getValidResponseSchemes, getSchemesRegistry)
    └── modules/
        ├── user.ts           # Zod schemas: CreateUser, Login, GetMe
        ├── topic.ts          # CreateTopic, Topic, CreateSubtopic, CreateSubtopicBody, Subtopic
        ├── argument.ts       # CreateInitialArgument, CreateCounterArgument, GenerateArgumentTextRequest/Response, moderation_failed response schemas, ChildrenByStatus, ArgumentWithChildrenByStatus, ArgumentContext, AncestorNode, AncestorChain, ChildrenSort, PaginatedChildren, RenderArgumentResponse, SuggestArgumentRequest/Response, SchemeSuggestion, PathDialogueRequest/Response
        ├── argumentation.ts  # ArgumentStatus, StatusUpdatePayload, Scheme, CriticalQuestion, SchemesRegistry
        ├── admin.ts          # AdminScheme, AdminCriticalQuestion, Create/Update schemas for schemes and CQs
        └── render.ts         # renderArgumentText() — template variable substitution
```

## LLM Pipeline Design Decisions

### Moderation-before-generation gate

Variable input moderation is performed as a mandatory step before any call to the text generation LLM. This ordering is a deliberate design decision with two motivations:

1. **Integrity** — arguments whose variable values are incoherent, offensive, or semantically invalid relative to their scheme should never reach the text generation stage. Generating polished natural language for bad inputs would give them false legitimacy.
2. **Token efficiency** — moderation calls are cheap. Blocking invalid inputs before generation avoids wasting generation tokens on content that will never be stored. At scale this is a meaningful cost saving.

The moderation step is a hard block. There is no user override. The user must correct flagged variable values before text generation proceeds.

**Prompt strategy selection** — the moderation prompt design was chosen empirically via the experiments suite (`experiments/results/moderation/`). Four variants were evaluated across 33 labelled cases on `mistral-small-latest`. The **withContext** variant was selected: it includes the scheme's conclusion template alongside variable labels and values, giving the model a compact view of how slots compose into the scheme's claim. This achieved F1 0.9412, precision 0.9412, recall 0.9412, true pass rate 0.9375, and a token-efficiency score of 3.709 at ~254 tokens per request — the best balance of accuracy and cost across all variants tested. Full results are in `experiments/results/moderation/summary.json`.

On LLM or JSON-parse failure, moderation **fails open** (allows the request): the gate must not block users when the model is unavailable or returns unusable output; errors are logged server-side.

## Database

- **Engine**: PostgreSQL
- **ORM**: Prisma (note: spec calls for Drizzle ORM — current implementation uses Prisma instead)
- **Current schema**: User, Topic, Subtopic, Argument, ArgumentVariable, Scheme, CriticalQuestion
- **Migrations**: `20260223162820_init` (User), `20260314001414_add_core_entities` (all core entities), `20260316145918_add_view_count`, `20260316151317_add_view_count_field`, `20260416123000_add_argument_text`

## Communication Patterns

### Currently Implemented
- **REST API** over HTTP (Fastify routes)
  - `POST /users` — Register
  - `POST /login` — Authenticate (returns JWT)
  - `GET /me` — Current user (requires Bearer token)
  - `GET /topics` — List all topics
  - `GET /topics/:topicId` — Single topic
  - `POST /topics` — Create topic (auth required)
  - `GET /topics/:topicId/subtopics` — List subtopics
  - `GET /topics/:topicId/subtopics/:subtopicId` — Single subtopic
  - `POST /topics/:topicId/subtopics` — Create subtopic (auth required)
  - `POST /arguments/initial` — Submit initial argument with stored chosen text (auth required)
  - `POST /arguments/counter` — Submit counter-argument with stored chosen text (auth required)
  - `POST /arguments/text-options` — Variable-input moderation (Mistral JSON) then generate 3 neutral text variants during argument creation (auth required); returns `422` with `moderation_failed` when inputs are rejected
  - `POST /arguments/text-options/release` — Release a cached preview token when the user backs out of text selection
  - `GET /subtopics/:subtopicId/arguments` — All arguments in a subtopic
  - `GET /arguments/:id` — Single argument (enriched with childrenByStatus); increments viewCount (fire-and-forget)
  - `GET /arguments/:id/context` — Argument + subtopic + topic (breadcrumb data)
  - `GET /arguments/:id/ancestors` — Ancestor chain from root to argument
  - `GET /arguments/:id/children` — Cursor-paginated children; sort: newest, oldest, most_descendants, status, most_viewed
  - `GET /arguments/:id/render` — Return stored selected text for a single argument
  - `POST /arguments/suggest` — Authenticated free-text scheme + variable-prefill suggestions (Mistral-backed; schemes from DB)
  - `POST /arguments/path-dialogue` — Natural language dialogue rendering for a path along an ancestor chain (Mistral-backed)
  - `GET /admin/schemes` — List all schemes with nested critical questions (admin only)
  - `GET /admin/schemes/:schemeId` — Get single scheme with nested critical questions (admin only)
  - `POST /admin/schemes` — Create scheme (admin only)
  - `PATCH /admin/schemes/:schemeId` — Update scheme fields except ID (admin only)
  - `GET /admin/schemes/:schemeId/critical-questions` — List CQs for a scheme (admin only)
  - `POST /admin/schemes/:schemeId/critical-questions` — Create CQ for a scheme (admin only)
  - `PATCH /admin/critical-questions/:cqId` — Update CQ (admin only)
- **WebSocket** — Real-time argument status updates
  - `WS /ws?subtopicId=N` — Join subtopic room, receive STATUS_UPDATE events

### Planned (Not Yet Implemented)
- (none)

## Argument Submission Flow (Implemented)

```
User selects scheme/CQ → Fills variables → Requests 3 text variants → Chooses one → Submits argument
    │
    ▼
Backend validates (scheme exists, variables complete, structural constraints)
    │
    ▼
Preview token checked against cached generated variants → chosen `argumentText` stored in DB → BullMQ job enqueued → Evaluation worker runs grounded semantics
    │
    ▼
Statuses written to DB → WebSocket broadcasts STATUS_UPDATE to subtopic room
```

## Monorepo Setup

- **Package manager**: npm with workspaces
- **Workspaces**: `frontend`, `backend`, `shared/types`
- **Shared types**: `@inch/types` package with Zod schemas used by both frontend and backend
- **No Docker, CI/CD, or deployment configuration exists yet**

## Spec vs Implementation Discrepancy

| Aspect | Spec Says | Implementation Uses |
|--------|-----------|-------------------|
| ORM | Drizzle ORM | Prisma |

This is a notable divergence. The spec explicitly calls for Drizzle ORM for type-safe query construction. The codebase uses Prisma instead. This should be flagged as a decision to document or reconcile.
