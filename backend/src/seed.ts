import { schemes } from "@inch/types";
import { init } from "@paralleldrive/cuid2";
import bcrypt from "bcrypt";
import { prisma } from "./db/prisma.js";
import {
  evaluateGroundedSemantics,
  type EvaluationGraph,
  type EvaluationNode,
} from "./modules/argumentation/evaluation.js";

const createId = init({ length: 24 });

type SeedVariable = { variableId: string; value: string };

type SeedArgumentInput = {
  key: string;
  schemeId: string;
  isInitial: boolean;
  parentKey: string | null;
  selectedCqId: string | null;
  argumentText: string;
  variables: SeedVariable[];
};

type SeedSubtopicSpec = {
  title: string;
  arguments: SeedArgumentInput[];
};

type SeedTopicSpec = {
  title: string;
  description: string;
  subtopics: SeedSubtopicSpec[];
};

const AI_TOPIC_TITLE = "Artificial Intelligence";
const AI_TOPIC_DESCRIPTION =
  "Policy and governance debates about AI systems and their societal impact";

const AI_SUBTOPIC_SPECS: SeedSubtopicSpec[] = [
  {
    title: "Economic Impact of AI Regulation",
    arguments: [
      {
        key: "econ_1",
        schemeId: "practical_reasoning",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "National governments should require AI impact assessments before deployment to reduce avoidable job displacement. The policy is justified because it links automation gains to retraining obligations.",
        variables: [
          { variableId: "agent", value: "national governments" },
          { variableId: "goal", value: "reduce avoidable AI-driven unemployment shocks" },
          {
            variableId: "action",
            value: "require AI impact assessments and workforce transition plans before deployment",
          },
          {
            variableId: "means_justification",
            value:
              "pre-deployment impact reviews identify vulnerable roles early and trigger funded retraining before layoffs occur",
          },
        ],
      },
      {
        key: "econ_2",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "econ_1",
        selectedCqId: "cq_pr_4",
        argumentText:
          "Strict impact-assessment mandates can push frontier AI investment to jurisdictions with weaker compliance costs. That relocation effect may reduce domestic tax base and skilled employment.",
        variables: [
          {
            variableId: "cause",
            value: "strict pre-deployment AI impact-assessment mandates in one jurisdiction",
          },
          {
            variableId: "effect",
            value:
              "AI firms relocate high-value development activity to lower-regulation jurisdictions",
          },
          {
            variableId: "causal_generalization",
            value:
              "capital-intensive technology firms regularly shift operations when compliance burdens differ significantly across markets",
          },
        ],
      },
      {
        key: "econ_3",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "econ_2",
        selectedCqId: "cq_ce_1",
        argumentText:
          "Industrial policy researchers report that frontier AI teams are less mobile than finance or advertising units. Specialized compute contracts and talent clusters limit rapid relocation.",
        variables: [
          {
            variableId: "expert",
            value: "Dr. Lina Moreno, Institute for Technology and Industry Policy",
          },
          { variableId: "domain", value: "firm-location decisions in advanced technology sectors" },
          {
            variableId: "claim",
            value:
              "frontier AI development depends on location-specific compute infrastructure and labour networks that make abrupt relocation unlikely",
          },
        ],
      },
      {
        key: "econ_4",
        schemeId: "sign",
        isInitial: false,
        parentKey: "econ_3",
        selectedCqId: "cq_eo_1",
        argumentText:
          "The cited relocation study is funded by domestic cloud providers that benefit from local retention policies. That funding link is a sign the conclusion may understate relocation risk.",
        variables: [
          {
            variableId: "sign",
            value:
              "the underlying relocation report is financed by firms that benefit from maintaining domestic AI compute demand",
          },
          {
            variableId: "conclusion_b",
            value:
              "the report may understate the probability of AI firm relocation under stricter regulation",
          },
          {
            variableId: "sign_relationship",
            value:
              "sponsorship arrangements in policy research can correlate with systematically optimistic assumptions for the sponsor's preferred outcome",
          },
        ],
      },
      {
        key: "econ_5",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "econ_1",
        selectedCqId: "cq_pr_3",
        argumentText:
          "Labour economists argue that targeted adjustment support reduces long-run unemployment after automation shocks. They note that transition policies are most effective when introduced before displacement peaks.",
        variables: [
          {
            variableId: "expert",
            value: "OECD Future of Work Taskforce",
          },
          { variableId: "domain", value: "labour-market adjustment under technological change" },
          {
            variableId: "claim",
            value:
              "early retraining and wage-transition support materially improve re-employment outcomes in automation-affected sectors",
          },
        ],
      },
      {
        key: "econ_6",
        schemeId: "sign",
        isInitial: false,
        parentKey: "econ_5",
        selectedCqId: "cq_eo_1",
        argumentText:
          "The taskforce recommendations rely on pilot programmes from high-income regions with unusually strong safety nets. That evidence base is a sign the results may not transfer to weaker labour systems.",
        variables: [
          {
            variableId: "sign",
            value:
              "most cited transition pilots were run in countries with high baseline social protection and strong active labour-market institutions",
          },
          {
            variableId: "conclusion_b",
            value:
              "the reported effectiveness of retraining-led transition policy may not generalize to lower-capacity labour systems",
          },
          {
            variableId: "sign_relationship",
            value:
              "policy interventions validated in unusually favourable institutional contexts often perform worse when implementation capacity is lower",
          },
        ],
      },
    ],
  },
  {
    title: "Safety and Risk of Unregulated AI",
    arguments: [
      {
        key: "safe_1",
        schemeId: "cause_to_effect",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "Deploying high-impact AI systems without enforceable safety gates can cause cascading failures in critical services. Safety regulation is warranted because the downside risk is systemic rather than local.",
        variables: [
          {
            variableId: "cause",
            value: "deployment of high-impact AI systems without enforceable safety standards",
          },
          {
            variableId: "effect",
            value:
              "cascading failures across critical infrastructure such as healthcare logistics, energy balancing, and emergency dispatch",
          },
          {
            variableId: "causal_generalization",
            value:
              "complex automated systems introduced without hard certification gates have repeatedly produced high-cost systemic incidents",
          },
        ],
      },
      {
        key: "safe_2",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "safe_1",
        selectedCqId: "cq_ce_1",
        argumentText:
          "Risk-governance specialists argue that liability law and procurement pressure already force major vendors to meet robust safety targets. They claim additional regulation may add delay without proportional benefit.",
        variables: [
          {
            variableId: "expert",
            value: "Prof. Marcus Webb, Centre for AI Risk Governance",
          },
          { variableId: "domain", value: "institutional incentives for AI safety compliance" },
          {
            variableId: "claim",
            value:
              "existing liability exposure and enterprise procurement requirements already impose strong safety discipline on major AI providers",
          },
        ],
      },
      {
        key: "safe_3",
        schemeId: "sign",
        isInitial: false,
        parentKey: "safe_2",
        selectedCqId: "cq_eo_4",
        argumentText:
          "The same experts repeatedly advised firms currently lobbying against mandatory audits. That alignment is a sign their assessment may underweight public-risk externalities.",
        variables: [
          {
            variableId: "sign",
            value:
              "key experts cited against regulation have ongoing advisory contracts with firms opposing mandatory external safety audits",
          },
          {
            variableId: "conclusion_b",
            value:
              "their recommendation likely underweights risks borne by affected communities rather than by deploying firms",
          },
          {
            variableId: "sign_relationship",
            value:
              "direct financial alignment with regulated parties can predict systematically industry-favourable risk framing",
          },
        ],
      },
      {
        key: "safe_4",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "safe_2",
        selectedCqId: "cq_eo_5",
        argumentText:
          "Independent public-interest researchers report that market incentives alone lead to underinvestment in low-probability catastrophic safeguards. They argue this pattern mirrors historical safety races in other industries.",
        variables: [
          {
            variableId: "expert",
            value: "Public Systems Safety Lab, Cambridge Policy School",
          },
          { variableId: "domain", value: "safety investment under competitive pressure" },
          {
            variableId: "claim",
            value:
              "competitive markets systematically underprovide costly safeguards against tail-risk failures when harms are externalized",
          },
        ],
      },
      {
        key: "safe_5",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "safe_1",
        selectedCqId: "cq_ce_3",
        argumentText:
          "Phasing in mandatory external audits for frontier deployments would reduce catastrophic failure risk. A staged rollout preserves innovation incentives while creating enforceable safety checkpoints.",
        variables: [
          {
            variableId: "cause",
            value:
              "phased external safety audits and incident-reporting obligations for frontier deployments",
          },
          {
            variableId: "effect",
            value: "fewer cascading failures reaching critical services",
          },
          {
            variableId: "causal_generalization",
            value:
              "phased audit obligations create enforceable minimum safeguards while allowing iteration during early compliance periods",
          },
        ],
      },
      {
        key: "safe_6",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "safe_5",
        selectedCqId: "cq_ce_3",
        argumentText:
          "A rigid audit-first regime can delay deployment of beneficial clinical and infrastructure tools beyond acceptable windows. Delays of that magnitude may produce preventable social costs.",
        variables: [
          {
            variableId: "cause",
            value: "overly rigid mandatory audit sequencing before any high-impact deployment",
          },
          {
            variableId: "effect",
            value:
              "material delays in releasing beneficial systems for healthcare triage, energy optimization, and emergency planning",
          },
          {
            variableId: "causal_generalization",
            value:
              "hard pre-release bottlenecks in fast-moving technical sectors can defer welfare-enhancing tools long enough to create measurable opportunity costs",
          },
        ],
      },
      {
        key: "safe_7",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "safe_6",
        selectedCqId: "cq_ce_1",
        argumentText:
          "Implementation scientists find that risk-tiered approval schedules avoid most harmful delays while preserving safety assurance. They recommend differentiated pathways rather than a single audit gate.",
        variables: [
          {
            variableId: "expert",
            value: "NHS AI Lab Evaluation Programme",
          },
          {
            variableId: "domain",
            value: "deployment governance for safety-critical digital tools",
          },
          {
            variableId: "claim",
            value:
              "risk-tiered review pathways can maintain safety standards without imposing uniform delays on all high-impact AI systems",
          },
        ],
      },
    ],
  },
  {
    title: "AI in Criminal Justice",
    arguments: [
      {
        key: "justice_1",
        schemeId: "slippery_slope",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "Allowing AI risk scoring into bail decisions can begin a path toward opaque automated liberty decisions. Without safeguards, advisory use can gradually become de facto replacement of judicial judgment.",
        variables: [
          {
            variableId: "first_step",
            value: "introducing AI risk scores as advisory input for bail decisions",
          },
          {
            variableId: "sequence_description",
            value:
              "advisory scoring in bail becomes default scoring in detention, then extends to sentencing and parole with diminishing human override",
          },
          {
            variableId: "bad_outcome",
            value:
              "a criminal justice process where algorithmic outputs effectively determine liberty without meaningful review",
          },
        ],
      },
      {
        key: "justice_2",
        schemeId: "analogy",
        isInitial: false,
        parentKey: "justice_1",
        selectedCqId: "cq_ss_3",
        argumentText:
          "Actuarial tools in parole were used for decades without fully displacing judicial authority. That precedent suggests modern AI scoring can remain advisory if governance constraints are explicit.",
        variables: [
          {
            variableId: "case_c1",
            value: "historical use of actuarial parole tools as advisory evidence",
          },
          {
            variableId: "case_c2",
            value: "current introduction of AI risk scoring in bail and pretrial settings",
          },
          {
            variableId: "claim",
            value:
              "decision-support tools can remain advisory across long periods when institutions preserve explicit human override",
          },
          {
            variableId: "similarity",
            value:
              "both systems introduce statistical prediction aids within existing court and parole decision structures",
          },
        ],
      },
      {
        key: "justice_3",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "justice_2",
        selectedCqId: "cq_an_1",
        argumentText:
          "Modern machine-learning systems are faster and less interpretable than legacy actuarial tables. Those features can cause decision-makers to defer more heavily to model outputs.",
        variables: [
          {
            variableId: "cause",
            value: "high-speed opaque ML risk scoring compared with simpler actuarial methods",
          },
          {
            variableId: "effect",
            value:
              "institutional over-reliance on model outputs that weakens practical human override in bail decisions",
          },
          {
            variableId: "causal_generalization",
            value:
              "decision-support systems that appear highly precise and are hard to contest often shift authority from human operators to the tool itself",
          },
        ],
      },
      {
        key: "justice_4",
        schemeId: "practical_reasoning",
        isInitial: false,
        parentKey: "justice_1",
        selectedCqId: "cq_ss_1",
        argumentText:
          "Justice authorities should permit audited AI support only with mandatory explanation, appeal rights, and override logging. These safeguards reduce bias while preserving accountable human decision-making.",
        variables: [
          { variableId: "agent", value: "criminal justice authorities" },
          {
            variableId: "goal",
            value: "reduce bail inequity without surrendering accountable human oversight",
          },
          {
            variableId: "action",
            value:
              "allow audited AI risk support with mandatory explanations, appeal channels, and override records",
          },
          {
            variableId: "means_justification",
            value:
              "explainability, contestability, and override accountability preserve due-process protections while improving consistency",
          },
        ],
      },
      {
        key: "justice_5",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "justice_4",
        selectedCqId: "cq_pr_3",
        argumentText:
          "Court administration researchers report that structured override protocols reduce automation bias in high-stakes domains. Their findings support combining AI assistance with strict procedural controls.",
        variables: [
          {
            variableId: "expert",
            value: "Judicial Technology and Accountability Consortium",
          },
          {
            variableId: "domain",
            value: "human oversight practices in algorithm-assisted adjudication",
          },
          {
            variableId: "claim",
            value:
              "formal override and review procedures materially reduce over-reliance on algorithmic recommendations in legal decision settings",
          },
        ],
      },
      {
        key: "justice_6",
        schemeId: "sign",
        isInitial: false,
        parentKey: "justice_5",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Most studies cited by the consortium are from simulated case environments rather than live courts. That is a sign the measured oversight gains may be overstated in real practice.",
        variables: [
          {
            variableId: "sign",
            value:
              "the majority of evidence in support of override protocols comes from simulated adjudication environments with controlled workloads",
          },
          {
            variableId: "conclusion_b",
            value:
              "the reported reduction in automation bias may not fully transfer to real court conditions",
          },
          {
            variableId: "sign_relationship",
            value:
              "interventions tested in simulation often underperform when deployed in high-pressure operational systems",
          },
        ],
      },
      {
        key: "justice_7",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "justice_3",
        selectedCqId: "cq_ce_3",
        argumentText:
          "Mandatory publication of model error rates by demographic subgroup can reduce blind deference to AI outputs. Transparent performance reporting forces institutions to maintain active scrutiny.",
        variables: [
          {
            variableId: "cause",
            value:
              "mandatory disclosure of subgroup-specific model error rates and drift indicators",
          },
          {
            variableId: "effect",
            value:
              "reduced institutional over-reliance on AI recommendations because judges can calibrate trust against visible failure patterns",
          },
          {
            variableId: "causal_generalization",
            value:
              "decision-makers are less likely to over-trust opaque systems when reliability and error boundaries are continuously disclosed",
          },
        ],
      },
    ],
  },
  {
    title: "AI in Healthcare Decisions",
    arguments: [
      {
        key: "health_1",
        schemeId: "expert_opinion",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "Clinical AI diagnostics can match specialist performance when validation covers diverse patient groups and deployment context. Under those conditions, adoption can improve consistency and access.",
        variables: [
          {
            variableId: "expert",
            value: "Lancet Digital Health Commission",
          },
          { variableId: "domain", value: "clinical AI diagnostics and patient-outcome evaluation" },
          {
            variableId: "claim",
            value:
              "validated diagnostic AI can reach specialist-level performance across radiology and pathology tasks in representative clinical settings",
          },
        ],
      },
      {
        key: "health_2",
        schemeId: "sign",
        isInitial: false,
        parentKey: "health_1",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Commission membership is weighted toward technical researchers rather than frontline clinicians and care ethicists. That composition is a sign deployment readiness may be judged too optimistically.",
        variables: [
          {
            variableId: "sign",
            value:
              "technical specialists substantially outnumber frontline clinicians and ethics experts in the cited commission membership",
          },
          {
            variableId: "conclusion_b",
            value:
              "the commission may overestimate real-world readiness of diagnostic AI across diverse care settings",
          },
          {
            variableId: "sign_relationship",
            value:
              "evaluation panels with narrow disciplinary composition can miss implementation constraints outside their core expertise",
          },
        ],
      },
      {
        key: "health_3",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "health_1",
        selectedCqId: "cq_eo_5",
        argumentText:
          "Health-equity researchers warn that model errors remain concentrated in underrepresented patient cohorts. They argue replacement of specialist judgment is unsafe without subgroup safeguards.",
        variables: [
          {
            variableId: "expert",
            value: "Health Equity Research Group, Johns Hopkins",
          },
          { variableId: "domain", value: "clinical AI bias and deployment equity" },
          {
            variableId: "claim",
            value:
              "diagnostic AI deployed without subgroup safeguards causes systematic misclassification in populations underrepresented in training data",
          },
        ],
      },
      {
        key: "health_4",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "health_3",
        selectedCqId: "cq_eo_5",
        argumentText:
          "Large hospital pilots show subgroup gaps narrow when models are retrained on local representative data before use. That evidence supports conditional deployment rather than blanket rejection.",
        variables: [
          {
            variableId: "expert",
            value: "NHS AI Lab Evaluations and Trials Programme",
          },
          { variableId: "domain", value: "local adaptation of clinical AI models" },
          {
            variableId: "claim",
            value:
              "prospective local retraining and monitoring protocols can substantially reduce subgroup performance disparities in deployed diagnostic AI",
          },
        ],
      },
      {
        key: "health_5",
        schemeId: "practical_reasoning",
        isInitial: false,
        parentKey: "health_1",
        selectedCqId: "cq_eo_3",
        argumentText:
          "Health systems should permit diagnostic AI only under human-in-the-loop governance and mandatory outcome auditing. This approach captures productivity gains while retaining clinical accountability.",
        variables: [
          { variableId: "agent", value: "national health systems" },
          {
            variableId: "goal",
            value:
              "improve diagnostic consistency while preserving patient safety and accountability",
          },
          {
            variableId: "action",
            value:
              "adopt human-in-the-loop diagnostic AI with mandatory audit, override tracking, and escalation protocols",
          },
          {
            variableId: "means_justification",
            value:
              "hybrid decision pathways combine algorithmic consistency with clinician judgment and provide auditable accountability for contested cases",
          },
        ],
      },
      {
        key: "health_6",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "health_5",
        selectedCqId: "cq_pr_4",
        argumentText:
          "Complex oversight requirements can overwhelm under-resourced clinics and delay diagnostics in high-demand regions. Delayed workflows may worsen outcomes for time-sensitive conditions.",
        variables: [
          {
            variableId: "cause",
            value: "high-complexity oversight protocols for every diagnostic AI interaction",
          },
          {
            variableId: "effect",
            value: "slower clinical throughput and delayed triage in under-resourced care settings",
          },
          {
            variableId: "causal_generalization",
            value:
              "heavy procedural burdens in constrained healthcare environments often reduce service responsiveness and can degrade time-critical outcomes",
          },
        ],
      },
      {
        key: "health_7",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "health_6",
        selectedCqId: "cq_ce_1",
        argumentText:
          "Implementation studies indicate tiered oversight can protect safety without creating severe bottlenecks. They recommend proportionate controls tied to model risk level and clinical setting.",
        variables: [
          {
            variableId: "expert",
            value: "World Health Organization Digital Health Unit",
          },
          { variableId: "domain", value: "risk-tiered governance for clinical AI systems" },
          {
            variableId: "claim",
            value:
              "proportionate, risk-tiered oversight frameworks preserve safety assurances while reducing operational delay in routine clinical workflows",
          },
        ],
      },
    ],
  },
];

