# Requirements — inch

All requirements are derived from the original project specification. Status is based on a codebase audit conducted 2026-03-16.

---

## Functional Requirements

### 3.1.1 Argument Creation and Representation

#### FR1: Structured Argument Entry
The system shall prohibit free-text argument submission and require all arguments to be constructed using predefined argumentation schemes.

**Status: `COMPLETE`**
> Backend: `POST /arguments/initial` and `POST /arguments/counter` in `backend/src/modules/argumentation/argument.routes.ts` validate against `CreateInitialArgumentSchema` / `CreateCounterArgumentSchema` (Zod). `argument.service.ts` verifies scheme existence via `schemes.schemes.find()`. Frontend: `InitialArgumentDrawer` and `CounterArgumentDrawer` enforce scheme selection before variable entry; no free-text argument path exists.

---

#### FR2: Scheme Variable Enforcement
The system shall require users to provide all mandatory variables associated with a selected argumentation scheme before an argument can be submitted.

**Status: `COMPLETE`**
> Backend: `validateVariables()` in `argument.service.ts` checks all required scheme variables are present and non-empty. Frontend: `buildVariableSchema()` in `lib/argumentForm.ts` generates a Zod schema per scheme; `react-hook-form` with `zodResolver` enforces it before submission. Both layers reject incomplete arguments.

---

#### FR3: Storage of Argument Components
The system shall store arguments as structured entities consisting of the applied scheme, variable values, premises, conclusions, and relationships to other arguments.

**Status: `COMPLETE`**
> The `Argument` Prisma model stores `schemeId`, `selectedCqId`, `parentId`, `parentType`, `isInitial`, `subtopicId`, `status`, `childIds`, `descendantCount`, and `viewCount`. Related `ArgumentVariable` records store per-variable values. Full CRUD retrieval via `GET /arguments/:id`, `GET /arguments/:id/context`, `GET /arguments/:id/ancestors`, `GET /arguments/:id/children`.

---

### 3.1.2 Counter-Arguments and Attacks

#### FR4: Critical Question-Based Attacks
The system shall allow counter-arguments to be constructed only by selecting a critical question associated with the scheme of the target argument.

**Status: `COMPLETE`**
> Backend: `submitCounterArgument()` in `argument.service.ts` validates that `selectedCqId` belongs to the parent argument's scheme via `getCriticalQuestion()`. Frontend: `CounterArgumentDrawer` Step 1 presents the parent scheme's CQs and requires selection before proceeding.

---

#### FR5: Scheme-Constrained Counter-Arguments
For a given critical question, the system shall restrict counter-argument construction to argumentation schemes that are valid responses to that critical question.

**Status: `COMPLETE`**
> Backend: `getValidResponseSchemes()` filters schemes; `argument.service.ts` rejects schemes not in the valid set. Frontend: `CounterArgumentDrawer` Step 2 calls `getValidResponseSchemes()` to display only valid response schemes.

---

#### FR6: Attacks on Initial and Derived Arguments
The system shall support attacks on both initial arguments and derived counter-arguments, enabling multi-level argumentative structures.

**Status: `COMPLETE`**
> `POST /arguments/counter` accepts any `parentArgumentId`. The `CounterArgumentDrawer` is rendered on `ArgumentPage` for any argument (initial or counter). Seed data demonstrates multi-level chains (e.g. A1→A2→A3→A4 in the "Economic Impact" subtopic).

---

### 3.1.3 Argument Evaluation and Status

#### FR7: Structural Evaluation Only
The system shall evaluate arguments solely on the basis of their argumentative structure and relationships, without attempting to assess factual truth or correctness.

**Status: `COMPLETE`**
> `evaluateBranch()` and `evaluateGroundedSemantics()` in `backend/src/modules/argumentation/evaluation.ts` operate on graph structure only: a node is IN if all children are OUT, OUT if any child is IN, UNDECIDED otherwise. No content analysis is performed.

---

#### FR8: Argument Status Assignment
The system shall assign each argument a status (`in`, `out`, or `undecided`) according to a defined argumentation semantics.

**Status: `COMPLETE`**
> BullMQ worker in `backend/src/queue/evaluationWorker.ts` runs `evaluateBranch()` after every submission, writes status changes to the DB in a transaction, and broadcasts `STATUS_UPDATE` via WebSocket. The `ArgumentStatus` Prisma enum defines `IN`, `OUT`, `UNDECIDED`.

