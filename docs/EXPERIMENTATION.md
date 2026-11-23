# Experimentation (`experiments/`)

This document describes the **`experiments`** package: what it does, why it exists, and how to use it.

## Purpose

The `experiments` folder is a **standalone research harness** for evaluating **Mistral-based prompts** that classify short natural-language text into **Walton-style argumentation schemes**. It uses the same **active scheme ontology** as the rest of the app (via `@inch/types` / shared scheme data), but it does **not** run inside the backend server or affect production behavior.

It exists so you can:

- **Compare prompt designs** (minimal vs verbose instructions, disambiguation hints, top-2 ranking) on a fixed labeled set without changing application code.
- **Measure quality and cost** in one place: top-1 (and optional top-2) accuracy, JSON parse failures, latency, token usage, a simple **accuracy-per-token** score, and a **confusion matrix** (gold label vs model’s primary scheme).
- **Run offline or in CI**: if there is no `MISTRAL_API_KEY` or `EXPERIMENT_MOCK_MISTRAL=1` is set, the client returns **deterministic mock JSON** that mirrors the expected label so the pipeline stays testable without calling the API.

## What it runs

1. **`scripts/runExperiment.ts`** (`npm run exp:run` from the repo root, or `npm run exp:run` inside `experiments/`)  
   - Loads gold cases from `experiments/data/testCases.json` (each case: `id`, `input` text, `expectedScheme`).  
   - For each registered prompt variant, calls Mistral chat completions with `response_format: json_object`, temperature `0.2`, max tokens `512`.  
   - Parses the model output with Zod (`experiments/utils/validateResponse.ts`): valid scheme ids from the active catalog, required `ambiguity` field, and for the `top2` prompt a distinct `secondaryScheme`.  
   - Writes one file per prompt: **`experiments/results/<promptName>.json`** (per-run rows with raw output, parsed object or parse error, accuracy flags, token usage, latency, and whether the run was mocked).

2. **`scripts/summarise.ts`** (`npm run exp:summary`)  
   - Reads all `*.json` result files in `experiments/results/` except `summary.json`.  
   - Aggregates metrics per prompt and overall into **`experiments/results/summary.json`** (accuracy, optional top-2 accuracy, average latency and tokens, parse-failure rate, score, confusion matrices).

Optional CLI on the experiment runner: `--prompt=<name>` where `<name>` is one of the prompt keys below, or `all` (default).

## Environment

- Loads **`backend/.env`** and **`.env`** at the repo root (same pattern as other tooling).  
- **`MISTRAL_API_KEY`**: required for live API calls.  
- **`MISTRAL_MODEL`**: defaults to `mistral-small-latest` if unset.  
- **`EXPERIMENT_MOCK_MISTRAL=1`**: force mock responses (also used automatically when no API key is present).

## Prompt variants (registry)

Defined in `experiments/prompts/index.ts`:

| Key | Role |
| --- | --- |
| `minimal` | Short classification instructions + minimal scheme list (id and name). |
| `withDisambiguation` | Same as minimal plus **pairwise disambiguation hints** for commonly confused schemes (e.g. expert vs position-to-know). |
| `verbose` | Longer reference: descriptions and sample critical questions per scheme. |
| `top2` | Asks for **primary and runner-up** scheme ids; metrics include **top-2 accuracy** (gold matches either label). |

Shared JSON shapes are in `experiments/prompts/jsonContract.ts`.

## Relationship to the product

- **Scheme ids and metadata** come from **`@inch/types`** (`experiments/utils/schemeCatalog.ts`), keeping experiments aligned with what the app seeds and classifies.  
- The harness is **not** a substitute for integration tests against the real argumentation pipeline; it isolates **prompt + model + parsing** behavior for iteration and comparison.

## Repository layout (experiments)

| Path | Role |
| --- | --- |
| `data/testCases.json` | Gold inputs and expected scheme ids. |
| `prompts/` | Prompt builders and JSON contract strings. |
| `scripts/` | Run experiment and summarise results. |
| `results/` | Generated JSON (often gitignored except placeholders; committed snapshots may exist for reference). Includes **`results/nfr/`** — NFR3/NFR5/NFR6 engine and pipeline timings for the thesis (`README.md` + `summary.json`; regenerated via `npm run bench:nfr` in `backend/`). |
| `types/`, `utils/` | Result types, metrics, Mistral client, validation. |

The repo root **`package.json`** includes `experiments` as an npm workspace and exposes **`exp:run`** and **`exp:summary`** for convenience.
