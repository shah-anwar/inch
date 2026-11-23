import { getCriticalQuestion, getSchemeById } from "@inch/types";
import { ExpandableCqValueChip } from "@/components/ExpandableCqValueChip";
import { getCriticalQuestionSegments, type CqSegment } from "@/lib/argumentForm";

function CqTextWithValues({ segments }: { segments: CqSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.content}</span>
        ) : (
          <ExpandableCqValueChip key={i} symbol={seg.symbol} value={seg.value} />
        ),
      )}
    </>
  );
}

export interface CriticalQuestionResolvedProps {
  /** Scheme that owns the critical question (parent scheme when attacking). */
  schemeId: string;
  cqId: string;
  variableValues: { variableId: string; value: string }[];
}

/**
 * Renders CQ template text with parent (or self) variable values substituted for symbols.
 */
export function CriticalQuestionResolved({
  schemeId,
  cqId,
  variableValues,
}: CriticalQuestionResolvedProps) {
  const scheme = getSchemeById(schemeId);
  const cq = getCriticalQuestion(schemeId, cqId);
  if (!cq || !scheme) return null;

  const segments = getCriticalQuestionSegments(
    cq.text,
    scheme.variables.map((v) => ({ id: v.id, name: v.name })),
    variableValues,
  );

  return (
    <p className="text-sm text-foreground leading-relaxed">
      <CqTextWithValues segments={segments} />
    </p>
  );
}