const PUBLIC_POLICY_TOPIC_TITLE = "Public Policy";
const PUBLIC_POLICY_TOPIC_DESCRIPTION =
  "Structured debates on governance trade-offs in public policy decisions";

const PUBLIC_POLICY_SUBTOPIC_SPECS: SeedSubtopicSpec[] = [
  {
    title: "Running Example",
    arguments: [
      // Initial A (pro ULEZ) tree — 8 nodes
      {
        key: "rr_a1",
        schemeId: "consequences",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "Expanding the ULEZ will produce a measurable reduction in harmful particulate emissions and associated respiratory disease burden across Greater London. This benefit outweighs implementation costs.",
        variables: [
          { variableId: "action", value: "expanding the ULEZ" },
          {
            variableId: "consequence",
            value:
              "a measurable reduction in harmful particulate emissions and associated respiratory disease burden across Greater London",
          },
          {
            variableId: "evaluation",
            value: "this consequence is beneficial and outweighs implementation costs",
          },
        ],
      },
      {
        key: "rr_a2",
        schemeId: "consequences",
        isInitial: false,
        parentKey: "rr_a1",
        selectedCqId: "cq_co_3",
        argumentText:
          "Expanding the ULEZ can impose significant financial strain on small businesses with non-compliant fleets. Those economic harms may outweigh the projected health gains in the short term.",
        variables: [
          { variableId: "action", value: "expanding the ULEZ" },
          {
            variableId: "consequence",
            value:
              "significant financial burden on small businesses operating non-compliant vehicles, including risk of closure",
          },
          {
            variableId: "evaluation",
            value: "these economic harms may outweigh the marginal health gains",
          },
        ],
      },
      {
        key: "rr_a3",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "rr_a2",
        selectedCqId: "cq_co_2",
        argumentText:
          "Urban health economists report that ULEZ-style policies produce substantial net social benefit when health savings and productivity effects are included. Their analyses suggest aggregate gains remain positive after transition costs.",
        variables: [
          { variableId: "expert", value: "London School of Hygiene and Transport Policy Panel" },
          {
            variableId: "domain",
            value: "urban transport interventions and public-health economics",
          },
          {
            variableId: "claim",
            value:
              "full-cost accounting of ULEZ expansion typically shows net social benefit once reduced illness and productivity loss are included",
          },
        ],
      },
      {
        key: "rr_a4",
        schemeId: "sign",
        isInitial: false,
        parentKey: "rr_a3",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Several studies in that panel's evidence base are co-funded by clean-transport vendors. That funding pattern is a sign that net-benefit estimates may be optimistic.",
        variables: [
          {
            variableId: "sign",
            value:
              "key impact studies were co-funded by organizations with commercial exposure to low-emission technology adoption",
          },
          {
            variableId: "conclusion_b",
            value: "the panel's net-benefit estimates may systematically overstate policy upside",
          },
          {
            variableId: "sign_relationship",
            value:
              "industry-aligned sponsorship can correlate with optimistic assumptions in policy impact modelling",
          },
        ],
      },
      {
        key: "rr_a5",
        schemeId: "practical_reasoning",
        isInitial: false,
        parentKey: "rr_a1",
        selectedCqId: "cq_co_3",
        argumentText:
          "City authorities should pair ULEZ expansion with time-limited scrappage grants and logistics transition support. This preserves air-quality gains while reducing concentrated cost shocks.",
        variables: [
          { variableId: "agent", value: "city authorities" },
          {
            variableId: "goal",
            value: "improve urban air quality without disproportionate harm to small operators",
          },
          {
            variableId: "action",
            value:
              "expand ULEZ alongside temporary scrappage grants, phased penalties, and transition support for small fleets",
          },
          {
            variableId: "means_justification",
            value:
              "targeted transition measures soften short-run distributional impacts while retaining the long-run emissions reduction pathway",
          },
        ],
      },
      {
        key: "rr_a6",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "rr_a5",
        selectedCqId: "cq_pr_4",
        argumentText:
          "Poorly targeted subsidy design can create windfall effects and administrative delays that blunt intended relief. Those implementation failures may undermine trust in the policy package.",
        variables: [
          {
            variableId: "cause",
            value: "loosely targeted transition subsidy design with weak eligibility controls",
          },
          {
            variableId: "effect",
            value:
              "administrative delays and windfall allocation reduce effective support for high-need operators",
          },
          {
            variableId: "causal_generalization",
            value:
              "complex support schemes without strong targeting often deliver slower and less equitable outcomes than intended",
          },
        ],
      },
      {
        key: "rr_a7",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "rr_a5",
        selectedCqId: "cq_pr_3",
        argumentText:
          "Policy-delivery evaluations show that simple, rule-based grant eligibility materially improves uptake among smaller operators. This supports coupling ULEZ expansion with streamlined support administration.",
        variables: [
          { variableId: "expert", value: "Institute for Government Service Delivery Unit" },
          {
            variableId: "domain",
            value: "public programme implementation and administrative design",
          },
          {
            variableId: "claim",
            value:
              "clear eligibility criteria and low-friction application processes improve equitable access to transition support",
          },
        ],
      },
      {
        key: "rr_a8",
        schemeId: "sign",
        isInitial: false,
        parentKey: "rr_a7",
        selectedCqId: "cq_eo_1",
        argumentText:
          "The headline evaluations focus on pilot boroughs with unusually capable local administrations. That is a sign performance gains may be smaller in weaker-capacity districts.",
        variables: [
          {
            variableId: "sign",
            value:
              "most positive delivery evaluations are drawn from pilot sites with above-average implementation capacity",
          },
          {
            variableId: "conclusion_b",
            value: "administrative gains reported in pilots may not fully generalize citywide",
          },
          {
            variableId: "sign_relationship",
            value:
              "pilot programmes in high-capacity environments often overpredict system-wide implementation performance",
          },
        ],
      },

      // Initial B (con ULEZ) tree — 8 nodes
      {
        key: "rr_b1",
        schemeId: "consequences",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "Rapid ULEZ expansion can impose disproportionate costs on lower-income households and small firms that lack immediate replacement options. In the near term, these burdens can exceed environmental gains for affected communities.",
        variables: [
          { variableId: "action", value: "rapid expansion of ULEZ charging boundaries" },
          {
            variableId: "consequence",
            value:
              "disproportionate financial burden on lower-income households and small businesses with constrained vehicle replacement capacity",
          },
          {
            variableId: "evaluation",
            value:
              "the distributive harms may outweigh near-term environmental gains for exposed groups",
          },
        ],
      },
      {
        key: "rr_b2",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "rr_b1",
        selectedCqId: "cq_co_2",
        argumentText:
          "Public-health analysts find that poorer communities are also the most exposed to road pollution. They argue that delaying expansion prolongs unequal respiratory risk.",
        variables: [
          { variableId: "expert", value: "Greater London Public Health Observatory" },
          { variableId: "domain", value: "urban pollution exposure and health inequality" },
          {
            variableId: "claim",
            value:
              "areas with lower average income face higher transport-related pollution burden and gain disproportionately from emissions reduction policies",
          },
        ],
      },
      {
        key: "rr_b3",
        schemeId: "sign",
        isInitial: false,
        parentKey: "rr_b2",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Exposure maps cited in support of immediate expansion rely on baseline data collected before recent fleet turnover. That timing mismatch is a sign projected gains may be overstated.",
        variables: [
          {
            variableId: "sign",
            value:
              "the key inequality datasets predate major voluntary fleet modernization and post-pandemic travel shifts",
          },
          {
            variableId: "conclusion_b",
            value:
              "the urgency case for immediate boundary expansion may overstate current marginal gains",
          },
          {
            variableId: "sign_relationship",
            value:
              "outdated baseline data can bias intervention-impact estimates in fast-changing transport environments",
          },
        ],
      },
      {
        key: "rr_b4",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "rr_b3",
        selectedCqId: "cq_si_1",
        argumentText:
          "If policy is delayed until perfect data arrives, avoidable emissions exposure persists for years. That delay effect can worsen long-run health inequality.",
        variables: [
          {
            variableId: "cause",
            value: "postponing intervention until fully updated exposure models are available",
          },
          {
            variableId: "effect",
            value:
              "continued pollution exposure in vulnerable districts and compounding long-term respiratory harm",
          },
          {
            variableId: "causal_generalization",
            value:
              "public-health interventions deferred for additional evidence often incur measurable cumulative harm during the waiting period",
          },
        ],
      },
      {
        key: "rr_b5",
        schemeId: "practical_reasoning",
        isInitial: false,
        parentKey: "rr_b1",
        selectedCqId: "cq_co_3",
        argumentText:
          "Municipal policymakers should stage expansion corridor-by-corridor with periodic burden reviews. A phased model can reduce regressivity while still advancing emissions targets.",
        variables: [
          { variableId: "agent", value: "municipal policymakers" },
          {
            variableId: "goal",
            value: "achieve emissions reduction without sharp distributive shocks",
          },
          {
            variableId: "action",
            value:
              "implement phased ULEZ boundary expansion tied to regular burden and compliance-impact reviews",
          },
          {
            variableId: "means_justification",
            value:
              "phasing permits policy calibration and corrective support where burden concentration is highest",
          },
        ],
      },
      {
        key: "rr_b6",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "rr_b5",
        selectedCqId: "cq_pr_3",
        argumentText:
          "Transport transition experts report that phased implementation improves compliance and reduces legal challenge risk. Their evidence suggests policy durability increases when adaptation periods are explicit.",
        variables: [
          { variableId: "expert", value: "UK Urban Mobility Transition Commission" },
          { variableId: "domain", value: "implementation of urban transport regulation" },
          {
            variableId: "claim",
            value:
              "phased introduction with clear adaptation windows improves policy compliance and reduces rollback pressure",
          },
        ],
      },
      {
        key: "rr_b7",
        schemeId: "sign",
        isInitial: false,
        parentKey: "rr_b6",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Many commission case studies involve cities with larger fiscal buffers than London boroughs currently hold. That is a sign their transition pacing recommendations may not transfer directly.",
        variables: [
          {
            variableId: "sign",
            value:
              "comparative cases used by the commission come from municipalities with stronger per-capita fiscal capacity",
          },
          {
            variableId: "conclusion_b",
            value:
              "recommended phase pacing may not be feasible under tighter local budget constraints",
          },
          {
            variableId: "sign_relationship",
            value:
              "policy templates drawn from wealthier jurisdictions can understate implementation friction in lower-capacity settings",
          },
        ],
      },
      {
        key: "rr_b8",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "rr_b7",
        selectedCqId: "cq_si_1",
        argumentText:
          "Even with lower fiscal headroom, concentrating support on high-impact corridors can preserve phase viability. Targeted sequencing reduces the risk that budget limits stall the policy entirely.",
        variables: [
          {
            variableId: "cause",
            value: "targeting phase-one support and enforcement in highest-exposure corridors",
          },
          {
            variableId: "effect",
            value:
              "improved policy feasibility under constrained budgets and reduced chance of full-programme suspension",
          },
          {
            variableId: "causal_generalization",
            value:
              "priority-based sequencing helps complex policies survive resource constraints better than uniform rollout strategies",
          },
        ],
      },

      // Initial C (conditional governance) tree — 8 nodes
      {
        key: "rr_c1",
        schemeId: "practical_reasoning",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "ULEZ expansion should proceed only with mandatory transparency on burden distribution and mitigation delivery. Conditional rollout protects legitimacy while keeping climate and health goals on track.",
        variables: [
          { variableId: "agent", value: "city transport authorities" },
          {
            variableId: "goal",
            value: "deliver emissions reduction with visible fairness safeguards",
          },
          {
            variableId: "action",
            value:
              "expand ULEZ conditionally with published burden metrics, mitigation performance dashboards, and scheduled policy review points",
          },
          {
            variableId: "means_justification",
            value:
              "transparent burden monitoring and review-triggered adjustments improve accountability and preserve democratic legitimacy",
          },
        ],
      },
      {
        key: "rr_c2",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "rr_c1",
        selectedCqId: "cq_pr_4",
        argumentText:
          "Heavy reporting requirements can slow implementation and divert staff from enforcement. If oversight overhead is excessive, policy effectiveness may decline.",
        variables: [
          {
            variableId: "cause",
            value: "overly complex transparency and reporting obligations attached to rollout",
          },
          {
            variableId: "effect",
            value:
              "administrative slowdown and reduced enforcement capacity during critical implementation windows",
          },
          {
            variableId: "causal_generalization",
            value:
              "compliance-heavy governance layers can undermine frontline execution when institutions face fixed operational capacity",
          },
        ],
      },
      {
        key: "rr_c3",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "rr_c2",
        selectedCqId: "cq_ce_1",
        argumentText:
          "Digital-governance practitioners show that lightweight public dashboards can provide accountability with limited operational burden. Their findings support streamlined transparency design rather than abandoning conditions.",
        variables: [
          { variableId: "expert", value: "Civic Digital Service Standards Board" },
          {
            variableId: "domain",
            value: "low-friction accountability infrastructure in public services",
          },
          {
            variableId: "claim",
            value:
              "properly designed digital reporting can deliver meaningful transparency without materially reducing programme execution capacity",
          },
        ],
      },
      {
        key: "rr_c4",
        schemeId: "sign",
        isInitial: false,
        parentKey: "rr_c3",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Most cited dashboard deployments are in agencies with mature data engineering teams. That is a sign implementation costs may be underestimated for smaller borough operations.",
        variables: [
          {
            variableId: "sign",
            value:
              "the benchmark accountability programmes rely on high-capacity internal data teams uncommon in smaller local administrations",
          },
          {
            variableId: "conclusion_b",
            value:
              "expected low-friction deployment of transparency tooling may be optimistic for all boroughs",
          },
          {
            variableId: "sign_relationship",
            value:
              "solutions validated in high-capacity organizations often involve hidden prerequisites absent in lower-capacity contexts",
          },
        ],
      },
      {
        key: "rr_c5",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "rr_c1",
        selectedCqId: "cq_pr_3",
        argumentText:
          "Deliberative-policy scholars find that transparent adjustment triggers improve public acceptance of contested transport reforms. Predictable review rules can lower polarization around rollout decisions.",
        variables: [
          { variableId: "expert", value: "Centre for Democratic Governance and Participation" },
          {
            variableId: "domain",
            value: "public trust and legitimacy in urban policy transitions",
          },
          {
            variableId: "claim",
            value:
              "explicit review triggers and published adjustment criteria increase perceived fairness and policy acceptance in divisive reforms",
          },
        ],
      },
      {
        key: "rr_c6",
        schemeId: "sign",
        isInitial: false,
        parentKey: "rr_c5",
        selectedCqId: "cq_eo_1",
        argumentText:
          "The strongest trust gains are reported where local civic organizations were funded to support participation. That is a sign transparency alone may not deliver similar acceptance effects.",
        variables: [
          {
            variableId: "sign",
            value:
              "high-trust case studies combined transparency reforms with funded community engagement infrastructure",
          },
          {
            variableId: "conclusion_b",
            value:
              "publishing metrics and triggers without participation support may produce weaker legitimacy gains than reported",
          },
          {
            variableId: "sign_relationship",
            value:
              "multi-component interventions can misattribute outcomes to transparency when participation infrastructure is the real driver",
          },
        ],
      },
      {
        key: "rr_c7",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "rr_c5",
        selectedCqId: "cq_eo_3",
        argumentText:
          "Even without large participation budgets, publishing clear adjustment criteria can reduce claims of arbitrary enforcement. That procedural clarity can improve baseline trust.",
        variables: [
          {
            variableId: "cause",
            value: "publicly specified review triggers and enforcement-adjustment criteria",
          },
          {
            variableId: "effect",
            value:
              "lower perceived arbitrariness and improved baseline confidence in policy administration",
          },
          {
            variableId: "causal_generalization",
            value:
              "procedural clarity tends to increase perceived legitimacy in contested regulatory programmes even when full participatory infrastructure is limited",
          },
        ],
      },
      {
        key: "rr_c8",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "rr_c7",
        selectedCqId: "cq_ce_1",
        argumentText:
          "Public-administration meta-reviews indicate that transparent trigger rules consistently reduce conflict escalation in regulatory transitions. The evidence supports retaining conditional rollout architecture.",
        variables: [
          { variableId: "expert", value: "OECD Regulatory Governance Observatory" },
          { variableId: "domain", value: "institutional trust effects of procedural transparency" },
          {
            variableId: "claim",
            value:
              "rule-based transparency mechanisms generally reduce conflict escalation and improve compliance expectations in policy transitions",
          },
        ],
      },
    ],
  },
  {
    title: "Public Service AI Procurement",
    arguments: [
      // Initial A tree — 8 nodes
      {
        key: "proc_a1",
        schemeId: "practical_reasoning",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "Public agencies should require algorithmic impact assessments before procuring high-risk AI systems. This helps prevent vendor lock-in around opaque or unsafe tools.",
        variables: [
          { variableId: "agent", value: "public procurement authorities" },
          {
            variableId: "goal",
            value: "avoid unsafe procurement decisions and irreversible lock-in",
          },
          {
            variableId: "action",
            value:
              "mandate algorithmic impact assessments and interoperability criteria before contract award for high-risk AI systems",
          },
          {
            variableId: "means_justification",
            value:
              "pre-award risk screening and interoperability checks reduce long-term dependence on poorly governed vendor ecosystems",
          },
        ],
      },
      {
        key: "proc_a2",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "proc_a1",
        selectedCqId: "cq_pr_4",
        argumentText:
          "Lengthy pre-award checks can delay urgently needed digital-service upgrades. Those delays may cause service quality deterioration in the short term.",
        variables: [
          {
            variableId: "cause",
            value: "extended pre-award AI assurance requirements in procurement pipelines",
          },
          {
            variableId: "effect",
            value: "slower deployment of needed public-service digital capabilities",
          },
          {
            variableId: "causal_generalization",
            value:
              "additional gatekeeping stages in public procurement can materially extend delivery timelines when institutional capacity is fixed",
          },
        ],
      },
      {
        key: "proc_a3",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "proc_a2",
        selectedCqId: "cq_ce_1",
        argumentText:
          "Procurement reform studies show that standardized assurance templates reduce review time without sacrificing oversight quality. This suggests delays are manageable with process design.",
        variables: [
          { variableId: "expert", value: "National Audit Office Digital Procurement Unit" },
          { variableId: "domain", value: "public procurement process optimization" },
          {
            variableId: "claim",
            value:
              "template-driven assurance workflows can preserve scrutiny while shortening procurement cycle times",
          },
        ],
      },
      {
        key: "proc_a4",
        schemeId: "sign",
        isInitial: false,
        parentKey: "proc_a3",
        selectedCqId: "cq_eo_1",
        argumentText:
          "The strongest cycle-time gains come from central departments with dedicated specialist teams. That is a sign expected speed-ups may be weaker in smaller agencies.",
        variables: [
          {
            variableId: "sign",
            value:
              "performance benchmarks rely heavily on organizations with central specialist procurement teams unavailable in many local agencies",
          },
          {
            variableId: "conclusion_b",
            value:
              "assurance-template reforms may deliver smaller timeline benefits outside high-capacity central departments",
          },
          {
            variableId: "sign_relationship",
            value:
              "administrative reforms validated in specialist-rich environments often have lower effect size in resource-constrained institutions",
          },
        ],
      },
      {
        key: "proc_a5",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "proc_a1",
        selectedCqId: "cq_pr_3",
        argumentText:
          "Competition regulators note that early interoperability requirements improve long-term contestability in AI procurement markets. This limits lock-in and lowers renegotiation costs over time.",
        variables: [
          { variableId: "expert", value: "Competition and Markets Authority Public Tech Unit" },
          {
            variableId: "domain",
            value: "market contestability in government technology procurement",
          },
          {
            variableId: "claim",
            value:
              "interoperability and portability clauses at contract formation reduce lock-in and increase supplier contestability",
          },
        ],
      },
      {
        key: "proc_a6",
        schemeId: "sign",
        isInitial: false,
        parentKey: "proc_a5",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Some contestability studies focus on modular software markets, not integrated AI service contracts. That is a sign transferability to AI procurement may be partial.",
        variables: [
          {
            variableId: "sign",
            value:
              "a substantial share of supporting evidence is drawn from modular software procurement rather than integrated AI model-service contracts",
          },
          {
            variableId: "conclusion_b",
            value:
              "estimated contestability gains may overstate impact in integrated AI procurement contexts",
          },
          {
            variableId: "sign_relationship",
            value:
              "evidence from adjacent but structurally different markets can weaken confidence in direct policy transfer",
          },
        ],
      },
      {
        key: "proc_a7",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "proc_a5",
        selectedCqId: "cq_eo_3",
        argumentText:
          "Even partial interoperability requirements can still improve renegotiation leverage for public buyers. Better leverage tends to reduce lifecycle cost escalation.",
        variables: [
          {
            variableId: "cause",
            value: "inclusion of minimum portability and interface requirements in AI contracts",
          },
          {
            variableId: "effect",
            value: "stronger buyer leverage during renewal and lower long-run cost escalation",
          },
          {
            variableId: "causal_generalization",
            value:
              "contractual options that lower switching barriers generally improve buyer bargaining position over time",
          },
        ],
      },
      {
        key: "proc_a8",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "proc_a7",
        selectedCqId: "cq_ce_1",
        argumentText:
          "Longitudinal procurement datasets indicate that modest portability clauses already reduce renegotiation premiums. The trend supports keeping minimum interoperability baselines.",
        variables: [
          { variableId: "expert", value: "Government Commercial Function Analytics Team" },
          { variableId: "domain", value: "public contract lifecycle economics" },
          {
            variableId: "claim",
            value:
              "minimum portability provisions correlate with lower renewal-time price uplift in comparable public technology contracts",
          },
        ],
      },

      // Initial B tree — 8 nodes
      {
        key: "proc_b1",
        schemeId: "consequences",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "Strict domestic procurement standards for AI can reduce supplier participation and increase bid prices. Those effects may limit adoption of beneficial tools in smaller agencies.",
        variables: [
          {
            variableId: "action",
            value: "imposing strict domestic AI assurance requirements in public procurement",
          },
          {
            variableId: "consequence",
            value:
              "fewer qualifying suppliers and higher bid prices, especially in lower-volume procurements",
          },
          {
            variableId: "evaluation",
            value: "reduced competition and higher prices can undermine public-value outcomes",
          },
        ],
      },
      {
        key: "proc_b2",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "proc_b1",
        selectedCqId: "cq_co_2",
        argumentText:
          "Market-entry analysts find that transparent standardization can lower entry uncertainty and attract higher-quality suppliers over time. Initial concentration may not persist.",
        variables: [
          { variableId: "expert", value: "Public Markets and Innovation Lab" },
          {
            variableId: "domain",
            value: "supplier participation under regulatory standardization",
          },
          {
            variableId: "claim",
            value:
              "clear standards can increase medium-term supplier participation by reducing compliance ambiguity and signalling quality thresholds",
          },
        ],
      },
      {
        key: "proc_b3",
        schemeId: "sign",
        isInitial: false,
        parentKey: "proc_b2",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Most evidence in favour of participation recovery comes from larger national procurement markets. That is a sign small municipal markets may not experience the same rebound.",
        variables: [
          {
            variableId: "sign",
            value:
              "supporting participation-recovery evidence is concentrated in high-volume national procurement ecosystems",
          },
          {
            variableId: "conclusion_b",
            value:
              "supplier-entry recovery under strict standards may be significantly weaker in smaller local procurement markets",
          },
          {
            variableId: "sign_relationship",
            value:
              "scale-dependent market dynamics often limit transfer of supplier-participation findings from national to municipal contexts",
          },
        ],
      },
      {
        key: "proc_b4",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "proc_b3",
        selectedCqId: "cq_si_1",
        argumentText:
          "Regional procurement consortia can increase effective demand volume and attract broader supplier participation. Joint purchasing may offset small-market concentration risk.",
        variables: [
          {
            variableId: "cause",
            value: "forming multi-authority procurement consortia for AI contracts",
          },
          {
            variableId: "effect",
            value:
              "higher effective contract volume and improved supplier participation in smaller jurisdictions",
          },
          {
            variableId: "causal_generalization",
            value:
              "aggregated demand structures typically improve market attractiveness where standalone buyers lack scale",
          },
        ],
      },
      {
        key: "proc_b5",
        schemeId: "practical_reasoning",
        isInitial: false,
        parentKey: "proc_b1",
        selectedCqId: "cq_co_3",
        argumentText:
          "Authorities should phase procurement standards by system risk tier rather than imposing one uniform threshold. This preserves competition for low-risk use while enforcing stricter controls where harms are higher.",
        variables: [
          { variableId: "agent", value: "public procurement regulators" },
          {
            variableId: "goal",
            value: "balance market competition with proportionate AI assurance",
          },
          {
            variableId: "action",
            value:
              "adopt risk-tiered procurement standards with tighter requirements for high-impact systems and lighter requirements for low-impact systems",
          },
          {
            variableId: "means_justification",
            value:
              "tiering aligns compliance burden with harm potential and reduces unnecessary exclusion of suppliers in low-risk categories",
          },
        ],
      },
      {
        key: "proc_b6",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "proc_b5",
        selectedCqId: "cq_pr_4",
        argumentText:
          "Poorly calibrated risk tiers can encourage strategic category gaming by vendors. Misclassification can weaken assurance where scrutiny is needed most.",
        variables: [
          { variableId: "cause", value: "loosely defined risk-tier classification boundaries" },
          {
            variableId: "effect",
            value: "vendor gaming and under-classification of high-risk deployments",
          },
          {
            variableId: "causal_generalization",
            value:
              "compliance frameworks with ambiguous thresholds often create incentives for boundary gaming and misreporting",
          },
        ],
      },
      {
        key: "proc_b7",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "proc_b5",
        selectedCqId: "cq_pr_3",
        argumentText:
          "Regulatory-design experts show that publishable, auditable tier criteria significantly reduce classification gaming. Their findings support risk-tiered standards with strong audit backstops.",
        variables: [
          { variableId: "expert", value: "Administrative Law and Regulation Institute" },
          {
            variableId: "domain",
            value: "regulatory classification design and compliance behaviour",
          },
          {
            variableId: "claim",
            value:
              "auditable and publicly testable tier criteria reduce strategic misclassification and improve framework integrity",
          },
        ],
      },
      {
        key: "proc_b8",
        schemeId: "sign",
        isInitial: false,
        parentKey: "proc_b7",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Many successful anti-gaming examples involve sectors with stronger enforcement staffing than local procurement teams. That is a sign implementation support is a precondition for expected benefits.",
        variables: [
          {
            variableId: "sign",
            value:
              "evidence for anti-gaming classification controls is concentrated in sectors with higher enforcement headcount and investigative capacity",
          },
          {
            variableId: "conclusion_b",
            value:
              "risk-tier controls may underperform unless local procurement agencies receive additional enforcement support",
          },
          {
            variableId: "sign_relationship",
            value:
              "compliance frameworks effective in high-capacity enforcement contexts often degrade when enforcement resources are sparse",
          },
        ],
      },

      // Initial C tree — 8 nodes
      {
        key: "proc_c1",
        schemeId: "expert_opinion",
        isInitial: true,
        parentKey: null,
        selectedCqId: null,
        argumentText:
          "Independent technical assurance bodies can improve procurement decisions by separating evaluation from vendor sales narratives. Their oversight can raise reliability and accountability standards.",
        variables: [
          { variableId: "expert", value: "Royal Academy Digital Assurance Working Group" },
          { variableId: "domain", value: "independent assurance in public technology procurement" },
          {
            variableId: "claim",
            value:
              "external independent technical assurance improves procurement quality and reduces acceptance of unverified vendor claims",
          },
        ],
      },
      {
        key: "proc_c2",
        schemeId: "sign",
        isInitial: false,
        parentKey: "proc_c1",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Some independent assurance panels rely on rotating consultants from the same supplier ecosystem they assess. That overlap is a sign independence may be weaker than advertised.",
        variables: [
          {
            variableId: "sign",
            value:
              "assurance teams include rotating consultants with recent commercial ties to vendors under evaluation",
          },
          {
            variableId: "conclusion_b",
            value:
              "the practical independence of assurance recommendations may be compromised in some procurement contexts",
          },
          {
            variableId: "sign_relationship",
            value:
              "institutional overlap between evaluators and evaluated parties can predict weaker adversarial scrutiny",
          },
        ],
      },
      {
        key: "proc_c3",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "proc_c2",
        selectedCqId: "cq_si_1",
        argumentText:
          "Conflict-of-interest disclosure and mandatory recusal rules can materially improve panel independence in practice. Strong governance design can offset personnel overlap risks.",
        variables: [
          {
            variableId: "cause",
            value: "strict disclosure and recusal requirements for assurance panel membership",
          },
          {
            variableId: "effect",
            value: "higher effective independence and stronger adversarial review quality",
          },
          {
            variableId: "causal_generalization",
            value:
              "formal conflict-management controls reduce bias risk in expert governance bodies with mixed professional backgrounds",
          },
        ],
      },
      {
        key: "proc_c4",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "proc_c3",
        selectedCqId: "cq_ce_1",
        argumentText:
          "Oversight-governance evaluations find that enforced recusal protocols improve review credibility and reduce contested awards. This supports retaining independent assurance with tighter safeguards.",
        variables: [
          { variableId: "expert", value: "Public Oversight and Integrity Network" },
          { variableId: "domain", value: "governance controls in expert oversight institutions" },
          {
            variableId: "claim",
            value:
              "mandatory recusal and disclosure frameworks significantly improve perceived and measured oversight integrity",
          },
        ],
      },
      {
        key: "proc_c5",
        schemeId: "practical_reasoning",
        isInitial: false,
        parentKey: "proc_c1",
        selectedCqId: "cq_eo_3",
        argumentText:
          "Procurement offices should maintain external assurance panels but require published conflict registers and rotating membership limits. This keeps expertise while protecting legitimacy.",
        variables: [
          { variableId: "agent", value: "public procurement offices" },
          {
            variableId: "goal",
            value: "retain technical scrutiny while improving assurance legitimacy",
          },
          {
            variableId: "action",
            value:
              "use external assurance panels with mandatory conflict registers, rotation caps, and public recusal logs",
          },
          {
            variableId: "means_justification",
            value:
              "transparent safeguards preserve specialist input while reducing capture risk in repeated procurement cycles",
          },
        ],
      },
      {
        key: "proc_c6",
        schemeId: "cause_to_effect",
        isInitial: false,
        parentKey: "proc_c5",
        selectedCqId: "cq_pr_4",
        argumentText:
          "High turnover rules can reduce accumulated domain knowledge and slow complex assessments. This may weaken review quality for novel systems.",
        variables: [
          { variableId: "cause", value: "overly aggressive panel rotation requirements" },
          {
            variableId: "effect",
            value: "knowledge loss and reduced assessment quality for complex procurements",
          },
          {
            variableId: "causal_generalization",
            value:
              "expert bodies that rotate too quickly often lose contextual understanding needed for high-complexity evaluations",
          },
        ],
      },
      {
        key: "proc_c7",
        schemeId: "expert_opinion",
        isInitial: false,
        parentKey: "proc_c5",
        selectedCqId: "cq_pr_3",
        argumentText:
          "Governance specialists recommend staggered rotation rather than full turnover to preserve continuity and independence simultaneously. Their approach reduces capture without sacrificing institutional memory.",
        variables: [
          { variableId: "expert", value: "Council for Public Decision Quality" },
          { variableId: "domain", value: "institutional design for expert-review bodies" },
          {
            variableId: "claim",
            value:
              "staggered rotation models balance anti-capture safeguards with continuity of expertise in technical oversight processes",
          },
        ],
      },
      {
        key: "proc_c8",
        schemeId: "sign",
        isInitial: false,
        parentKey: "proc_c7",
        selectedCqId: "cq_eo_1",
        argumentText:
          "Most successful staggered-rotation examples come from national regulators with larger staffing pools. That is a sign local adaptation guidance is required before direct replication.",
        variables: [
          {
            variableId: "sign",
            value:
              "supporting case studies are concentrated in organizations with broader staffing depth than local procurement entities",
          },
          {
            variableId: "conclusion_b",
            value:
              "staggered rotation should be adapted to local capacity constraints rather than copied unchanged",
          },
          {
            variableId: "sign_relationship",
            value:
              "governance models proven in high-capacity institutions typically require contextual adaptation for smaller organizations",
          },
        ],
      },
    ],
  },
];

