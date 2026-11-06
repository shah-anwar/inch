import { useEffect, type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { DiagramPlaceholder } from "@/components/learn/DiagramPlaceholder";
import { setPageTitle } from "@/lib/pageTitle";
import { cn } from "@/lib/utils";
import { useLearnTocActiveId } from "@/pages/learn/useLearnTocActiveId";

const LEARN_SECTION_IDS = [
  "what-is-INCH",
  "argumentation-theory",
  "schemes-on-INCH",
  "critical-questions",
  "argument-graph",
  "argument-evaluation",
  "argument-labelling",
  "llm-assistance",
  "creating-an-argument",
  "creating-a-counter-argument",
  "glossary",
] as const;

const TOC_ITEMS: { id: (typeof LEARN_SECTION_IDS)[number]; label: string }[] = [
  { id: "what-is-INCH", label: "What is INCH?" },
  { id: "argumentation-theory", label: "Argumentation theory" },
  { id: "schemes-on-INCH", label: "Schemes on INCH" },
  { id: "critical-questions", label: "Critical questions" },
  { id: "argument-graph", label: "The argument graph" },
  { id: "argument-evaluation", label: "Argument evaluation" },
  { id: "argument-labelling", label: "Argument labelling" },
  { id: "llm-assistance", label: "LLM assistance" },
  { id: "creating-an-argument", label: "Creating an argument" },
  { id: "creating-a-counter-argument", label: "Creating a counter-argument" },
  { id: "glossary", label: "Glossary" },
];

function TocLink({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <a
      href={href}
      className={cn(
        "block rounded-md border-l-2 py-1.5 pl-3 text-sm transition-colors",
        isActive
          ? "border-primary bg-muted/50 font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/30 hover:text-foreground",
      )}
    >
      {label}
    </a>
  );
}

function LearnTocMobile({ activeId }: { activeId: string }) {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          On this page
          <span className="text-muted-foreground transition group-open:rotate-180">▼</span>
        </span>
      </summary>
      <nav className="border-t border-border px-2 py-3" aria-label="Table of contents">
        <ul className="space-y-0.5">
          {TOC_ITEMS.map((item) => (
            <li key={item.id}>
              <TocLink href={`#${item.id}`} label={item.label} isActive={activeId === item.id} />
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}

function LearnTocDesktop({ activeId }: { activeId: string }) {
  return (
    <nav
      className="sticky top-24 max-h-[calc(100vh-7rem)] w-56 shrink-0 overflow-y-auto pr-3"
      aria-label="Table of contents"
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-0.5 border-l border-border/60">
        {TOC_ITEMS.map((item) => (
          <li key={item.id} className="-ml-px">
            <TocLink href={`#${item.id}`} label={item.label} isActive={activeId === item.id} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <div className="max-w-[70ch] text-base leading-relaxed text-foreground">{children}</div>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-muted-foreground">{children}</p>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-lg font-semibold tracking-tight text-foreground">{children}</h3>;
}

/** Horizontal rule separating major documentation sections. */
function SectionRule() {
  return <hr className="my-12 w-full border-0 border-t border-border md:my-14" aria-hidden />;
}

/**
 * Long-form documentation: INCH concepts, Walton schemes, critical questions,
 * Dung semantics, labelling, LLM boundaries, and creation flows.
 */
export default function LearnPage() {
  const activeId = useLearnTocActiveId(LEARN_SECTION_IDS);

  useEffect(() => {
    setPageTitle("Learn INCH");
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-[min(100%,96rem)] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8 lg:hidden">
          <LearnTocMobile activeId={activeId} />
        </div>
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
          <aside className="hidden shrink-0 lg:block">
            <LearnTocDesktop activeId={activeId} />
          </aside>
          <article className="min-w-0 flex-1 lg:max-w-[min(100%,70ch)]">
            <header className="mb-12 border-b border-border pb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Documentation
              </p>
              <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                Learn INCH
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                How structured argumentation, schemes, critical questions, and abstract evaluation
                fit together in this platform — written for curious readers new to the formal
                theory.
              </p>
            </header>

            <Body>
              <section id="what-is-INCH" className="scroll-mt-28">
                <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground">
                  What is INCH?
                </h2>
                <H3>The problem with unstructured debate</H3>
                <P>
                  Typical forums and comment threads mix opinions, rhetorical moves, and evidence in
                  free text. Threads grow long, positions blur, and it is hard to see what actually
                  supports what, or which objections genuinely target a claim. The structure of the
                  reasoning is left implicit.
                </P>
                <H3>How INCH structures arguments using formal theory</H3>
                <P>
                  INCH makes the shape of reasoning explicit. Every contribution is an{" "}
                  <strong className="text-foreground">argument</strong> tied to a named{" "}
                  <strong className="text-foreground">argumentation scheme</strong> from the
                  catalogue (Walton-style patterns). Schemes supply a conclusion template and slots
                  for <strong className="text-foreground">variables</strong>. Challenges take the
                  form of <strong className="text-foreground">critical questions</strong> linked to
                  those schemes, and acceptable counter-arguments must fit response schemes tied to
                  each question. Together, this yields a directed{" "}
                  <strong className="text-foreground">argument graph</strong> of support and attack
                  edges. The platform then evaluates that graph using abstract argumentation
                  semantics (Dung), assigning each argument a status:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                    in
                  </code>
                  ,{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                    out
                  </code>
                  , or{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                    undecided
                  </code>{" "}
                  — without judging factual truth or popularity.
                </P>
                <H3>What you can do on INCH</H3>
                <P>
                  Browse <strong className="text-foreground">topics</strong> and{" "}
                  <strong className="text-foreground">subtopics</strong>, read arguments and their
                  inference chains, open the graph view, and — when signed in — create new initial
                  arguments or counter-arguments using the guided flows. Status labels update as the
                  graph changes, so you always see how the structural evaluation currently
                  classifies each node.
                </P>
              </section>

              <SectionRule />

              <section id="argumentation-theory" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  Argumentation theory
                </h2>
                <H3>What an argument is, in formal terms</H3>
                <P>
                  In this tradition, an <strong className="text-foreground">argument</strong> is not
                  merely “a point of view.” It is a structured piece of reasoning: a claim supported
                  in a rule-like way, often rendered as a conclusion following from explicit
                  premises or data slots. INCH stores that structure: which scheme you used, which
                  variable values you filled, and how the resulting sentence (the stored{" "}
                  <strong className="text-foreground">argument text</strong>) reads as natural
                  language.
                </P>
                <H3>Argumentation schemes (Walton)</H3>
                <P>
                  <strong className="text-foreground">Argumentation schemes</strong> are reusable
                  patterns of everyday reasoning — for example, reasoning from expert opinion, from
                  sign, or from consequences. Douglas Walton catalogued many of them and linked each
                  pattern to typical <strong className="text-foreground">critical questions</strong>{" "}
                  that test whether an instance of the pattern is appropriate. INCH’s scheme library
                  follows that idea: each scheme is a precise template you instantiate, not a vague
                  genre label.
                </P>
                <H3>How schemes impose structure on reasoning</H3>
                <P>
                  A scheme forces you to say <em>which</em> pattern you claim to instantiate, to
                  fill every required slot, and to face the corresponding critical questions when
                  someone replies. That makes debates easier to audit: observers can see the
                  intended inferential form and whether objections target that form or something
                  else.
                </P>
              </section>

              <SectionRule />

              <section id="schemes-on-INCH" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  Argumentation schemes on INCH
                </h2>
                <H3>Conclusion template and variables</H3>
                <P>
                  Each scheme defines a{" "}
                  <strong className="text-foreground">conclusion template</strong> — a sentence
                  shape with named placeholders — and a list of{" "}
                  <strong className="text-foreground">variables</strong> (each with a name,
                  description, and type such as string, entity, or claim). When you create an
                  argument, you choose one scheme and supply a value for every variable. The
                  platform substitutes those values into the template to produce a single readable
                  conclusion line for your argument.
                </P>
                <H3>Example: Argument from expert opinion</H3>
                <P>
                  Take the classic{" "}
                  <strong className="text-foreground">argument from expert opinion</strong> pattern,
                  in simplified form: you identify an{" "}
                  <strong className="text-foreground">expert</strong>, their{" "}
                  <strong className="text-foreground">field</strong>, and a{" "}
                  <strong className="text-foreground">claim</strong> they endorse. The scheme’s
                  template might read like: “Source <em>E</em> is a credible expert in domain{" "}
                  <em>D</em>; <em>E</em> asserts claim <em>C</em>; therefore <em>C</em> is
                  plausible.” You fill <em>E</em>, <em>D</em>, and <em>C</em> with concrete text.
                  The important point is not the exact wording of the template in the database — it
                  is that the same inferential pattern is shared by every use of that scheme, so
                  everyone knows what kind of move you are making.
                </P>
                <H3>From variables to readable text</H3>
                <P>
                  After variables are validated, INCH renders the scheme’s template into the
                  argument’s stored prose (and may offer neutral phrasing variants at creation time
                  — see{" "}
                  <a
                    href="#llm-assistance"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    LLM assistance
                  </a>
                  ). What persists is the structured record (scheme id, variable ids and values, and
                  the final chosen text). Readers see that text as the body of the argument card;
                  opening the variables panel shows the underlying slots if they want the full
                  structured view.
                </P>
              </section>

              <SectionRule />

              <section id="critical-questions" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  Critical questions
                </h2>
                <H3>What a critical question is</H3>
                <P>
                  A <strong className="text-foreground">critical question</strong> (CQ) is a
                  standard test tied to a scheme. Answering it satisfactorily strengthens an
                  instantiation of the scheme; a damaging answer motivates a counter-move. CQs are
                  not random prompts — they are part of the theory of how each scheme can fail or be
                  challenged.
                </P>
                <H3>How CQs relate to a scheme</H3>
                <P>
                  Each scheme in the catalogue carries a set of CQs defined by the administrators
                  who curate schemes. When you view an argument, INCH can list the CQs that apply to
                  its scheme (subject to which schemes are active in the system). Those questions
                  encode the usual ways sceptics press that pattern of reasoning.
                </P>
                <H3>Raising a CQ and producing a counter-argument</H3>
                <P>
                  To attack an existing argument, you typically pick one of its visible CQs. That
                  choice does two things: it records <em>why</em> your reply targets the parent (the
                  question you are answering), and it restricts which{" "}
                  <strong className="text-foreground">response schemes</strong> you may use for your
                  counter — only schemes registered as valid responses to that CQ. Your
                  counter-argument is stored as a new node whose parent is the targeted argument.
                </P>
                <H3>Concrete CQ example (expert opinion)</H3>
                <P>
                  For expert opinion, a natural CQ is whether the expert’s expertise really covers
                  the domain of the claim — for example: “Is source <em>E</em> genuinely qualified
                  in domain <em>D</em> for this kind of claim?” If your counter-instantiation uses a
                  response scheme appropriate to that CQ, you are not just disagreeing with the
                  conclusion; you are challenging whether the expert-opinion pattern applies cleanly
                  to that case. The graph records your node as attacking the parent along that
                  critical line of objection.
                </P>
              </section>

              <SectionRule />

              <section id="argument-graph" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  The argument graph
                </h2>
                <H3>Nodes and directed attack edges</H3>
                <P>
                  At the subtopic level, INCH treats each argument as a{" "}
                  <strong className="text-foreground">node</strong>. A directed edge from node{" "}
                  <em>B</em> to node <em>A</em> means <em>B</em>{" "}
                  <strong className="text-foreground">attacks</strong> <em>A</em> in the abstract
                  sense: the acceptance of <em>B</em> is incompatible with the acceptance of{" "}
                  <em>A</em> under the chosen semantics. Counter-arguments authored against a parent
                  argument introduce such attack edges from child to parent.
                </P>
                <H3>Initial arguments vs counter-arguments</H3>
                <P>
                  An <strong className="text-foreground">initial</strong> argument attaches directly
                  to a subtopic (it starts a thread). A{" "}
                  <strong className="text-foreground">counter-argument</strong> attaches to another
                  argument and records which CQ and response scheme you used. Structurally, both are
                  arguments; the distinction is where they connect in the graph.
                </P>
                <H3>How the graph grows</H3>
                <P>
                  As participants submit counters to counters, the graph deepens. The visualisation
                  shows nodes and attack relations for one subtopic at a time, so you can explore
                  how local disputes branch without losing the formal attack relation between any
                  pair of nodes.
                </P>
                <H3>Topics → subtopics → arguments</H3>
                <P>
                  <strong className="text-foreground">Topics</strong> group broad areas (e.g. a
                  policy domain). <strong className="text-foreground">Subtopics</strong> narrow the
                  discussion space; each subtopic hosts its own argument graph. Navigating topic →
                  subtopic → argument is the main browsing path; evaluation and WebSocket updates
                  are scoped per subtopic graph.
                </P>
              </section>

              <DiagramPlaceholder
                label="Placeholder — example argument graph"
                caption="A small tree or DAG of argument nodes with directed arrows showing attacks (child attacking parent). Labels should identify one initial node at the subtopic and several counters chained beneath."
              />

              <SectionRule />

              <section id="argument-evaluation" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  Argument evaluation — abstract argumentation semantics
                </h2>
                <H3>Dung’s framework, in plain terms</H3>
                <P>
                  Phan Minh Dung’s{" "}
                  <strong className="text-foreground">abstract argumentation frameworks</strong>{" "}
                  model disputes with nothing but a set of arguments and a binary{" "}
                  <strong className="text-foreground">attack</strong> relation. There is no built-in
                  notion of “evidence strength” or audience vote — only who attacks whom. INCH
                  adopts that abstraction: evaluation looks at the attack graph induced by stored
                  parent–child attack links.
                </P>
                <H3>What “attack” means</H3>
                <P>
                  If your counter-argument is accepted as a node that attacks its parent, the
                  framework treats that as mutual incompatibility for acceptance: in typical
                  semantics, you should not blindly accept both unless the rules for resolving
                  conflicts say otherwise. INCH does not look at the natural-language content to
                  decide that — only the structural attack relation you created by submitting under
                  a CQ.
                </P>
                <H3>
                  The three statuses:{" "}
                  <code className="rounded bg-muted px-1 font-mono text-sm">in</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-sm">out</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-sm">undecided</code>
                </H3>
                <P>
                  Under the semantics INCH uses, each argument receives exactly one of these labels:{" "}
                  <strong className="text-foreground">in</strong> means structurally acceptable in
                  the current evaluation; <strong className="text-foreground">out</strong> means
                  unacceptable given the attacks;{" "}
                  <strong className="text-foreground">undecided</strong> means the framework leaves
                  the argument neither clearly in nor out (for example when conflicts are symmetric
                  or unresolved by the chosen rule).
                </P>
                <H3>Grounded semantics</H3>
                <P>
                  INCH computes labels using{" "}
                  <strong className="text-foreground">grounded semantics</strong>: informally, start
                  from nodes that are not attacked, accept those, then iteratively reject anything
                  attacked by an accepted node, and repeat until the labelling stabilises. The
                  result is a principled, deterministic function of the graph — the same graph
                  always yields the same statuses.
                </P>
                <H3>Structural evaluation only</H3>
                <P>
                  Nothing in this step checks whether an expert really is credible or a claim is
                  factually true. The platform intentionally separates{" "}
                  <em>structural acceptability in the graph</em> from{" "}
                  <em>real-world correctness</em>. That preserves auditability and keeps evaluation
                  reproducible.
                </P>
              </section>

              <DiagramPlaceholder
                label="Placeholder — same graph with status colours"
                caption="The sample graph from above, each node annotated with in (e.g. green), out (e.g. red), or undecided (e.g. amber), matching grounded semantics on that structure."
              />

              <SectionRule />

              <section id="argument-labelling" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  Argument labelling
                </h2>
                <H3>The algorithm in plain English</H3>
                <P>
                  After any change to the attack structure within a subtopic, the backend rebuilds
                  the affected graph fragment and runs the grounded labelling procedure: determine
                  which arguments are defended or defeated purely by attack relations, assign{" "}
                  <code className="rounded bg-muted px-1 font-mono text-sm">in</code> /{" "}
                  <code className="rounded bg-muted px-1 font-mono text-sm">out</code> /{" "}
                  <code className="rounded bg-muted px-1 font-mono text-sm">undecided</code>, and
                  write the results to the database.
                </P>
                <H3>New submissions trigger re-evaluation</H3>
                <P>
                  Creating an initial argument or a counter-argument enqueues a job for that
                  subtopic’s graph. When the worker finishes, updated statuses are persisted and
                  clients can refresh via polling or WebSocket notifications. You do not need to
                  “re-run” evaluation manually.
                </P>
                <H3>Local ripples, branch flips</H3>
                <P>
                  Because labels are global for that subtopic’s connected component, a single new
                  counter-argument can change the status not only of its parent but of other nodes
                  upstream or sideways in the same attack component. A small structural addition may
                  reorganise who counts as defended or defeated under grounded semantics.
                </P>
              </section>

              <DiagramPlaceholder
                label="Placeholder — status flip before / after"
                caption="Two panels: left shows prior in/out/undecided labels; right shows the same subgraph after one new counter-argument is added, with at least one node’s label changed to reflect the updated grounded labelling."
              />

              <SectionRule />

              <section id="llm-assistance" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  LLM assistance — what the AI does (and doesn’t do)
                </h2>
                <H3>The strict boundary</H3>
                <P>
                  Large language models on INCH <strong className="text-foreground">never</strong>{" "}
                  invent stored arguments by themselves,{" "}
                  <strong className="text-foreground">never</strong> edit an argument after
                  submission, and <strong className="text-foreground">never</strong> assign or
                  change evaluation labels. Structural truth in the debate graph is always under
                  user control at submission time and engine control at evaluation time.
                </P>
                <H3>Text variants at creation</H3>
                <P>
                  When you have fixed a scheme and variable values, you may ask the system for three
                  neutral phrasings of the same structured content. You must <em>choose</em> one
                  variant; only that choice, tied to a short-lived preview token, can be submitted.
                  The LLM does not pick the winner — you do.
                </P>
                <H3>Scheme suggestion from free text</H3>
                <P>
                  You can describe your intent in natural language and receive ranked scheme
                  suggestions with optional variable prefills. That narrows the search space; you
                  still confirm the scheme, complete any missing variables, and pass validation
                  before any argument exists in the database.
                </P>
                <H3>Rendering and path dialogue</H3>
                <P>
                  The platform may call an LLM to read back stored argument text in smoother prose (
                  <code className="rounded bg-muted px-1 font-mono text-sm">/render</code>) or to
                  script a dialogue along a path between arguments on the same ancestor chain. Those
                  features display what is already structurally committed — they do not alter
                  statuses or graph membership.
                </P>
                <H3>Why the boundaries matter</H3>
                <P>
                  Keeping generation and evaluation separate preserves{" "}
                  <strong className="text-foreground">user agency</strong> (you choose what enters
                  the graph) and <strong className="text-foreground">evaluation integrity</strong>{" "}
                  (labels come only from the deterministic semantics engine). Auditors can trust
                  that the attack structure they see is what drove the labels — not a model’s hidden
                  opinion.
                </P>
              </section>

              <SectionRule />

              <section id="creating-an-argument" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  Creating an argument on INCH
                </h2>
                <H3>Step by step</H3>
                <ol className="mt-4 list-decimal space-y-3 pl-6 text-muted-foreground marker:text-foreground">
                  <li>
                    Open a <strong className="text-foreground">subtopic</strong> where you want to
                    start a thread.
                  </li>
                  <li>
                    Choose an <strong className="text-foreground">argumentation scheme</strong> from
                    those active for initial arguments (or use suggestion, then confirm).
                  </li>
                  <li>
                    Fill every <strong className="text-foreground">variable</strong> field required
                    by the scheme; values are validated against types.
                  </li>
                  <li>
                    Generate optional <strong className="text-foreground">text variants</strong>,
                    then select the phrasing you want stored.
                  </li>
                  <li>
                    <strong className="text-foreground">Submit</strong>. The server creates the
                    argument node attached to the subtopic and enqueues evaluation.
                  </li>
                </ol>
                <H3>After submission</H3>
                <P>
                  The new argument appears in the subtopic list and graph. The evaluation worker
                  updates statuses for arguments in that graph; your node and others may show new{" "}
                  <code className="rounded bg-muted px-1 font-mono text-sm">in</code> /{" "}
                  <code className="rounded bg-muted px-1 font-mono text-sm">out</code> /{" "}
                  <code className="rounded bg-muted px-1 font-mono text-sm">undecided</code> labels
                  when processing completes.
                </P>
              </section>

              <DiagramPlaceholder
                label="Placeholder — initial argument creation UI"
                caption="Screens or panels from the initial-argument drawer: scheme selection, variable form, and text-option choice, in order."
              />

              <SectionRule />

              <section id="creating-a-counter-argument" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  Creating a counter-argument
                </h2>
                <H3>Step by step</H3>
                <ol className="mt-4 list-decimal space-y-3 pl-6 text-muted-foreground marker:text-foreground">
                  <li>
                    Open the <strong className="text-foreground">target argument</strong> you want
                    to attack and start a counter from its view.
                  </li>
                  <li>
                    Select a <strong className="text-foreground">critical question</strong> that
                    your counter will answer.
                  </li>
                  <li>
                    Pick a permitted <strong className="text-foreground">response scheme</strong>{" "}
                    for that CQ.
                  </li>
                  <li>
                    Fill the scheme’s <strong className="text-foreground">variables</strong>.
                  </li>
                  <li>
                    Generate and choose <strong className="text-foreground">text variants</strong>{" "}
                    as for initial arguments, then{" "}
                    <strong className="text-foreground">submit</strong>.
                  </li>
                </ol>
                <H3>How the CQ links the attack</H3>
                <P>
                  Your choice of CQ is stored with the counter so readers (and the system) know
                  which line of challenge you are pursuing. The response scheme must be one allowed
                  for that CQ, which keeps counter-arguments aligned with argumentation-theoretic
                  structure rather than free-floating rebuttal text.
                </P>
              </section>

              <DiagramPlaceholder
                label="Placeholder — counter-argument creation UI"
                caption="Screens or steps from the counter-argument drawer: CQ list, response scheme choice, variables, and text selection."
              />

              <SectionRule />

              <section id="glossary" className="scroll-mt-28">
                <h2 className="mt-16 font-serif text-3xl font-bold tracking-tight text-foreground">
                  Glossary
                </h2>
                <dl className="mt-6 space-y-6 border-t border-border pt-6">
                  <div>
                    <dt className="font-semibold text-foreground">Argumentation scheme</dt>
                    <dd className="mt-1 text-muted-foreground">
                      A named, reusable pattern of reasoning with a conclusion template, typed
                      variables, and (in INCH) an associated set of critical questions.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Critical question</dt>
                    <dd className="mt-1 text-muted-foreground">
                      A standard test question tied to a scheme; choosing one when countering
                      constrains which response schemes may be used and records the rationale for
                      the attack.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Initial argument</dt>
                    <dd className="mt-1 text-muted-foreground">
                      An argument whose parent is a subtopic — it starts a new thread in that
                      subtopic’s graph.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Counter-argument</dt>
                    <dd className="mt-1 text-muted-foreground">
                      An argument that attacks a parent argument via a CQ and response scheme,
                      stored as a child in the graph.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Attack</dt>
                    <dd className="mt-1 text-muted-foreground">
                      A directed conflict relation between arguments used by abstract semantics: the
                      child attacks the parent for evaluation purposes.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Argument graph</dt>
                    <dd className="mt-1 text-muted-foreground">
                      The directed graph of arguments (nodes) and attack edges within a subtopic.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Abstract argumentation</dt>
                    <dd className="mt-1 text-muted-foreground">
                      Dung-style modelling that evaluates acceptability using only arguments and an
                      attack relation, without content-based scoring.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Grounded semantics</dt>
                    <dd className="mt-1 text-muted-foreground">
                      A rule that picks a unique extension by iteratively accepting unattacked
                      arguments and rejecting what they attack; INCH uses it to derive statuses.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">
                      <code className="rounded bg-muted px-1 font-mono text-[0.95em]">in</code> /{" "}
                      <code className="rounded bg-muted px-1 font-mono text-[0.95em]">out</code> /{" "}
                      <code className="rounded bg-muted px-1 font-mono text-[0.95em]">
                        undecided
                      </code>
                    </dt>
                    <dd className="mt-1 text-muted-foreground">
                      The three evaluation labels: structurally accepted, structurally rejected, or
                      neither, under grounded semantics on the current attack graph.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">AIF</dt>
                    <dd className="mt-1 text-muted-foreground">
                      The <strong className="text-foreground">Argument Interchange Format</strong> —
                      a family of data models for exchanging argument maps (nodes, edges, schemes)
                      between tools. INCH’s stored graph and scheme metadata are conceptually
                      aligned with that ecosystem even though the wire format may differ.
                    </dd>
                  </div>
                </dl>
              </section>
            </Body>
          </article>
        </div>
      </div>
    </div>
  );
}
