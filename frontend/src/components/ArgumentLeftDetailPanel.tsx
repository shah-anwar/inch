import { getSchemeById, renderArgumentText } from "@inch/types";
import type { ArgumentWithChildrenByStatus } from "@inch/types";
import type { ReactNode, RefObject } from "react";
import { ArgumentDetailBody } from "@/components/ArgumentDetailBody";
import { cn } from "@/lib/utils";

export interface ArgumentLeftDetailPanelProps {
  argument: ArgumentWithChildrenByStatus;
  isSubmittedByUser?: boolean;
  /** Scheme id + values used to resolve CQ placeholders (parent scheme/vars when countering). */
  cqSubstitution?: {
    schemeId: string;
    cqId: string;
    variableValues: { variableId: string; value: string }[];
  } | null;
  /** Subtopic minimap; rendered above the textual detail blocks. */
  graph: ReactNode;
  /** Logged in — opens counter-attack drawer. When false, attack still shows but routes to login. */
  canOpenAttack: boolean;
  attackDrawerOpen: boolean;
  /** Opens drawer when logged in, otherwise should redirect to login. */
  onAttackClick: () => void;
  attackButtonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Left-column argument focus: scrollable graph + detail, with a full-width attack
 * control fixed to the bottom of the column (greyed / disabled while drawer is open).
 */
export function ArgumentLeftDetailPanel({
  argument,
  isSubmittedByUser = false,
  cqSubstitution,
  graph,
  canOpenAttack,
  attackDrawerOpen,
  onAttackClick,
  attackButtonRef,
}: ArgumentLeftDetailPanelProps) {
  const scheme = getSchemeById(argument.schemeId);
  const argumentBody =
    argument.argumentText?.trim() ||
    (scheme
      ? renderArgumentText(
          scheme.conclusion,
          (argument.variables ?? []).map((v) => ({
            variableId: v.variableId,
            value: v.value,
          })),
        )
      : "");

  const isAttacking = canOpenAttack && attackDrawerOpen;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-6 pb-4">
          {graph != null ? <div className="w-full max-w-full">{graph}</div> : null}
          {isSubmittedByUser ? (
            <div className="rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
              You submitted this
            </div>
          ) : null}

          <ArgumentDetailBody argument={argument} cqSubstitution={cqSubstitution} />
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          ref={attackButtonRef}
          disabled={isAttacking}
          onClick={() => {
            if (isAttacking) return;
            onAttackClick();
          }}
          className={cn(
            "w-full py-2 px-4 rounded-md border-2 text-sm font-semibold transition-colors",
            isAttacking &&
              "border-border bg-muted text-muted-foreground cursor-not-allowed opacity-80",
            !isAttacking &&
              canOpenAttack &&
              "border-red-500 text-red-500 hover:bg-red-500 hover:text-white",
            !isAttacking &&
              !canOpenAttack &&
              "border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
          aria-label={
            isAttacking
              ? "Counter-attack in progress — close with the drawer control"
              : canOpenAttack
                ? `Attack argument: ${(argumentBody || "").slice(0, 60)}`
                : "Sign in to attack this argument"
          }
        >
          {isAttacking ? "ATTACKING" : "Attack"}
        </button>
        {!canOpenAttack && !isAttacking ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Sign in to start a counter-argument
          </p>
        ) : null}
      </div>
    </div>
  );
}