const SEEDED_TOPIC_SPECS: SeedTopicSpec[] = [
  {
    title: AI_TOPIC_TITLE,
    description: AI_TOPIC_DESCRIPTION,
    subtopics: AI_SUBTOPIC_SPECS,
  },
  {
    title: PUBLIC_POLICY_TOPIC_TITLE,
    description: PUBLIC_POLICY_TOPIC_DESCRIPTION,
    subtopics: PUBLIC_POLICY_SUBTOPIC_SPECS,
  },
];

async function createArgumentWithVariables(data: {
  id: string;
  schemeId: string;
  isInitial: boolean;
  parentId: string | null;
  parentType: "SUBTOPIC" | "ARGUMENT";
  subtopicId: number;
  selectedCqId: string | null;
  argumentText: string;
  variables: SeedVariable[];
  authorId: number;
}) {
  await prisma.argument.create({
    data: {
      id: data.id,
      schemeId: data.schemeId,
      argumentText: data.argumentText,
      isInitial: data.isInitial,
      parentId: data.parentId,
      parentType: data.parentType,
      subtopicId: data.subtopicId,
      selectedCqId: data.selectedCqId,
      status: "UNDECIDED",
      childIds: [],
      descendantCount: 0,
      authorId: data.authorId,
      variables: {
        create: data.variables.map((v) => ({
          variableId: v.variableId,
          value: v.value,
        })),
      },
    },
  });
}

