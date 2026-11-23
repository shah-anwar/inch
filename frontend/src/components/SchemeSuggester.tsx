import type { SchemeSuggestion, SuggestArgumentResponse } from "@inch/types";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";

export interface SchemeSuggesterProps {
  onSelect: (schemeId: string, prefillVariables: Record<string, string>) => void;
  /**
   * When set (e.g. counter-argument valid response schemes), only these ids are
   * offered as “Use this”; other model suggestions are hidden.
   */
  allowedSchemeIds?: string[];
  /** Collapsible header label */
  headerLabel?: string;
  /** Optional helper under the header button */
  description?: string;
}

/**
 * Optional helper panel that sends free-text intent to the backend scheme-suggestion
 * endpoint and lets users prefill the initial argument flow.
 *
 * @param props Callback invoked when a suggestion is chosen.
 * @returns Collapsible suggestion UI with request state and results.
 */
export function SchemeSuggester({
  onSelect,
  allowedSchemeIds,
  headerLabel = "Not sure which scheme to use? Describe your argument.",
  description,
}: SchemeSuggesterProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SchemeSuggestion[]>([]);
  const [placeholderMessage, setPlaceholderMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: { text: string }): Promise<SuggestArgumentResponse> => {
      const { data } = await apiClient.post<SuggestArgumentResponse>("/arguments/suggest", payload);
      return data;
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      if (data.suggestions.length === 0) {
        setPlaceholderMessage(
          "No close match returned. Try rephrasing, or pick a scheme from the list below.",
        );
      } else {
        setPlaceholderMessage(null);
      }
    },
    onError: (error) => {
      const message =
        typeof error === "object" &&
        error != null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error ===
          "string"
          ? String((error as { response?: { data?: { error?: unknown } } }).response?.data?.error)
          : "Could not load suggestions. Pick a scheme from the list below, or try again.";
      setSuggestions([]);
      setPlaceholderMessage(message);
    },
  });

  const allowedSet = useMemo(
    () => (allowedSchemeIds && allowedSchemeIds.length > 0 ? new Set(allowedSchemeIds) : null),
    [allowedSchemeIds],
  );

  const visibleSuggestions = useMemo(() => {
    if (!allowedSet) return suggestions;
    return suggestions.filter((s) => allowedSet.has(s.schemeId));
  }, [suggestions, allowedSet]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (value.length < 10 || value.length > 500) {
      setLocalError("Please describe your argument in 10–500 characters.");
      return;
    }
    setLocalError(null);
    setPlaceholderMessage(null);
    mutation.mutate({ text: value });
  };

  const handleUse = (suggestion: SchemeSuggestion) => {
    onSelect(suggestion.schemeId, suggestion.prefillVariables);
  };

  return (
    <div className="mb-6 rounded-lg border border-dashed border-border bg-muted/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span>{headerLabel}</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Describe the gist of your argument, including key claims and reasons."
            />
            {localError && (
              <p className="text-xs text-destructive" role="alert">
                {localError}
              </p>
            )}
            {placeholderMessage && (
              <p className="text-xs text-muted-foreground" role="status">
                {placeholderMessage}
              </p>
            )}
            {allowedSet && suggestions.length > 0 && visibleSuggestions.length === 0 && (
              <p className="text-xs text-muted-foreground" role="status">
                None of the ranked schemes apply as a valid response to this question. Choose from
                the list below.
              </p>
            )}
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Checking…" : "Suggest"}
            </Button>
          </form>
          {visibleSuggestions.length > 0 && (
            <div className="space-y-2">
              {visibleSuggestions.map((s, i) => (
                <div
                  key={`${s.schemeId}-${i}`}
                  className="rounded-md border border-border bg-background px-3 py-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{s.schemeName}</span>
                    <ConfidenceBadge confidence={s.confidence} />
                  </div>
                  <p className="text-xs text-muted-foreground">{s.reasoning}</p>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="mt-1"
                    onClick={() => handleUse(s)}
                  >
                    Use this
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Visual confidence badge for scheme-suggestion items.
 *
 * @param props Confidence level from backend response.
 * @returns Styled badge text.
 */
function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const label =
    confidence === "high"
      ? "High confidence"
      : confidence === "medium"
        ? "Medium confidence"
        : "Low confidence";

  const className =
    confidence === "high"
      ? "bg-emerald-500/15 text-emerald-500"
      : confidence === "medium"
        ? "bg-amber-500/15 text-amber-500"
        : "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}