---

#### FR9: Immediate Re-Evaluation
The system shall re-evaluate argument statuses immediately upon submission of a new argument or counter-argument.

**Status: `COMPLETE`**
> Both `submitInitialArgument()` and `submitCounterArgument()` enqueue a BullMQ job immediately: `evaluationQueue.add(...)`. The worker processes the job and writes updated statuses.

---

#### FR10: Visibility of Debate Outcomes
The system shall make the current status of arguments visible to users in order to indicate which arguments are currently winning or losing within a debate.

**Status: `COMPLETE`**
> `ArgumentView` displays status icons (✓/✕/?) with colour coding and `aria-label="Status: ..."`. `ArgumentGraph` colours nodes by status (green/red/amber). `CondensedView` shows status badges per ancestor node. All display real API data via TanStack Query.

---

### 3.1.4 Graph Representation and Exploration

#### FR11: Dynamic Argument Graph
The system shall represent debates as dynamic graphs in which arguments are nodes and argumentative relationships are edges.

**Status: `COMPLETE`**
> `ArgumentGraph` component renders Cytoscape.js nodes and directed edges from `GET /subtopics/:subtopicId/arguments`. Nodes are positioned by depth (BFS from roots), edges go from child to parent (attack direction). Graph updates when the subtopic data is refetched after WebSocket `STATUS_UPDATE`.

---

#### FR12: Interactive Exploration
The system shall allow users to interactively explore the argument graph, including inspecting individual arguments and their relationships.

**Status: `COMPLETE`**
> Node click in `ArgumentGraph` navigates to `/arg/:argumentId`. `CondensedView` ancestor click navigates. `ChildrenList` child click navigates. Fullscreen graph mode supports zoom/pan. `ArgumentPage` renders the full detail view with thread, argument, children, and minimap.

---

#### FR13: Argument Metrics and Ordering
The system shall collect usage metrics for arguments, such as view counts, and allow arguments to be ordered or filtered based on these metrics.

**Status: `COMPLETE`**
> View count tracked: `Argument.viewCount` in Prisma (migration `add_view_count_field`). Every `GET /arguments/:id` triggers a non-blocking `incrementViewCount`. `ArgumentWithChildrenByStatusSchema` and API responses include `viewCount`. Children sort includes `most_viewed` (backend `GET /arguments/:id/children?sort=most_viewed`, client-side "Most Viewed" on SubtopicPage and ChildrenList). ArgumentView shows Eye icon + count when `viewCount > 0`. Search (GET /search) remains available for text filtering.

---

### 3.1.5 Natural Language Rendering and LLM Boundaries

#### FR14: Structured-to-Natural Language Conversion
The system shall support the conversion of structured arguments into natural language representations to improve user readability.

**Status: `COMPLETE`**
> Backend: `POST /arguments/text-options` uses Mistral in `backend/src/modules/argumentation/llm/argument-text.ts` to generate three neutral variants from the selected scheme and variables during creation. The user picks one variant, which is stored on `Argument.argumentText`. The generated set is tied to a short-lived preview token so submission can be validated against the generated options. Shared types: `GenerateArgumentTextRequestSchema`, `GenerateArgumentTextResponseSchema`, and `ReleaseArgumentTextPreviewRequestSchema` in `@inch/types`. Frontend: the initial and counter drawers call the preview endpoint before submission and then display the stored text directly in cards and in the ancestor thread view.

---

#### FR15: LLM Usage Boundary
Large Language Models shall not be used to generate, modify, or evaluate arguments. Any use of LLMs shall be strictly limited to rendering existing structured arguments into natural language form, and to bounded pre-creation assistance (scheme suggestion, variable moderation, neutral wording options) that does not create or assess argument acceptability in the evaluation engine.

**Status: `COMPLETE`**
> LLM usage remains bounded to natural-language assistance around structured arguments rather than structural generation or evaluation. Before text variant generation, Mistral moderates **raw variable values only** (`llm/moderation.ts`, withContext prompt): coherence, safety, and scheme-fit against the conclusion template — not logical merit. On failure, `POST /arguments/text-options` returns `422` with `moderation_failed` and per-field reasons; on LLM/parse failure the gate fails open (logged). The implementation uses Mistral to produce three neutral text variants from already selected schemes and variables during creation (`POST /arguments/text-options` via `llm/argument-text.ts`) and stores only the user-chosen variant on the argument record. Mistral also suggests candidate schemes and variable prefills from free-text intent (`POST /arguments/suggest`), constrained to schemes stored in the database; the user must still confirm before submission. A separate submit-time hook `moderateArgumentSubmission()` remains a permissive placeholder and does not block persistence by default.

