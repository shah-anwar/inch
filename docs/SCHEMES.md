# Argumentation schemes

INCH ships eight argumentation schemes. Their definitions (variables, conclusion templates and critical questions) live in [`shared/types/src/data/schemes.json`](../shared/types/src/data/schemes.json) and are validated at load time by [`shared/types/src/modules/argumentation.ts`](../shared/types/src/modules/argumentation.ts). Admins can manage the active set at runtime through the `/admin/schemes` routes.

| Scheme id | Name | In short |
|---|---|---|
| `expert_opinion` | Argument from Expert Opinion | A claim gains support because someone with recognised expertise in the relevant field asserts it. |
| `position_to_know` | Argument from Position to Know | A claim gains support because the source has direct access to the facts, through role, location or experience rather than formal expertise. |
| `analogy` | Argument from Analogy | Two cases are alike in the ways that matter, so a conclusion that holds for one is taken to hold for the other. |
| `cause_to_effect` | Argument from Cause to Effect | A general causal link plus the presence of the cause gives a reason to expect the effect. |
| `consequences` | Argument from Consequences | An action is recommended or rejected according to whether its outcomes are judged good or bad. |
| `practical_reasoning` | Argument from Practical Reasoning | An agent should take an action because it is a way of reaching a goal the agent has. |
| `slippery_slope` | Slippery Slope Argument | A first step is rejected because it is claimed to start a chain of plausible steps ending somewhere unacceptable. |
| `sign` | Argument from Sign | An observed indicator is taken as evidence that the state or event it usually accompanies is present. |

Each scheme carries critical questions. A counter-argument in INCH must answer one of the parent argument's critical questions, using a scheme that the question allows as a response.

## Critical questions and response schemes

- The catalogue has 27 critical questions across the eight schemes. Each one lists, in `validResponseSchemeIds`, which schemes may be used to answer it.
- Every listed response scheme is one of the eight, so the set is self-contained: no critical question points at a scheme the platform doesn't have.
- **An empty list means any active scheme may respond.** Three critical questions have one: `cq_eo_3`, `cq_ptk_3` and `cq_ss_1`. The backend (`allowsResponseScheme` in `backend/src/utils/activeSchemes.ts`), the shared helper `getValidResponseSchemes` in `@inch/types` and the frontend scheme store all apply the same rule.
- The backend also respects the admin-managed active set:
  - A critical question is offered only when at least one active scheme may answer it.
  - A counter-argument is accepted only if its scheme is active and allowed by the question.
- `npm run seed` writes arguments straight to the database, bypassing the API checks. `backend/test/seed/seedValidity.test.ts` therefore checks every seeded counter-argument against the same rules.

## Possible extensions

- Walton's *Argument from Expert Opinion* has a sixth critical question, about whether the expert's assertion is backed by evidence. It is left out because its natural responses (arguing from evidence to a hypothesis, and abductive reasoning) are not in the scheme set yet.
- Further schemes considered for a later version:
  - evidence to hypothesis
  - abduction
  - commitment
  - circumstantial ad hominem
  - verbal classification
  - popular opinion
  - argument from ignorance
  - argument from precedent
- New schemes can be added at runtime through the admin routes, or by extending `schemes.json` and re-running the seed.

## Source

The critical-question texts in [`shared/types/src/data/schemes.json`](../shared/types/src/data/schemes.json) follow the wording of Walton, Reed and Macagno (2008), cited below. They are reproduced with citation for research purposes. The scheme descriptions were written for INCH. The scheme structures follow the same source.

Walton, D., Reed, C. and Macagno, F. (2008). *Argumentation Schemes*. Cambridge: Cambridge University Press.
