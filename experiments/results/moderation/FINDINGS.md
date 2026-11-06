# Moderation Prompt Experiment — Findings

## Winner

**withContext** — score: **3.709** (F1 0.9412, ~253.8 tokens per request on `mistral-small-latest`, 33 cases, live run 2026-04-20).

## Results Table

> The `withContext` row matches the dissertation (Table 5.2). The dissertation's figures for the other three variants differ from this run, e.g. `minimal` 198 mean tokens and `withExamples` F1 0.8235. The table below is the committed live run from 2026-04-20 (`summary.json`); the README quotes only `withContext`.

```
prompt          F1           precision    recall       truePassRt   parseFail    avgTok       score      
-------------------------------------------------------------------------------------------------------------
withContext     0.9412       0.9412       0.9412       0.9375       0            253.7576     3.709      
minimal         0.8824       0.8824       0.8824       0.875        0            243.303      3.6266     
structured      0.875        0.9333       0.8235       0.9375       0            310.3939     2.819      
withExamples    0.9189       0.85         1            0.8125       0            444.1515     2.0689     
```

## Reasoning

Including the **conclusion template** gives the model a compact view of how slots compose into the scheme’s claim, which improves both precision and recall on scheme-mismatch and borderline cases without the large prompt overhead of **withExamples**. **withExamples** achieves high recall but is token-heavy and hurts true pass rate on legitimate edge cases (e.g. vague-but-acceptable fills). **minimal** is slightly cheaper on average tokens but trails on pass/fail balance; **structured** adds criteria text that increases length while pulling recall down versus **withContext**.

## Recommended Prompt Variant

Full messages as sent by `experiments/scripts/runModerationExperiment.ts` for an example gold **pass** case (`pass_eo_1`).

**System**

```
You are a precise content moderator for structured argumentation scheme variables. Obey the JSON output contract exactly.
```

**User** (`withContext`)

```
Scheme: Argument from Expert Opinion (id: expert_opinion)
Conclusion template: A is true (false).

Variable values:
- Expert (E) (variableId: expert): Dr. Maria Lopez, Professor of Epidemiology at Johns Hopkins
- Subject Domain (S) (variableId: domain): infectious disease modeling
- Claim (A) (variableId: claim): vaccination campaigns significantly reduce hospitalization rates in older adults

Decide whether these values coherently and appropriately fill the scheme given the conclusion template.
Return only a single JSON object with this exact shape (no markdown fences, no commentary before or after):
{"passed":boolean,"violations":[{"variableId":string,"reason":string}]}
If passed is true, violations must be []. If passed is false, list each offending variableId with a short reason.
```

## Notes for Implementation

- **Temperature 0.1** and **`response_format: json_object`** behaved well in this run (0% parse failures); keep validation with Zod at the boundary.
- **Variable-level overlap** (expected violating ids vs model `violations`) was strongest for **withExamples** (0.92) and **withContext** (0.88); production may still want a deterministic secondary check for empty or duplicate `variableId` entries.
- Re-run costs scale with cases × variants; use **`EXPERIMENT_MOCK_MISTRAL=1`** (or omit `MISTRAL_API_KEY`) for CI to exercise the pipeline with deterministic mock JSON aligned to gold labels.
- Borderline **pass** cases (very short or vague text) remain the main trade-off: stricter prompts catch more bad content but can reject acceptable minimal inputs—tune with product policy after wiring moderation in `argument.service.ts`.
