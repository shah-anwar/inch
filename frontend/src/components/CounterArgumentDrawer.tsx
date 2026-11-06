import { zodResolver } from "@hookform/resolvers/zod";
import { getSchemeById, renderArgumentText } from "@inch/types";
import type {
  ArgumentWithChildrenByStatus,
  GeneratedTextOption,
  CriticalQuestion,
  Scheme,
} from "@inch/types";
import { Loader2, Swords, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router-dom";
import { ExpandableCqValueChip } from "@/components/ExpandableCqValueChip";
import { SchemeSuggester } from "@/components/SchemeSuggester";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  ModerationFailedClientError,
  useCreateCounterArgument,
  useGenerateArgumentText,
  useReleaseArgumentTextPreview,
  useVisibleCriticalQuestions,
  useVisibleResponseSchemes,
  useInitialArgumentSchemes,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import {
  buildVariableSchema,
  getCriticalQuestionSegments,
  type CqSegment,
} from "@/lib/argumentForm";
import { cn } from "@/lib/utils";

const DRAWER_STORAGE_KEY = "INCH.counter-argument-drawer-width";
const DEFAULT_WIDTH = 448;
const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

/**
 * Restores the persisted counter-drawer width from local storage.
 *
 * @returns Clamped drawer width in pixels, or the default width on parse failure.
 */
function loadDrawerWidth(): number {
  try {
    const raw = localStorage.getItem(DRAWER_STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const parsed = JSON.parse(raw) as { width?: number };
    const width = parsed.width ?? DEFAULT_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
  } catch {
    return DEFAULT_WIDTH;
  }
}

/**
 * Persists the current counter-drawer width.
 *
 * @param width Drawer width in pixels.
 * @returns Nothing.
 */
function saveDrawerWidth(width: number) {
  try {
    localStorage.setItem(DRAWER_STORAGE_KEY, JSON.stringify({ width }));
  } catch {
    /* ignore */
  }
}

type Step = "select_cq" | "select_scheme" | "fill_variables" | "choose_text";
type VariableFormValues = Record<string, string | undefined>;

/** Props for driving counter-argument drawer state around a parent argument. */
export interface CounterArgumentDrawerProps {
  parentArgument: ArgumentWithChildrenByStatus;
  open: boolean;
  onClose: () => void;
  onSuccess: (newArgumentId: string) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Multi-step drawer for composing a counter-argument:
 * critical question selection, response scheme selection, variable completion,
 * generated text choice, and final submission.
 *
 * Side effects:
 * - Uses text preview and counter submission API mutations.
 * - Persists drawer width preference.
 * - Releases preview tokens when the flow is cancelled or reset.
 *
 * @param props Parent argument context plus drawer controls.
 * @returns Drawer UI or `null` when closed.
 */
export function CounterArgumentDrawer({
  parentArgument,
  open,
  onClose,
  onSuccess,
  triggerRef,
}: CounterArgumentDrawerProps) {
  const { token } = useAuth();
  const location = useLocation();
  const mutation = useCreateCounterArgument();
  const textMutation = useGenerateArgumentText();
  const releasePreviewMutation = useReleaseArgumentTextPreview();
  const [step, setStep] = useState<Step>("select_cq");
  const [selectedCqId, setSelectedCqId] = useState<string | null>(null);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<VariableFormValues | null>(null);
  const [textOptions, setTextOptions] = useState<GeneratedTextOption[]>([]);
  const [textPreviewToken, setTextPreviewToken] = useState<string | null>(null);
  const [moderationByField, setModerationByField] = useState<Record<string, string>>({});
  const [moderationGeneralError, setModerationGeneralError] = useState<string | null>(null);
  const { data: initialSchemes = [] } = useInitialArgumentSchemes();
  const { data: visibleCriticalQuestions = [] } = useVisibleCriticalQuestions(parentArgument.id);
  const { data: visibleResponseSchemes = [] } = useVisibleResponseSchemes(
    parentArgument.id,
    selectedCqId,
  );

  const [panelWidth, setPanelWidth] = useState<number>(() =>
    typeof window !== "undefined" ? loadDrawerWidth() : DEFAULT_WIDTH,
  );

  const parentScheme = getSchemeById(parentArgument.schemeId);
  const parentText = parentScheme
    ? parentArgument.argumentText ||
      renderArgumentText(
        parentScheme.conclusion,
        parentArgument.variables.map((v) => ({
          variableId: v.variableId,
          value: v.value,
        })),
      )
    : "";

  const selectedScheme =
    selectedSchemeId != null
      ? (visibleResponseSchemes.find((scheme) => scheme.id === selectedSchemeId) ?? null)
      : null;
  const variableSchema = selectedScheme
    ? buildVariableSchema(selectedScheme.variables.map((v) => ({ id: v.id, required: v.required })))
    : null;
  const defaultValues: VariableFormValues = selectedScheme
    ? Object.fromEntries(selectedScheme.variables.map((v) => [v.id, ""]))
    : {};

  const {
    register,
    trigger,
    getValues,
    formState: { errors },
    reset,
  } = useForm<VariableFormValues>({
    resolver: variableSchema ? (zodResolver(variableSchema) as never) : undefined,
    defaultValues,
  });

  useEffect(() => {
    if (!open) {
      setStep("select_cq");
      setSelectedCqId(null);
      setSelectedSchemeId(null);
      setDraftValues(null);
      setTextOptions([]);
      setTextPreviewToken(null);
      setModerationByField({});
      setModerationGeneralError(null);
      reset({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when drawer closes
  }, [open]);

  useEffect(() => {
    if (open && !token) {
      onClose();
    }
  }, [open, token, onClose]);

  const stepLabels: Record<Step, string> = {
    select_cq: "Step 1 of 3 — Select question",
    select_scheme: "Step 2 of 4 — Select scheme",
    fill_variables: "Step 3 of 4 — Fill in details",
    choose_text: "Step 4 of 4 — Choose text",
  };

  const response =
    mutation.isError && mutation.error && "response" in mutation.error
      ? (mutation.error as { response?: { status?: number; data?: { error?: unknown } } }).response
      : null;
  const is401 = response?.status === 401;
  const rawError = response?.data?.error ?? null;
  const apiError = is401
    ? "Your session has expired. Please log in again."
    : typeof rawError === "string"
      ? rawError
      : Array.isArray(rawError) &&
          rawError[0] &&
          typeof rawError[0] === "object" &&
          "message" in rawError[0]
        ? String((rawError[0] as { message?: string }).message ?? "Validation failed")
        : rawError != null
          ? "Something went wrong"
          : null;

  if (!open) return null;

  const handleClose = () => {
    if (textPreviewToken) {
      releasePreviewMutation.mutate({ previewToken: textPreviewToken });
    }
    onClose();
    if (triggerRef?.current) {
      triggerRef.current.focus();
    }
  };

  const handleSelectResponseScheme = (
    schemeId: string,
    prefillVariables: Record<string, string> | null = null,
  ) => {
    setSelectedSchemeId(schemeId);
    setDraftValues(null);
    setTextOptions([]);
    if (textPreviewToken) {
      releasePreviewMutation.mutate({ previewToken: textPreviewToken });
    }
    setTextPreviewToken(null);
    setModerationByField({});
    setModerationGeneralError(null);
    setStep("fill_variables");

    const scheme = initialSchemes.find((candidate) => candidate.id === schemeId);
    if (!scheme) {
      reset({});
      return;
    }
    const values: VariableFormValues = {};
    scheme.variables.forEach((variable) => {
      values[variable.id] =
        prefillVariables != null && variable.id in prefillVariables
          ? prefillVariables[variable.id]
          : "";
    });
    reset(values);
  };

  const handleGenerateText = async () => {
    if (selectedCqId == null || selectedSchemeId == null) return;
    const isValid = await trigger();
    if (!isValid) return;

    const formValues = getValues();
    const variables = Object.entries(formValues).map(([variableId, value]) => ({
      variableId,
      value: value ?? "",
    }));

    setModerationByField({});
    setModerationGeneralError(null);

    textMutation.mutate(
      {
        kind: "counter",
        parentArgumentId: parentArgument.id,
        selectedCqId,
        schemeId: selectedSchemeId,
        variables,
      },
      {
        onSuccess: (result) => {
          setDraftValues(formValues);
          setTextPreviewToken(result.previewToken);
          setTextOptions(result.options);
          setStep("choose_text");
        },
        onError: (err) => {
          if (err instanceof ModerationFailedClientError && selectedScheme != null) {
            const next: Record<string, string> = {};
            const unmatched: string[] = [];
            const ids = new Set(selectedScheme.variables.map((v) => v.id));
            for (const v of err.violations) {
              if (ids.has(v.variableId)) {
                next[v.variableId] = v.reason;
              } else {
                unmatched.push(`${v.variableId}: ${v.reason}`);
              }
            }
            setModerationByField(next);
            setModerationGeneralError(unmatched.length > 0 ? unmatched.join(" ") : null);
          }
        },
      },
    );
  };

  const handleSubmitSelectedText = (option: GeneratedTextOption) => {
    if (selectedCqId == null || selectedSchemeId == null || !draftValues || !textPreviewToken)
      return;
    mutation.mutate(
      {
        parentArgumentId: parentArgument.id,
        selectedCqId,
        schemeId: selectedSchemeId,
        textPreviewToken,
        selectedOptionId: option.id,
        variables: Object.entries(draftValues).map(([variableId, value]) => ({
          variableId,
          value: value ?? "",
        })),
      },
      {
        onSuccess: (newArgument) => {
          onSuccess(newArgument.id);
        },
        onError: () => {},
      },
    );
  };

  const onResizeWidthPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = startX - moveEvent.clientX;
      const nextWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + dx));
      setPanelWidth(nextWidth);
    };

    const handleUp = () => {
      saveDrawerWidth(panelWidth);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const clearModerationFor = (variableId: string) => {
    setModerationByField((prev) => {
      if (!(variableId in prev)) return prev;
      const next = { ...prev };
      delete next[variableId];
      return next;
    });
    setModerationGeneralError(null);
  };

  return (
    <div
      className="fixed right-0 top-0 z-50 flex h-full flex-col border-l bg-background shadow-lg"
      role="dialog"
      aria-modal={false}
      aria-labelledby="counter-argument-drawer-title"
      style={{
        width: panelWidth,
      }}
    >
      {/* Resize: left edge (width) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize border-l-2 border-transparent hover:border-primary/50 hover:bg-primary/5"
        style={{ touchAction: "none" }}
        onPointerDown={onResizeWidthPointerDown}
        aria-hidden
      />
      <div className="flex flex-shrink-0 items-center justify-between border-b p-4">
        <h2 id="counter-argument-drawer-title" className="text-lg font-semibold">
          Attack Argument
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClose}
          aria-label="Close attack drawer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <>
          <p
            className="mb-4 text-xs font-medium text-muted-foreground uppercase tracking-wide"
            aria-live="polite"
          >
            {stepLabels[step]}
          </p>

          {step === "select_cq" && (
            <StepSelectCq
              parentScheme={parentScheme}
              parentArgument={parentArgument}
              parentText={parentText}
              parentSchemeName={parentScheme?.name ?? parentArgument.schemeId}
              criticalQuestions={visibleCriticalQuestions}
              onSelectCq={(cqId) => {
                setSelectedCqId(cqId);
                setStep("select_scheme");
              }}
            />
          )}

          {step === "select_scheme" && selectedCqId && (
            <StepSelectScheme
              parentArgument={parentArgument}
              parentSchemeId={parentArgument.schemeId}
              selectedCqId={selectedCqId}
              criticalQuestions={visibleCriticalQuestions}
              validSchemes={visibleResponseSchemes}
              onSelectScheme={handleSelectResponseScheme}
              onBack={() => {
                setSelectedCqId(null);
                setStep("select_cq");
              }}
            />
          )}

          {step === "fill_variables" && selectedSchemeId && selectedScheme && (
            <form className="flex flex-col gap-6">
              {/* 1. Targeted argument */}
              <section className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Targeted argument
                </p>
                <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                  <p className="font-medium text-muted-foreground">
                    {parentScheme?.name ?? parentArgument.schemeId}
                  </p>
                  <p className="mt-1 text-foreground">{parentText}</p>
                </div>
              </section>

              {/* 2. Selected critical question */}
              {selectedCqId && parentScheme && (
                <section className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Critical question
                  </p>
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    {(() => {
                      const cq =
                        visibleCriticalQuestions.find(
                          (criticalQuestion) => criticalQuestion.id === selectedCqId,
                        ) ?? null;
                      if (!cq) return null;
                      const schemeVars = parentScheme.variables.map((v) => ({
                        id: v.id,
                        name: v.name,
                      }));
                      const parentValues = parentArgument.variables.map((v) => ({
                        variableId: v.variableId,
                        value: v.value,
                      }));
                      const segments = getCriticalQuestionSegments(
                        cq.text,
                        schemeVars,
                        parentValues,
                      );
                      return (
                        <p className="font-medium text-foreground">
                          <CqTextWithValues segments={segments} />
                        </p>
                      );
                    })()}
                  </div>
                </section>
              )}

              {/* 3. Scheme description */}
              <section className="space-y-1 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Scheme description
                </p>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                  <p className="font-medium">{selectedScheme.name}</p>
                  <p className="text-muted-foreground">{selectedScheme.description}</p>
                </div>
              </section>

              {/* 4. Enter variables */}
              <section className="space-y-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Enter counter-argument details
                </p>
                <FieldGroup>
                  {selectedScheme.variables.map((variable) => {
                    const modMsg = moderationByField[variable.id];
                    const reg = register(variable.id, {
                      onChange: () => {
                        clearModerationFor(variable.id);
                      },
                    });
                    return (
                      <Field key={variable.id}>
                        <FieldLabel htmlFor={`counter-variable-${variable.id}`}>
                          {variable.name}
                          {variable.required && <span className="text-destructive"> *</span>}
                        </FieldLabel>
                        <textarea
                          id={`counter-variable-${variable.id}`}
                          {...reg}
                          placeholder={variable.placeholder}
                          rows={3}
                          className={cn(
                            "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
                            "placeholder:text-muted-foreground",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            "aria-invalid:border-destructive",
                            "resize-y min-h-[2.5rem] max-h-40",
                          )}
                          aria-invalid={!!errors[variable.id] || !!modMsg}
                          aria-required={variable.required ? true : undefined}
                          aria-describedby={
                            errors[variable.id] || modMsg
                              ? `counter-variable-${variable.id}-error`
                              : undefined
                          }
                        />
                        <FieldDescription>{variable.description}</FieldDescription>
                        <FieldError
                          id={`counter-variable-${variable.id}-error`}
                          errors={errors[variable.id] ? [errors[variable.id]] : undefined}
                        />
                        {modMsg && (
                          <p role="alert" className="text-sm text-destructive">
                            {modMsg}
                          </p>
                        )}
                      </Field>
                    );
                  })}
                </FieldGroup>
              </section>
              {moderationGeneralError && (
                <p role="alert" className="text-sm text-destructive">
                  {moderationGeneralError}
                </p>
              )}
              {apiError && (
                <div role="alert" className="space-y-2 text-sm text-destructive">
                  <p>{apiError}</p>
                  {is401 && (
                    <Link
                      to="/login"
                      state={{ from: location }}
                      className="font-medium text-primary hover:underline"
                    >
                      Log in again
                    </Link>
                  )}
                </div>
              )}
              {textMutation.isError &&
                !(textMutation.error instanceof ModerationFailedClientError) && (
                  <p role="alert" className="text-sm text-destructive">
                    Unable to generate text options.
                  </p>
                )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setSelectedSchemeId(null);
                    setStep("select_scheme");
                  }}
                >
                  ← Back
                </Button>
                <Button
                  type="button"
                  disabled={textMutation.isPending}
                  onClick={handleGenerateText}
                >
                  {textMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    "Generate Counter-Argument Text"
                  )}
                </Button>
              </div>
            </form>
          )}
          {step === "choose_text" && selectedScheme && (
            <div className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (textPreviewToken) {
                      releasePreviewMutation.mutate({ previewToken: textPreviewToken });
                    }
                    setStep("fill_variables");
                    setTextPreviewToken(null);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  ← Back to variables
                </button>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose the version that best continues the exchange with the attacked argument.
                </p>
              </div>
              <div className="space-y-3">
                {textOptions.map((option) => (
                  <div key={option.id} className="rounded-lg border p-4">
                    <p className="text-sm leading-relaxed">{option.text}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      disabled={mutation.isPending}
                      onClick={() => handleSubmitSelectedText(option)}
                    >
                      {mutation.isPending ? "Submitting…" : "Use this text"}
                    </Button>
                  </div>
                ))}
              </div>
              {apiError && (
                <div role="alert" className="space-y-2 text-sm text-destructive">
                  <p>{apiError}</p>
                  {is401 && (
                    <Link
                      to="/login"
                      state={{ from: location }}
                      className="font-medium text-primary hover:underline"
                    >
                      Log in again
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      </div>
    </div>
  );
}

/**
 * Renders mixed CQ text/value segments after symbol substitution.
 *
 * @param props Segment list returned by `getCriticalQuestionSegments`.
 * @returns Fragment with plain text and inline value badges.
 */
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

/**
 * Step 1 UI for choosing a critical question that attacks the parent argument.
 *
 * @param props Parent argument metadata and selection callback.
 * @returns Critical-question selection step UI.
 */
function StepSelectCq({
  parentScheme,
  parentArgument,
  parentText,
  parentSchemeName,
  criticalQuestions,
  onSelectCq,
}: {
  parentScheme: ReturnType<typeof getSchemeById>;
  parentArgument: ArgumentWithChildrenByStatus;
  parentText: string;
  parentSchemeName: string;
  criticalQuestions: CriticalQuestion[];
  onSelectCq: (cqId: string) => void;
}) {
  if (!parentScheme) {
    return <p className="text-muted-foreground">Scheme not found.</p>;
  }
  const schemeVars = parentScheme.variables.map((v) => ({ id: v.id, name: v.name }));
  const parentValues = parentArgument.variables.map((v) => ({
    variableId: v.variableId,
    value: v.value,
  }));
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">You are attacking:</p>
      <div className="rounded-lg border bg-muted/50 p-3 text-sm">
        <p className="font-medium text-muted-foreground">{parentSchemeName}</p>
        <p className="mt-1 text-foreground">{parentText}</p>
      </div>
      <p className="text-sm font-medium">Select a critical question to raise:</p>
      <ul className="space-y-3">
        {criticalQuestions.map((cq) => {
          const segments = getCriticalQuestionSegments(cq.text, schemeVars, parentValues);
          return (
            <li key={cq.id} className="rounded-lg border p-4 shadow-sm">
              <p className="font-medium">
                <CqTextWithValues segments={segments} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{cq.description}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => onSelectCq(cq.id)}
              >
                <Swords className="mr-1.5 h-3.5 w-3.5" />
                Raise this question
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Splits a variable name into a display base label and optional symbol suffix.
 *
 * @param name Variable display name (for example `"Action (A)"`).
 * @returns Parsed base label and symbol when present.
 */
function symbolFromVariableNameLocal(name: string): { base: string; symbol: string | null } {
  const m = name.match(/^(.*)\(([^)]+)\)\s*$/);
  if (!m) return { base: name, symbol: null };
  return { base: m[1].trim(), symbol: m[2].trim() };
}

/**
 * Step 2 UI for selecting a valid response scheme for the chosen critical question.
 *
 * @param props Parent argument context, selected CQ, and navigation callbacks.
 * @returns Response-scheme selection step UI.
 */
function StepSelectScheme({
  parentArgument,
  parentSchemeId,
  selectedCqId,
  criticalQuestions,
  validSchemes,
  onSelectScheme,
  onBack,
}: {
  parentArgument: ArgumentWithChildrenByStatus;
  parentSchemeId: string;
  selectedCqId: string;
  criticalQuestions: CriticalQuestion[];
  validSchemes: Scheme[];
  onSelectScheme: (schemeId: string, prefillVariables?: Record<string, string> | null) => void;
  onBack: () => void;
}) {
  const [expandedSchemeId, setExpandedSchemeId] = useState<string | null>(null);
  const cq = criticalQuestions.find((criticalQuestion) => criticalQuestion.id === selectedCqId);
  const parentScheme = getSchemeById(parentSchemeId);
  const schemeVars = parentScheme?.variables.map((v) => ({ id: v.id, name: v.name })) ?? [];
  const parentValues = parentArgument.variables.map((v) => ({
    variableId: v.variableId,
    value: v.value,
  }));
  const cqSegments =
    cq && schemeVars.length > 0
      ? getCriticalQuestionSegments(cq.text, schemeVars, parentValues)
      : [];

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">
        Now build your counter-argument using one of these schemes:
      </p>
      {cq && (
        <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium text-foreground">
            {cqSegments.length > 0 ? <CqTextWithValues segments={cqSegments} /> : cq.text}
          </p>
        </div>
      )}
      <SchemeSuggester
        allowedSchemeIds={validSchemes.map((s) => s.id)}
        headerLabel="Not sure which scheme to use? Describe your counter-argument."
        description="Suggestions only include schemes you can use to respond to the question above."
        onSelect={(schemeId, prefill) => {
          onSelectScheme(schemeId, prefill);
        }}
      />
      <ul className="space-y-3">
        {validSchemes.map((scheme) => {
          const varParts = scheme.variables.map((v) => symbolFromVariableNameLocal(v.name));
          const isExpanded = expandedSchemeId === scheme.id;
          return (
            <li key={scheme.id} className="rounded-lg border p-4 shadow-sm">
              <h3 className="font-medium">{scheme.name}</h3>
              <p
                className={cn(
                  "mt-1 text-sm text-muted-foreground cursor-pointer",
                  isExpanded ? "" : "line-clamp-2",
                )}
                onClick={() =>
                  setExpandedSchemeId((prev) => (prev === scheme.id ? null : scheme.id))
                }
                title={scheme.description}
              >
                {scheme.description}
              </p>
              {varParts.length > 0 && (
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {varParts.map((p, idx) => (
                    <div key={idx} className="flex items-baseline gap-1">
                      <dt className="font-mono text-foreground">{p.symbol ?? p.base}:</dt>
                      <dd>{p.base}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => onSelectScheme(scheme.id, null)}
              >
                Use this scheme
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          ← Back
        </Button>
      </div>
    </div>
  );
}
