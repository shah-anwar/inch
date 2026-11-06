import { zodResolver } from "@hookform/resolvers/zod";
import type { GeneratedTextOption, Scheme } from "@inch/types";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router-dom";
import { SchemeSuggester } from "@/components/SchemeSuggester";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ModerationFailedClientError,
  useCreateInitialArgument,
  useGenerateArgumentText,
  useInitialArgumentSchemes,
  useReleaseArgumentTextPreview,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { buildVariableSchema, conclusionPreview } from "@/lib/argumentForm";
import { cn } from "@/lib/utils";

type VariableFormValues = Record<string, string | undefined>;
type Step = "select_scheme" | "fill_variables" | "choose_text";

/** Props for controlling initial-argument drawer visibility and completion. */
export interface InitialArgumentDrawerProps {
  subtopicId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: (newArgumentId: string) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Multi-step drawer for creating an initial argument:
 * scheme selection, variable entry, generated text choice, and submission.
 *
 * Side effects:
 * - Calls backend text-preview and submission endpoints.
 * - Releases preview tokens when the flow is cancelled or reset.
 * - Restores focus to the trigger element on close.
 *
 * @param props Drawer state, subtopic target, and success callbacks.
 * @returns Drawer UI or `null` when closed.
 */
export function InitialArgumentDrawer({
  subtopicId,
  open,
  onClose,
  onSuccess,
  triggerRef,
}: InitialArgumentDrawerProps) {
  const { token } = useAuth();
  const location = useLocation();
  const { data: schemes = [] } = useInitialArgumentSchemes();
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("select_scheme");
  const [draftValues, setDraftValues] = useState<VariableFormValues | null>(null);
  const [textOptions, setTextOptions] = useState<GeneratedTextOption[]>([]);
  const [textPreviewToken, setTextPreviewToken] = useState<string | null>(null);
  const [moderationByField, setModerationByField] = useState<Record<string, string>>({});
  const [moderationGeneralError, setModerationGeneralError] = useState<string | null>(null);
  const mutation = useCreateInitialArgument();
  const textMutation = useGenerateArgumentText();
  const releasePreviewMutation = useReleaseArgumentTextPreview();

  const selectedScheme = selectedSchemeId
    ? (schemes.find((scheme) => scheme.id === selectedSchemeId) ?? null)
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

  const handleSelectScheme = (
    schemeId: string,
    prefillVariables: Record<string, string> | null = null,
  ) => {
    setSelectedSchemeId(schemeId);
    setStep("fill_variables");
    setDraftValues(null);
    setTextOptions([]);
    setTextPreviewToken(null);
    setModerationByField({});
    setModerationGeneralError(null);
    const scheme = schemes.find((candidate) => candidate.id === schemeId);
    if (!scheme) {
      reset({});
      return;
    }
    const values: VariableFormValues = {};
    scheme.variables.forEach((variable) => {
      const value =
        prefillVariables != null && variable.id in prefillVariables
          ? prefillVariables[variable.id]
          : "";
      values[variable.id] = value;
    });
    reset(values);
  };

  useEffect(() => {
    if (!open) {
      setStep("select_scheme");
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

  const handleClose = () => {
    if (textPreviewToken) {
      releasePreviewMutation.mutate({ previewToken: textPreviewToken });
    }
    onClose();
    if (triggerRef?.current) {
      triggerRef.current.focus();
    }
  };

  const handleChangeScheme = () => {
    if (textPreviewToken) {
      releasePreviewMutation.mutate({ previewToken: textPreviewToken });
    }
    setStep("select_scheme");
    setSelectedSchemeId(null);
    setDraftValues(null);
    setTextOptions([]);
    setTextPreviewToken(null);
    setModerationByField({});
    setModerationGeneralError(null);
    reset({});
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

  const handleGenerateText = async () => {
    if (!selectedSchemeId) return;
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
        kind: "initial",
        subtopicId,
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
    if (!selectedSchemeId || !draftValues || !textPreviewToken) return;

    mutation.mutate(
      {
        subtopicId,
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

  const rawError =
    mutation.isError && mutation.error && "response" in mutation.error
      ? (mutation.error as { response?: { data?: { error?: unknown } } }).response?.data?.error
      : null;
  const apiError =
    typeof rawError === "string"
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={handleClose} />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-background shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="initial-argument-drawer-title"
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="initial-argument-drawer-title" className="text-lg font-semibold">
            Start Argument
          </h2>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {!token ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>You must be logged in to submit an argument.</p>
              <Link to="/login" state={{ from: location }} className="text-primary hover:underline">
                Go to login
              </Link>
            </div>
          ) : !selectedSchemeId ? (
            <>
              <p
                className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide"
                aria-live="polite"
              >
                Step 1 of 3 — Select scheme
              </p>
              <SchemeSuggester
                description="We suggest schemes from the list below. “Use this” selects the scheme and pre-fills variables when the model can infer them from your text."
                onSelect={(schemeId, prefill) => handleSelectScheme(schemeId, prefill)}
              />
              <SchemeList schemes={schemes} onSelect={(id) => handleSelectScheme(id, null)} />
            </>
          ) : selectedScheme && step === "fill_variables" ? (
            <form className="flex flex-col gap-6">
              <div>
                <button
                  type="button"
                  onClick={handleChangeScheme}
                  className="text-sm text-primary hover:underline"
                >
                  ← Change scheme
                </button>
                <h3 className="mt-1 font-medium">{selectedScheme.name}</h3>
              </div>
              <blockquote
                className={cn("border-l-2 border-muted pl-3 text-sm text-muted-foreground")}
              >
                {conclusionPreview(selectedScheme.conclusion, selectedScheme.variables)}
              </blockquote>
              <p
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                aria-live="polite"
              >
                Step 2 of 3 — Fill in details
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
                      <FieldLabel htmlFor={`initial-variable-${variable.id}`}>
                        {variable.name}
                        {variable.required && <span className="text-destructive"> *</span>}
                      </FieldLabel>
                      {variable.type === "string" ? (
                        <textarea
                          id={`initial-variable-${variable.id}`}
                          {...reg}
                          placeholder={variable.placeholder}
                          rows={3}
                          className={cn(
                            "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
                            "placeholder:text-muted-foreground",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            "aria-invalid:border-destructive",
                          )}
                          aria-invalid={!!errors[variable.id] || !!modMsg}
                          aria-required={variable.required ? true : undefined}
                          aria-describedby={
                            errors[variable.id] || modMsg
                              ? `initial-variable-${variable.id}-error`
                              : undefined
                          }
                        />
                      ) : (
                        <Input
                          id={`initial-variable-${variable.id}`}
                          {...reg}
                          placeholder={variable.placeholder}
                          aria-invalid={!!errors[variable.id] || !!modMsg}
                          aria-required={variable.required ? true : undefined}
                          aria-describedby={
                            errors[variable.id] || modMsg
                              ? `initial-variable-${variable.id}-error`
                              : undefined
                          }
                        />
                      )}
                      <FieldDescription>{variable.description}</FieldDescription>
                      <FieldError
                        id={`initial-variable-${variable.id}-error`}
                        errors={errors[variable.id] ? [errors[variable.id]] : undefined}
                      />
                      {modMsg && (
                        <p
                          role="alert"
                          className="text-sm text-destructive"
                          id={`initial-variable-${variable.id}-mod`}
                        >
                          {modMsg}
                        </p>
                      )}
                    </Field>
                  );
                })}
              </FieldGroup>
              {moderationGeneralError && (
                <p role="alert" className="text-sm text-destructive">
                  {moderationGeneralError}
                </p>
              )}
              {apiError && (
                <p role="alert" className="text-sm text-destructive">
                  {apiError}
                </p>
              )}
              {textMutation.isError &&
                !(textMutation.error instanceof ModerationFailedClientError) && (
                  <p role="alert" className="text-sm text-destructive">
                    Unable to generate text options.
                  </p>
                )}
              <Button
                type="button"
                disabled={textMutation.isPending}
                className="self-start"
                onClick={handleGenerateText}
              >
                {textMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate Argument Text"
                )}
              </Button>
            </form>
          ) : selectedScheme && step === "choose_text" ? (
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
                <h3 className="mt-1 font-medium">{selectedScheme.name}</h3>
                <p
                  className="mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wide"
                  aria-live="polite"
                >
                  Step 3 of 3 — Choose argument text
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Pick the neutral wording you want to store with this argument.
              </p>
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
                <p role="alert" className="text-sm text-destructive">
                  {apiError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Scheme not found.</p>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Renders the selectable scheme list used in initial argument setup.
 *
 * @param params Available schemes and select handler.
 * @returns List UI of scheme cards.
 */
function SchemeList({ schemes, onSelect }: { schemes: Scheme[]; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose an argumentation scheme to structure your argument.
      </p>
      <ul className="space-y-3">
        {schemes.map((scheme) => (
          <li key={scheme.id} className="rounded-lg border p-4 shadow-sm">
            <h3 className="font-medium">{scheme.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{scheme.description}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => onSelect(scheme.id)}
            >
              Select
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
