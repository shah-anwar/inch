# Data Model — inch

## Entity Overview

The data model is derived from the original project specification. The following entities are defined:

| Entity | Description | Implemented? |
|--------|-------------|-------------|
| User | Registered platform user | Yes (Prisma + API) |
| Topic | High-level discussion domain | Yes (Prisma + API: GET/POST /topics) |
| Subtopic | Specific aspect within a topic | Yes (Prisma + API: GET/POST /topics/:id/subtopics) |
| Argument | Instantiated argumentation scheme | Yes (Prisma + API: creation, retrieval, context, ancestors, children) |
| ArgumentVariable | Variable values for a scheme instance | Yes (Prisma, included with Argument) |
| Scheme | Argumentation scheme template | Yes (Prisma model + @inch/types schemes.json with 8 schemes) |
| CriticalQuestion | Challenge associated with a scheme | Yes (Prisma model + @inch/types schemes.json with 27 CQs) |

---

## Entity Specifications

### User

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | Integer | PK, auto-increment | |
| username | String | Unique, min 3 chars | |
| email | String | Unique, valid email | |
| password | String | Hashed (bcrypt), min 8 chars | Never returned in API responses |
| isAdmin | Boolean | Default: false | Administrative flag for scheme/CQ management |
| createdAt | DateTime | Default: now() | |

**Zod schemas** (in `@inch/types`): `CreateUserSchema`, `LoginUserSchema`, `GetMeResponseSchema` (includes `isAdmin`)

---

### Topic

Implemented in Prisma and API (GET/POST /topics).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | Integer | PK, auto-increment | |
| title | String | Required | Short descriptive title |
| description | String? | Optional, nullable | Textual description |
| createdAt | DateTime | Default: now() | |

Topics are **organisational only** — they do not participate in argument evaluation.

**Zod schemas** (in `@inch/types`): `CreateTopicSchema`, `TopicSchema`
**API routes**: `GET /topics`, `GET /topics/:topicId`, `POST /topics` (auth required)

---

### Subtopic

Implemented in Prisma and API (GET/POST /topics/:topicId/subtopics).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | Integer | PK, auto-increment | |
| topicId | Integer | FK → Topic | Reference to parent topic |
| title | String | Required | Short descriptive title |
| createdAt | DateTime | Default: now() | |

Subtopics scope specific lines of discussion within a topic. They do not participate in argument evaluation.

**Zod schemas** (in `@inch/types`): `CreateSubtopicSchema`, `CreateSubtopicBodySchema`, `SubtopicSchema`
**API routes**: `GET /topics/:topicId/subtopics`, `GET /topics/:topicId/subtopics/:subtopicId`, `POST /topics/:topicId/subtopics` (auth required)

---

### Argument

Implemented in Prisma and API.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid2 (24 chars) | Unique identifier |
| schemeId | String | FK → Scheme | Reference to applied scheme |
| selectedCqId | String? | FK → CriticalQuestion, nullable | CQ that prompted this counter-argument |
| argumentText | String | Required | User-selected natural-language text generated at creation time |
| isInitial | Boolean | Required | `true` for initial args, `false` for counter-args |
| parentId | String? | Self-referential FK, nullable | Parent argument (null for initial args) |
| parentType | ParentType enum | `SUBTOPIC` or `ARGUMENT` | Discriminator for parent reference |
| subtopicId | Integer | FK → Subtopic | The subtopic this argument belongs to |
| status | ArgumentStatus enum | `IN`, `OUT`, `UNDECIDED` | Evaluation status (default: UNDECIDED) |
| childIds | String[] | Default: [] | Direct child argument IDs |
| descendantCount | Integer | Default: 0 | Total descendants |
| viewCount | Integer | Default: 0 | Incremented on each GET /arguments/:id |
| authorId | Integer | FK → User | Submitting user |
| createdAt | DateTime | Default: now() | Timestamp of submission |

**Relations**: `scheme` (Scheme), `selectedCq` (CriticalQuestion), `subtopic` (Subtopic), `author` (User), `variables` (ArgumentVariable[])

**Zod schemas** (in `@inch/types`): `CreateInitialArgumentSchema`, `CreateCounterArgumentSchema`, `GenerateArgumentTextRequestSchema`, `GenerateArgumentTextResponseSchema`, `ReleaseArgumentTextPreviewRequestSchema`, `ArgumentWithChildrenByStatusSchema` (includes `viewCount` and `argumentText`), `ArgumentContextSchema`, `AncestorNodeSchema`, `AncestorChainSchema`, `ChildrenSortSchema` (newest, oldest, most_descendants, status, most_viewed), `PaginatedChildrenSchema`, `RenderArgumentResponseSchema`, `SuggestArgumentRequestSchema`, `SchemeSuggestionSchema`, `SuggestArgumentResponseSchema`, `PathDialogueRequestSchema`, `PathDialogueResponseSchema`