function computeDescendantCounts(
  childrenByKey: Map<string, string[]>,
  keyToId: Map<string, string>,
): Array<{ id: string; childIds: string[]; descendantCount: number }> {
  const memo = new Map<string, number>();
  const count = (key: string): number => {
    if (memo.has(key)) return memo.get(key)!;
    const children = childrenByKey.get(key) ?? [];
    let total = 0;
    for (const child of children) {
      total += 1 + count(child);
    }
    memo.set(key, total);
    return total;
  };

  const updates: Array<{ id: string; childIds: string[]; descendantCount: number }> = [];
  for (const [key, id] of keyToId.entries()) {
    const childIds = (childrenByKey.get(key) ?? []).map((childKey) => keyToId.get(childKey)!);
    updates.push({
      id,
      childIds,
      descendantCount: count(key),
    });
  }
  return updates;
}

async function seedSubtopicTree(subtopicId: number, authorId: number, spec: SeedSubtopicSpec) {
  const keyToId = new Map<string, string>();
  const childrenByKey = new Map<string, string[]>();

  for (const arg of spec.arguments) {
    const id = createId();
    keyToId.set(arg.key, id);
    childrenByKey.set(arg.key, []);
  }

  for (const arg of spec.arguments) {
    if (arg.parentKey) {
      if (!childrenByKey.has(arg.parentKey)) {
        throw new Error(`Missing parent key '${arg.parentKey}' in subtopic '${spec.title}'`);
      }
      childrenByKey.get(arg.parentKey)!.push(arg.key);
    }
  }

  for (const arg of spec.arguments) {
    const id = keyToId.get(arg.key)!;
    const parentId = arg.parentKey ? keyToId.get(arg.parentKey)! : null;
    await createArgumentWithVariables({
      id,
      schemeId: arg.schemeId,
      isInitial: arg.isInitial,
      parentId,
      parentType: arg.parentKey ? "ARGUMENT" : "SUBTOPIC",
      subtopicId,
      selectedCqId: arg.selectedCqId,
      argumentText: arg.argumentText,
      variables: arg.variables,
      authorId,
    });
  }

  const updates = computeDescendantCounts(childrenByKey, keyToId);
  for (const update of updates) {
    await prisma.argument.update({
      where: { id: update.id },
      data: {
        childIds: update.childIds,
        descendantCount: update.descendantCount,
      },
    });
  }
}