---

#### FR16: Optional Argument Path Rendering
The system may allow users to select a start and end node in the argument graph and generate a natural language rendering of the argumentative path between them.

**Status: `COMPLETE`**
> Backend support remains available via `POST /arguments/path-dialogue`, which validates `PathDialogueRequestSchema`, derives the ancestor slice via `getAncestorChain`, and can call Mistral with stored `argumentText` values to produce a human-readable dialogue. The current frontend no longer exposes a separate button for this, because the compact ancestor thread now always shows the dialogue context directly above the current argument.

---

## Non-Functional Requirements

### 3.2.1 Usability and Presentation

#### NFR1: Clarity of Presentation
The system shall present argument graphs, argument statuses, and relationships in a manner that is interpretable by non-expert users.

**Status: `COMPLETE`**
> `ArgumentView` uses colour-coded status icons (green ✓, red ✕, amber ?) with ARIA labels and now displays stored natural-language `argumentText` directly by default. `ArgumentGraph` colours nodes by status. `CondensedView` shows a compact ancestor thread using stored argument text so the exchange reads as a dialogue above the current argument. When argument cards are shown in a list (e.g. SubtopicPage, ChildrenList), in-place actions (Variables, Attack) do not trigger navigation so users can expand and read content without being taken to the argument page.

---

#### NFR2: Consistent Interaction Model
The system shall enforce a consistent interaction model across all debates and topics.

**Status: `COMPLETE`**
> Full Topic → Subtopic → Argument navigation via `/topics`, `/topics/:topicId`, `/topics/:topicId/:subtopicId`, `/arg/:argumentId`. Navbar breadcrumb reflects current position. All debates follow the same scheme→variable→submit flow. All argument pages use the same layout (thread, detail, children, minimap).

---

### 3.2.2 Responsiveness and Real-Time Behaviour

#### NFR3: Responsive User Interface
The system shall remain responsive during argument submission, evaluation, and graph updates.

**Status: `COMPLETE`**
> React + Vite SPA with TanStack Query for async state management. All API calls are non-blocking via TanStack Query hooks in `frontend/src/hooks/useApi.ts` (topics, arguments, search, admin, and LLM-backed text preview / release flows). Mutations show loading spinners (`Loader2`). Evaluation runs asynchronously via BullMQ (does not block the HTTP response).

---

#### NFR4: Real-Time Graph Updates
Updates to an argument graph shall be propagated to connected clients in near real time.

**Status: `COMPLETE`**
> WebSocket server in `backend/src/websocket/ws.ts` (`@fastify/websocket`, subtopic rooms). Evaluation worker in `evaluationWorker.ts` emits `STATUS_UPDATE` after writing changes. Frontend `useArgumentUpdates` hook in `ArgumentPage` receives updates, invalidates TanStack Query caches for argument, context, ancestors, and subtopic-arguments.

---

#### NFR5: Low-Latency Evaluation
Argument status recalculations shall occur with minimal perceptible delay.

**Status: `COMPLETE`**
> Status evaluation runs asynchronously via BullMQ (`backend/src/queue/evaluationWorker.ts`) immediately after argument submission, writing updated statuses to the DB and emitting `STATUS_UPDATE` over WebSocket. A diagnostic load test seed script exists at `backend/src/load-test-seed.ts` to seed a 100-argument chain and time grounded semantics evaluation via `evaluateGroundedSemantics()`; it logs a warning if evaluation exceeds 100ms.

---

### 3.2.3 Scalability and Performance

#### NFR6: Debate Scalability
The system shall support debates containing hundreds of arguments without significant degradation.

**Status: `COMPLETE`**
> Redis caching is implemented as a cache-aside layer via `getRedisClient()` in `backend/src/cache/redis.ts`. The subtopic graph endpoint (`GET /subtopics/:subtopicId/arguments`) is cached for 60s, and individual arguments (`GET /arguments/:id`) for 30s, in `argument.service.ts`. Cache is invalidated after evaluation DB writes in `evaluationWorker.ts`. A 100-argument evaluation load test seed script exists at `backend/src/load-test-seed.ts`. Frontend rendering performance for very large graphs has not yet been benchmarked with virtualisation.

