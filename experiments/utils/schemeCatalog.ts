import { schemes } from "@inch/types";

/** Active scheme ids from `shared/types` / DB seed (8 schemes, 27 CQs). */
export const ACTIVE_SCHEME_IDS = schemes.schemes.map((s) => s.id) as readonly string[];

export function schemeCount(): number {
  return schemes.schemes.length;
}

export function criticalQuestionCount(): number {
  return schemes.schemes.reduce((n, s) => n + s.criticalQuestions.length, 0);
}

export function formatSchemeListOneLine(): string {
  return schemes.schemes.map((s) => `${s.id}`).join(", ");
}

export function formatSchemeBulletsMinimal(): string {
  return schemes.schemes.map((s) => `- \`${s.id}\` — ${s.name}`).join("\n");
}

export function formatSchemeBulletsVerbose(): string {
  return schemes.schemes
    .map((s) => {
      const cqPreview = s.criticalQuestions
        .slice(0, 2)
        .map((cq) => `    - ${cq.text}`)
        .join("\n");
      return `- **${s.id}** (${s.name})\n  ${s.description}\n  Example CQs:\n${cqPreview}`;
    })
    .join("\n\n");
}

/** Short pairwise hints for models that confuse similar Walton schemes. */
export function formatDisambiguationBlock(): string {
  return `
Likely confusions (pick the closest id from the allowed list):
- expert_opinion vs position_to_know: formal *expertise in a field* vs *positional access* (witness, insider) to a fact.
- cause_to_effect vs sign: *mechanism / general causal claim* vs *indicator / symptom* pointing to something else.
- consequences vs practical_reasoning: *outcomes of an action/policy* vs *means–end / goal–action* practical inference.
- analogy vs example: *parallel case mapping* vs *single illustrative instance*.
- slippery_slope vs consequences: *claimed inevitable chain of steps* vs *evaluated outcomes* of an action.
`.trim();
}