async function propagateSubtopicStatuses(subtopicId: number): Promise<number> {
  const rows = await prisma.argument.findMany({
    where: { subtopicId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      parentId: true,
      childIds: true,
    },
  });

  const graph: EvaluationGraph = new Map<string, EvaluationNode>();
  for (const row of rows) {
    graph.set(row.id, {
      id: row.id,
      status: row.status,
      parentId: row.parentId,
      childIds: row.childIds,
    });
  }

  const changes = evaluateGroundedSemantics(graph);
  if (changes.size === 0) return 0;

  await prisma.$transaction(
    [...changes.entries()].map(([id, status]) =>
      prisma.argument.update({
        where: { id },
        data: { status },
      }),
    ),
  );

  return changes.size;
}

async function reseedManagedTopic(topicSpec: SeedTopicSpec, authorId: number) {
  let topic = await prisma.topic.findFirst({
    where: { title: topicSpec.title },
  });
  if (!topic) {
    topic = await prisma.topic.create({
      data: {
        title: topicSpec.title,
        description: topicSpec.description,
      },
    });
  } else {
    await prisma.topic.update({
      where: { id: topic.id },
      data: { description: topicSpec.description },
    });
  }

  const existingSubtopics = await prisma.subtopic.findMany({
    where: { topicId: topic.id },
    select: { id: true },
  });
  const existingSubtopicIds = existingSubtopics.map((subtopic) => subtopic.id);
  if (existingSubtopicIds.length > 0) {
    await prisma.argumentVariable.deleteMany({
      where: { argument: { subtopicId: { in: existingSubtopicIds } } },
    });
    await prisma.argument.deleteMany({
      where: { subtopicId: { in: existingSubtopicIds } },
    });
    await prisma.subtopic.deleteMany({
      where: { topicId: topic.id },
    });
  }

  let argumentTotal = 0;
  let statusUpdatesTotal = 0;
  for (const subtopicSpec of topicSpec.subtopics) {
    console.log(`  Seeding subtopic: ${subtopicSpec.title}`);
    const subtopic = await prisma.subtopic.create({
      data: { topicId: topic.id, title: subtopicSpec.title },
    });
    await seedSubtopicTree(subtopic.id, authorId, subtopicSpec);
    const statusUpdates = await propagateSubtopicStatuses(subtopic.id);
    statusUpdatesTotal += statusUpdates;
    argumentTotal += subtopicSpec.arguments.length;
  }

  return {
    subtopicTotal: topicSpec.subtopics.length,
    argumentTotal,
    statusUpdatesTotal,
  };
}