---

### 3.2.4 Security and Integrity

#### NFR7: User Authentication
The system shall require users to authenticate in order to submit arguments or counter-arguments.

**Status: `COMPLETE`**
> JWT login/register via `POST /users` and `POST /login` in `user.routes.ts`. `getAuthenticatedUser()` in `backend/src/utils/auth.ts` verifies Bearer tokens and is called on `POST /arguments/initial`, `POST /arguments/counter`, `POST /arguments/suggest`, `POST /topics`, and `POST /topics/:topicId/subtopics`. Frontend `AuthGuard` wraps `/profile` and `/admin` routes. Argument drawers check `token` before showing the form.

---

#### NFR8: Argument Immutability
Once submitted, arguments shall not be editable or deletable.

**Status: `COMPLETE`**
> No PUT, PATCH, or DELETE endpoints exist for arguments in `argument.routes.ts`. The only write operations are `POST /arguments/initial` and `POST /arguments/counter` (creation) and the evaluation worker's status update (structural evaluation, not user-initiated edit). Arguments are effectively immutable by API design.

---

### 3.2.5 Extensibility and Future Support

#### NFR9: Extensible Argument Model
The system shall allow future extensions (e.g. support edges) without major refactoring.

**Status: `COMPLETE`**
> The Argument model uses `schemeId` (FK → Scheme), `selectedCqId` (FK → CriticalQuestion), and `parentType` enum to represent relationships. New scheme types, variable types, or relationship types can be added via the Scheme/CQ management admin API (`POST /admin/schemes`, `POST /admin/schemes/:schemeId/critical-questions`) without changing the Argument schema. The `childIds` array and `descendantCount` support arbitrary tree depth.

---

#### NFR10: Evaluation Extensibility
The system shall support the addition or replacement of evaluation semantics with minimal impact.

**Status: `COMPLETE`**
> `evaluation.ts` exports `evaluateBranch()` (branch-only, used by worker) and `evaluateGroundedSemantics()` (full-graph, used by load test) as standalone pure functions. A new semantics (preferred, stable) can be added as an additional function in the same file and selected by the worker without modifying the argument model, API, or frontend.

---

#### NFR11: Accessibility Extension
The system shall be designed to allow an accessibility-focused mode in future work.

**Status: `COMPLETE`**
> WCAG 2.1 AA–oriented improvements on main surfaces: (1) Drawers (InitialArgumentDrawer, CounterArgumentDrawer): role=dialog, aria-modal=true, aria-labelledby to step heading, focus return to trigger on close, all inputs have Label htmlFor, id, aria-required where required, aria-describedby for errors, step progress has aria-live=polite. (2) ArgumentGraph: canvas in region with aria-label "Argument graph", sr-only list of arguments, aria-hidden on graph container, fullscreen button aria-label. (3) ArgumentView: role=article, conclusion as h3, status badge and attack button with descriptive aria-labels, view count with Eye icon (when > 0). Status badge colours checked for contrast. Keyboard navigation verified on sort controls and Load more.

---

## Assumptions and Constraints

1. The system assumes **registered users** but does not rely on social reputation or voting for argument evaluation.
2. Argument acceptability is determined solely through **scheme validity and structural evaluation**, without assessing factual truth.
3. **Variable-input moderation** (LLM, pre–text-generation) is implemented for coherence, safety, and scheme-fit of raw variable values; it does not assess factual truth or argument acceptability in the Dung engine. **Factual validation** and **full content moderation** of stored debates remain out of scope. Submit-time text moderation is still a permissive placeholder unless tightened later.
4. The project **includes** administrative capabilities for managing argumentation schemes and critical questions, implemented via admin-only REST API routes under `/admin` and a protected `/admin` UI for scheme and critical question management.
5. Development targets cross-platform execution on macOS and Windows, using cross-platform Node.js tooling (no shebangs, no POSIX-only paths in scripts).

---

## Summary

| Category | Total | Not Started | In Progress | Complete |
|----------|-------|-------------|-------------|----------|
| Functional (FR1–FR16) | 16 | 0 | 0 | 16 |
| Non-Functional (NFR1–NFR11) | 11 | 0 | 0 | 11 |
| **Total** | **27** | **0** | **0** | **27** |
