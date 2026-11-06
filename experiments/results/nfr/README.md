# NFR threshold benchmarks

Artifacts for non-functional requirements **NFR3** (responsiveness), **NFR5** (delay proxy), and **NFR6** (scale) aligned with the Evaluation chapter of the dissertation.

## Files

| File | Description |
|------|-------------|
| `summary.json` | Latest **microbench** (in-process `evaluateGroundedSemantics` / `evaluateBranch`) plus optional **pipeline** (enqueue → persisted status) figures. |

## Regenerating

From the repo root:

```bash
cd backend
npm run bench:nfr
```

Optional pipeline timings (requires `DATABASE_URL`, `REDIS_URL`, seeded DB including `seed@inch.dev`, and schemes):

```bash
cd backend
npm run bench:nfr:pipeline
```

Merge the printed `pipeline` object into `summary.json` if you need the dissertation figures and JSON to stay in sync.

## Method (short)

- **Microbench**: Synthetic linear attack chains in memory; 50 repeated timings per configuration; $p_{50}$ and $p_{95}$ in milliseconds (`backend/src/benchmarks/nfrMicrobench.ts`, run via `backend/scripts/run-nfr-benchmark.ts`).
- **Pipeline**: After `createCounterArgument`, `evaluationQueue.add` is timed until the new argument’s row is no longer `UNDECIDED` (`backend/scripts/nfr-pipeline-bench.ts`). This isolates worker + database work, not REST or WebSocket.