async function main() {
  let schemeCount = 0;
  let cqCount = 0;

  for (const scheme of schemes.schemes) {
    console.log(`Seeding scheme: ${scheme.id} (${scheme.name})`);
    await prisma.scheme.upsert({
      where: { id: scheme.id },
      create: {
        id: scheme.id,
        name: scheme.name,
        description: scheme.description,
        conclusion: scheme.conclusion,
        variables: scheme.variables,
      },
      update: {
        name: scheme.name,
        description: scheme.description,
        conclusion: scheme.conclusion,
        variables: scheme.variables,
      },
    });
    schemeCount++;
    await prisma.activeScheme.upsert({
      where: { schemeId: scheme.id },
      create: { schemeId: scheme.id },
      update: {},
    });

    let cqNum = 0;
    for (const cq of scheme.criticalQuestions) {
      await prisma.criticalQuestion.upsert({
        where: { id: cq.id },
        create: {
          id: cq.id,
          schemeId: scheme.id,
          text: cq.text,
          description: cq.description,
          validResponseSchemeIds: cq.validResponseSchemeIds,
        },
        update: {
          text: cq.text,
          description: cq.description,
          validResponseSchemeIds: cq.validResponseSchemeIds,
        },
      });
      cqNum++;
      cqCount++;
    }
    console.log(`  → Upserted ${cqNum} CQs`);
  }

  console.log(`Seeding complete: ${schemeCount} schemes, ${cqCount} CQs`);

  // ---------------------------------------------------------------------------
  // Section 1 — Seed users. seed_user authors the seeded arguments. All three
  // accounts share one bcrypt-hashed demo password, so they can log in; change it
  // before seeding any database that is reachable by others.
  // ---------------------------------------------------------------------------
  const hashedPassword = await bcrypt.hash("seed-password-123", 10);
  const seedUser = await prisma.user.upsert({
    where: { email: "seed@inch.dev" },
    create: {
      username: "seed_user",
      email: "seed@inch.dev",
      password: hashedPassword,
      isAdmin: true,
    },
    update: {
      isAdmin: true,
      password: hashedPassword,
    },
  });
  console.log("Seed user:", seedUser.email);

  // Additional deterministic seeded users for demos/tests.
  const johnDoe = await prisma.user.upsert({
    where: { username: "johndoe" },
    create: {
      username: "johndoe",
      email: "john@inch.dev",
      password: hashedPassword,
      isAdmin: false,
    },
    update: {
      email: "john@inch.dev",
      password: hashedPassword,
      isAdmin: false,
    },
  });
  const janeDoe = await prisma.user.upsert({
    where: { username: "janedoe" },
    create: {
      username: "janedoe",
      email: "jane@inch.dev",
      password: hashedPassword,
      isAdmin: true,
    },
    update: {
      email: "jane@inch.dev",
      password: hashedPassword,
      isAdmin: true,
    },
  });
  console.log("Seed users:", johnDoe.email, janeDoe.email);

  // ---------------------------------------------------------------------------
  // Section 2 — Replace seeded trees for managed seeded topics
  // ---------------------------------------------------------------------------
  let totalSubtopics = 0;
  let totalArguments = 0;
  let totalStatusUpdates = 0;
  for (const topicSpec of SEEDED_TOPIC_SPECS) {
    console.log(`Seeding topic: ${topicSpec.title}`);
    const counts = await reseedManagedTopic(topicSpec, seedUser.id);
    totalSubtopics += counts.subtopicTotal;
    totalArguments += counts.argumentTotal;
    totalStatusUpdates += counts.statusUpdatesTotal;
  }

  console.log(
    `Topics seeded: ${SEEDED_TOPIC_SPECS.length}, Subtopics: ${totalSubtopics}, Arguments: ${totalArguments}, Status updates: ${totalStatusUpdates}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
