import type { HomeArgumentSummary, PlatformStats } from "@inch/types";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useHomeArgumentLists } from "@/hooks/useApi";
import { formatListDate } from "@/lib/formatListDate";
import { setPageTitle } from "@/lib/pageTitle";
import { requestNavbarSearchExpandAndFocus } from "@/lib/requestNavbarSearch";
import { cn } from "@/lib/utils";

const colSep = "border-l border-border";
const headerColSep = "border-l border-purple-800/70";
const headerCell =
  "px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-purple-100/95";

function HomeArgumentTable({
  rows,
  variant,
}: {
  rows: HomeArgumentSummary[];
  variant: "topInitial" | "recent";
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        No arguments yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
        {variant === "topInitial" ? (
          <colgroup>
            <col className="min-w-0" style={{ width: "68%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "22%" }} />
          </colgroup>
        ) : (
          <colgroup>
            <col className="min-w-0" style={{ width: "58%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
        )}
        <thead>
          <tr className="border-b border-purple-900/50 bg-purple-950">
            <th className={headerCell}>Argument</th>
            {variant === "topInitial" ? (
              <th className={`${headerCell} text-right ${headerColSep}`}>Descendants</th>
            ) : (
              <>
                <th className={`${headerCell} ${headerColSep}`}>Created</th>
                <th className={`${headerCell} ${headerColSep}`}>Type</th>
              </>
            )}
            <th className={`${headerCell} ${headerColSep}`}>Topic / subtopic</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${variant}-${row.id}`}
              className={cn(
                "border-b border-border last:border-b-0",
                index % 2 === 0 ? "bg-muted/15" : "bg-background",
              )}
            >
              <td className="min-w-0 px-3 py-2.5 align-top">
                <Link
                  to={`/arg/${row.id}`}
                  className="block font-medium leading-snug text-foreground [overflow-wrap:anywhere] hover:underline"
                >
                  {row.argumentText.trim()}
                </Link>
              </td>
              {variant === "topInitial" ? (
                <td
                  className={`px-3 py-2.5 text-right align-top tabular-nums text-muted-foreground ${colSep}`}
                >
                  {row.descendantCount}
                </td>
              ) : (
                <>
                  <td className={`px-3 py-2.5 align-top text-xs text-muted-foreground ${colSep}`}>
                    {formatListDate(row.createdAt)}
                  </td>
                  <td className={`px-3 py-2.5 align-top text-xs text-muted-foreground ${colSep}`}>
                    {row.isInitial ? "Initial" : "Counter"}
                  </td>
                </>
              )}
              <td
                className={`min-w-0 px-3 py-2.5 align-top text-xs leading-snug text-muted-foreground ${colSep}`}
              >
                <Link
                  to={`/topics/${row.topicId}`}
                  className="[overflow-wrap:anywhere] hover:text-foreground hover:underline"
                >
                  {row.topicTitle}
                </Link>
                <span className="text-muted-foreground/80"> · </span>
                <Link
                  to={`/topics/${row.topicId}/${row.subtopicId}`}
                  className="[overflow-wrap:anywhere] hover:text-foreground hover:underline"
                >
                  {row.subtopicTitle}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatInnerCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border border-border/90 bg-background/60 p-4 shadow-sm backdrop-blur-sm sm:p-5",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
        {value.toLocaleString()}
      </p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatusChipCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "in" | "out" | "undecided";
}) {
  const toneClass =
    tone === "in"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : tone === "out"
        ? "border-rose-500/30 bg-rose-500/10"
        : "border-amber-500/30 bg-amber-500/10";

  const valueClass =
    tone === "in"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "out"
        ? "text-rose-700 dark:text-rose-400"
        : "text-amber-800 dark:text-amber-400";

  return (
    <div className={cn("rounded-xl border p-4 text-center shadow-sm sm:p-5", toneClass)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl", valueClass)}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function HomePlatformStatsBlurb({ stats }: { stats: PlatformStats }) {
  const userWord = stats.registeredUsers === 1 ? "person" : "people";
  const argWord = stats.totalArguments === 1 ? "argument" : "arguments";

  return (
    <section className="mt-12 rounded-2xl border border-border bg-gradient-to-b from-card to-card/80 p-6 shadow-md sm:p-8">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Live snapshot
        </p>
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          The platform at a glance
        </h2>
      </header>

      <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatInnerCard
          label="Registered users"
          value={stats.registeredUsers}
          hint={`${userWord} with an account.`}
        />
        <StatInnerCard
          label="Total arguments"
          value={stats.totalArguments}
          hint={`${argWord} in the graph.`}
        />
      </div>

      <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Evaluation status
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/90">
              IN / OUT / UNDECIDED from automated labelling
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatusChipCard label="In" value={stats.argumentsIn} tone="in" />
          <StatusChipCard label="Out" value={stats.argumentsOut} tone="out" />
          <StatusChipCard label="Undecided" value={stats.argumentsUndecided} tone="undecided" />
        </div>
      </div>
    </section>
  );
}

/** Landing page with entry points into topics and search. */
export default function HomePage() {
  const { data, isLoading, isError } = useHomeArgumentLists();

  useEffect(() => {
    setPageTitle("Home");
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto max-w-[min(100%,88rem)] px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">INCH</h1>
        <p className="mt-4 max-w-4xl text-lg text-muted-foreground">
          Explore debates by topic, follow inference chains between arguments, and respond with
          counter-arguments where the discussion allows.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link to="/topics">Browse topics</Link>
          </Button>
          <Button
            asChild
            className="bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500/40 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Link to="/learn">Learn INCH</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => requestNavbarSearchExpandAndFocus()}
          >
            Search
          </Button>
        </div>

        {isLoading ? (
          <p className="mt-12 text-sm text-muted-foreground">Loading…</p>
        ) : isError ? (
          <p className="mt-12 text-sm text-destructive">Could not load home content.</p>
        ) : data ? (
          <>
            <HomePlatformStatsBlurb stats={data.platformStats} />
            <div className="mt-14 space-y-10">
              <section>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Top initial arguments by descendant count
                </h2>
                <HomeArgumentTable variant="topInitial" rows={data.topInitialByDescendants} />
              </section>

              <section>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Most recent arguments
                </h2>
                <HomeArgumentTable variant="recent" rows={data.recent} />
              </section>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