**API routes**:
- `POST /arguments/initial` (auth) — create initial argument
- `POST /arguments/counter` (auth) — create counter-argument
- `POST /arguments/text-options` (auth) — generate 3 creation-time text variants for the current scheme + variables
- `POST /arguments/text-options/release` (auth) — release a cached preview token when the user backs out of text selection
- `GET /arguments/:id` — enriched with `childrenByStatus`
- `GET /arguments/:id/context` — argument + subtopic + topic
- `GET /arguments/:id/ancestors` — root-first ancestor chain
- `GET /arguments/:id/children` — cursor-paginated, sortable (newest, oldest, most_descendants, status, most_viewed)
- `GET /subtopics/:subtopicId/arguments` — all arguments in a subtopic
- `GET /arguments/:id/render` — return the stored selected text for a single argument
- `POST /arguments/suggest` — authenticated Mistral-backed scheme + variable-prefill suggestions (read-only; schemes come from the `Scheme` table)
- `POST /arguments/path-dialogue` — natural language dialogue rendering for a selected ancestor path (Mistral-backed)

---

### ArgumentVariable

Implemented in Prisma.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | Integer | PK, auto-increment | |
| argumentId | String | FK → Argument | |
| variableId | String | Scheme variable ID | |
| value | String | User-provided value | |

**Unique constraint**: `@@unique([argumentId, variableId])`

---

### Scheme (Argumentation Scheme)

Implemented in Prisma. 8 schemes defined in `shared/types/src/data/schemes.json`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK | e.g. `"expert_opinion"` |
| name | String | Required | e.g. "Argument from Expert Opinion" |
| description | String | Required | Explanation of the scheme |
| conclusion | String | Required | Template with `{variable}` tokens |
| variables | Json | Required | Array of variable definitions |
| createdAt | DateTime | Default: now() | |

**Relations**: `criticalQuestions` (CriticalQuestion[]), `arguments` (Argument[])

The **available** schemes for users and for LLM-assisted suggestion are exactly the rows in this table: admins add or change schemes via `/admin` APIs (there is no separate “enabled” flag).

Schemes define patterns of reasoning (Walton). Each scheme has named variables that users must fill in to construct an argument. The `conclusion` field provides a template for rendering readable argument text via `renderArgumentText()`.

**Admin Zod schemas** (in `@inch/types`): `AdminSchemeSchema`, `CreateSchemeSchema`, `UpdateSchemeSchema` (in `modules/admin.ts`)

**Admin API routes**:
- `GET /admin/schemes` — list all schemes with nested critical questions (admin only)
- `GET /admin/schemes/:schemeId` — get a single scheme with nested critical questions (admin only)
- `POST /admin/schemes` — create a new scheme (admin only)
- `PATCH /admin/schemes/:schemeId` — update scheme fields other than `id` (admin only)

---

### CriticalQuestion

Implemented in Prisma. 27 active CQs defined in `shared/types/src/data/schemes.json`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK | e.g. `"cq_eo_1"` |
| schemeId | String | FK → Scheme | The scheme this CQ belongs to |
| text | String | Required | Short question text |
| description | String | Required | Full description |
| validResponseSchemeIds | String[] | Array column | Scheme IDs valid for counter-argument response |

**Relations**: `scheme` (Scheme), `counterArguments` (Argument[])

Critical questions define standard ways a scheme-based argument can be challenged. When constructing a counter-argument, the user selects a CQ from the target argument's scheme, then constructs a new argument using a valid response scheme.

**Admin Zod schemas** (in `@inch/types`): `AdminCriticalQuestionSchema`, `CreateCriticalQuestionSchema`, `UpdateCriticalQuestionSchema` (in `modules/admin.ts`)

**Admin API routes**:
- `GET /admin/schemes/:schemeId/critical-questions` — list CQs for a scheme (admin only)
- `POST /admin/schemes/:schemeId/critical-questions` — create a new CQ for a scheme (admin only)
- `PATCH /admin/critical-questions/:cqId` — update an existing CQ (admin only)

---

## The `is_initial` Flag

The spec (§4.3.3) explicitly justifies recording whether an argument is initial:

- **If `is_initial = true`**: the argument is an initial argument, and `parent_type` must be `Subtopic`.
- **If `is_initial = false`**: the argument is a counter-argument, and `parent_type` must be `Argument`.

While this could be inferred from `parent_type`, the explicit flag **simplifies validation, query construction, and user interaction logic**.

---

## Structural Constraints

1. If `is_initial = true`, then `parent_type` must be `Subtopic`.
2. If `is_initial = false`, then `parent_type` must be `Argument`.
3. Arguments shall **not** attach directly to topics.
4. Only arguments participate in evaluation semantics (topics and subtopics are excluded from the graph).
5. Arguments are **immutable** once submitted (NFR8) — no edits or deletions.

---

## Argument Graph Construction

The argument graph is constructed solely from argument entities:

- **Nodes** = arguments
- **Directed edges** = attack relationships (counter-argument → target argument)
- **Root nodes** = initial arguments within a subtopic
- Topics and subtopics are **excluded** from the graph

The graph is **directed** and **acyclic** within a subtopic context. Evaluation semantics (grounded, preferred, stable) operate on this graph structure.

---

## Relationship to AIF (Argument Interchange Format)

inch adopts a **collapsed AIF representation**:

| AIF Representation | inch Representation |
|--------------------|---------------------|
| I-nodes (premises, conclusions) | Implicit within argument variables |
| S-nodes (scheme applications) | Collapsed into the argument entity |
| Conflict scheme applications | Attack edges between argument nodes |

This design prioritises usability for non-expert users while remaining conceptually compatible with AIF. A future export function could translate inch's internal representation into a fully explicit AIF graph.
