import type { CreateScheme } from "@inch/types";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAdminSchemes,
  useCreateAdminScheme,
  useCreateCriticalQuestion,
  useUpdateCriticalQuestion,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/hooks/useUserData";

type VariableRow = CreateScheme["variables"][number];

const emptyVariable = (): VariableRow => ({
  id: "",
  name: "",
  description: "",
  placeholder: "",
  type: "string",
  required: false,
});

/** Admin page for creating a new argumentation scheme. */
export default function CreateSchemePage() {
  const user = useUserData();
  const { token } = useAuth();
  const navigate = useNavigate();
  const createScheme = useCreateAdminScheme();
  const { data: schemes = [] } = useAdminSchemes();
  const createCriticalQuestion = useCreateCriticalQuestion();
  const updateCriticalQuestion = useUpdateCriticalQuestion();

  const [schemeId, setSchemeId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [variables, setVariables] = useState<VariableRow[]>([emptyVariable()]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cqSuccessMessage, setCqSuccessMessage] = useState<string | null>(null);
  const [cqErrorMessage, setCqErrorMessage] = useState<string | null>(null);
  const [cqSchemeId, setCqSchemeId] = useState("");
  const [cqId, setCqId] = useState("");
  const [cqText, setCqText] = useState("");
  const [cqDescription, setCqDescription] = useState("");
  const [cqValidResponseSchemeIds, setCqValidResponseSchemeIds] = useState<string[]>([]);
  const [selectedExistingCqId, setSelectedExistingCqId] = useState("");
  const [existingValidResponseSchemeIds, setExistingValidResponseSchemeIds] = useState<string[]>(
    [],
  );

  if (!token) return null;
  if (user && user.username && (user as { isAdmin?: boolean }).isAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => {
      navigate("/admin/schemes");
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [successMessage, navigate]);

  const canSubmit = useMemo(() => {
    if (
      schemeId.trim().length === 0 ||
      name.trim().length === 0 ||
      description.trim().length === 0 ||
      conclusion.trim().length === 0
    ) {
      return false;
    }
    return variables.every(
      (variable) =>
        variable.id.trim().length > 0 &&
        variable.name.trim().length > 0 &&
        variable.description.trim().length > 0 &&
        variable.placeholder.trim().length > 0,
    );
  }, [schemeId, name, description, conclusion, variables]);

  const criticalQuestions = useMemo(
    () =>
      schemes.flatMap((scheme) =>
        scheme.criticalQuestions.map((cq) => ({
          ...cq,
          schemeName: scheme.name,
        })),
      ),
    [schemes],
  );

  const canSubmitNewCq = useMemo(() => {
    return (
      cqSchemeId.trim().length > 0 &&
      cqId.trim().length > 0 &&
      cqText.trim().length >= 5 &&
      cqDescription.trim().length >= 10
    );
  }, [cqSchemeId, cqId, cqText, cqDescription]);

  const selectedExistingCq = useMemo(
    () => criticalQuestions.find((cq) => cq.id === selectedExistingCqId) ?? null,
    [criticalQuestions, selectedExistingCqId],
  );

  const toggleSchemeId = (
    current: string[],
    setValue: (next: string[]) => void,
    schemeIdToToggle: string,
  ) => {
    if (current.includes(schemeIdToToggle)) {
      setValue(current.filter((id) => id !== schemeIdToToggle));
      return;
    }
    setValue([...current, schemeIdToToggle].sort());
  };

  const updateVariable = <K extends keyof VariableRow>(
    index: number,
    key: K,
    value: VariableRow[K],
  ) => {
    setVariables((prev) =>
      prev.map((variable, variableIndex) =>
        variableIndex === index ? { ...variable, [key]: value } : variable,
      ),
    );
  };

  const onSubmit = () => {
    setErrorMessage(null);
    const payload: CreateScheme = {
      id: schemeId.trim(),
      name: name.trim(),
      description: description.trim(),
      conclusion: conclusion.trim(),
      variables: variables.map((variable) => ({
        id: variable.id.trim(),
        name: variable.name.trim(),
        description: variable.description.trim(),
        placeholder: variable.placeholder.trim(),
        type: variable.type,
        required: Boolean(variable.required),
      })),
    };
    createScheme.mutate(payload, {
      onSuccess: () => {
        setSuccessMessage("Successfully added scheme, redirecting to active schemes...");
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" &&
          error != null &&
          "response" in error &&
          typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error ===
            "string"
            ? String((error as { response?: { data?: { error?: unknown } } }).response?.data?.error)
            : "Failed to add scheme.";
        setErrorMessage(message);
      },
    });
  };

  const onSubmitNewCriticalQuestion = () => {
    setCqErrorMessage(null);
    setCqSuccessMessage(null);
    createCriticalQuestion.mutate(
      {
        schemeId: cqSchemeId.trim(),
        data: {
          id: cqId.trim(),
          text: cqText.trim(),
          description: cqDescription.trim(),
          validResponseSchemeIds: [...cqValidResponseSchemeIds].sort(),
        },
      },
      {
        onSuccess: () => {
          setCqSuccessMessage("Critical question created.");
          setCqId("");
          setCqText("");
          setCqDescription("");
          setCqValidResponseSchemeIds([]);
        },
        onError: (error: unknown) => {
          const message =
            typeof error === "object" &&
            error != null &&
            "response" in error &&
            typeof (error as { response?: { data?: { error?: unknown } } }).response?.data
              ?.error === "string"
              ? String(
                  (error as { response?: { data?: { error?: unknown } } }).response?.data?.error,
                )
              : "Failed to create critical question.";
          setCqErrorMessage(message);
        },
      },
    );
  };

  const onSelectExistingCq = (nextId: string) => {
    setSelectedExistingCqId(nextId);
    const nextCq = criticalQuestions.find((cq) => cq.id === nextId);
    setExistingValidResponseSchemeIds(nextCq ? [...nextCq.validResponseSchemeIds].sort() : []);
    setCqErrorMessage(null);
    setCqSuccessMessage(null);
  };

  const onUpdateExistingCriticalQuestion = () => {
    if (!selectedExistingCqId) return;
    setCqErrorMessage(null);
    setCqSuccessMessage(null);
    updateCriticalQuestion.mutate(
      {
        id: selectedExistingCqId,
        data: { validResponseSchemeIds: [...existingValidResponseSchemeIds].sort() },
      },
      {
        onSuccess: () => {
          setCqSuccessMessage("Critical question response schemes updated.");
        },
        onError: (error: unknown) => {
          const message =
            typeof error === "object" &&
            error != null &&
            "response" in error &&
            typeof (error as { response?: { data?: { error?: unknown } } }).response?.data
              ?.error === "string"
              ? String(
                  (error as { response?: { data?: { error?: unknown } } }).response?.data?.error,
                )
              : "Failed to update critical question.";
          setCqErrorMessage(message);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 rounded-lg border border-border p-4">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold">Create Scheme</h1>
            <p className="text-sm text-muted-foreground">
              New schemes are created inactive by default. Enable them from Active Schemes.
            </p>
          </div>

          <div className="grid gap-3">
            <Input
              value={schemeId}
              onChange={(e) => setSchemeId(e.target.value)}
              placeholder="Scheme ID"
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Scheme name"
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scheme description"
            />
            <Input
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              placeholder="Conclusion template"
            />
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Variables</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setVariables((prev) => [...prev, emptyVariable()])}
              >
                Add variable
              </Button>
            </div>
            {variables.map((variable, index) => (
              <div key={`${index}-${variable.id}`} className="rounded-md border border-border p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    value={variable.id}
                    onChange={(e) => updateVariable(index, "id", e.target.value)}
                    placeholder="Variable ID"
                  />
                  <Input
                    value={variable.name}
                    onChange={(e) => updateVariable(index, "name", e.target.value)}
                    placeholder="Variable name"
                  />
                  <Input
                    value={variable.description}
                    onChange={(e) => updateVariable(index, "description", e.target.value)}
                    placeholder="Variable description"
                  />
                  <Input
                    value={variable.placeholder}
                    onChange={(e) => updateVariable(index, "placeholder", e.target.value)}
                    placeholder="Variable placeholder"
                  />
                  <label className="text-sm">
                    Type
                    <select
                      className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      value={variable.type}
                      onChange={(e) =>
                        updateVariable(index, "type", e.target.value as VariableRow["type"])
                      }
                    >
                      <option value="string">string</option>
                      <option value="entity">entity</option>
                      <option value="claim">claim</option>
                    </select>
                  </label>
                  <label className="mt-6 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={variable.required}
                      onChange={(e) => updateVariable(index, "required", e.target.checked)}
                    />
                    Required
                  </label>
                </div>
                {variables.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="mt-2"
                    onClick={() =>
                      setVariables((prev) =>
                        prev.filter((_, variableIndex) => variableIndex !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button
              type="button"
              disabled={!canSubmit || createScheme.isPending}
              onClick={onSubmit}
            >
              Confirm
            </Button>
          </div>

          {successMessage && <p className="mt-3 text-sm text-emerald-400">{successMessage}</p>}
          {errorMessage && <p className="mt-3 text-sm text-red-400">{errorMessage}</p>}

          <div className="mt-8 border-t border-border pt-6">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold">Add / Update Critical Question</h2>
              <p className="text-sm text-muted-foreground">
                Create new critical questions, or update which schemes can be used as valid
                responses. Existing critical question text and description cannot be amended or
                deleted.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <h3 className="text-lg font-medium">Add New Critical Question</h3>
                <div className="mt-3 grid gap-3">
                  <label className="text-sm">
                    Parent scheme
                    <select
                      className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      value={cqSchemeId}
                      onChange={(e) => setCqSchemeId(e.target.value)}
                    >
                      <option value="">Select scheme</option>
                      {schemes.map((scheme) => (
                        <option key={scheme.id} value={scheme.id}>
                          {scheme.name} ({scheme.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    value={cqId}
                    onChange={(e) => setCqId(e.target.value)}
                    placeholder="CQ ID"
                  />
                  <Input
                    value={cqText}
                    onChange={(e) => setCqText(e.target.value)}
                    placeholder="CQ text"
                  />
                  <Input
                    value={cqDescription}
                    onChange={(e) => setCqDescription(e.target.value)}
                    placeholder="CQ description"
                  />
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium">Valid response schemes</h4>
                  <div className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md border border-border p-2">
                    {schemes.map((scheme) => (
                      <label
                        key={`new-cq-${scheme.id}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={cqValidResponseSchemeIds.includes(scheme.id)}
                          onChange={() =>
                            toggleSchemeId(
                              cqValidResponseSchemeIds,
                              setCqValidResponseSchemeIds,
                              scheme.id,
                            )
                          }
                        />
                        {scheme.name} ({scheme.id})
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  className="mt-4"
                  disabled={!canSubmitNewCq || createCriticalQuestion.isPending}
                  onClick={onSubmitNewCriticalQuestion}
                >
                  Add critical question
                </Button>
              </div>

              <div className="rounded-md border border-border p-4">
                <h3 className="text-lg font-medium">Update Existing Critical Question</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Only valid response schemes can be updated.
                </p>
                <div className="mt-3 grid gap-3">
                  <label className="text-sm">
                    Existing critical question
                    <select
                      className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      value={selectedExistingCqId}
                      onChange={(e) => onSelectExistingCq(e.target.value)}
                    >
                      <option value="">Select critical question</option>
                      {criticalQuestions.map((cq) => (
                        <option key={cq.id} value={cq.id}>
                          {cq.id} - {cq.schemeName}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedExistingCq && (
                    <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Text:</span>{" "}
                        {selectedExistingCq.text}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-foreground">Description:</span>{" "}
                        {selectedExistingCq.description}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium">Valid response schemes</h4>
                  <div className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md border border-border p-2">
                    {schemes.map((scheme) => (
                      <label
                        key={`existing-cq-${scheme.id}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={existingValidResponseSchemeIds.includes(scheme.id)}
                          onChange={() =>
                            toggleSchemeId(
                              existingValidResponseSchemeIds,
                              setExistingValidResponseSchemeIds,
                              scheme.id,
                            )
                          }
                          disabled={!selectedExistingCqId}
                        />
                        {scheme.name} ({scheme.id})
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  className="mt-4"
                  disabled={!selectedExistingCqId || updateCriticalQuestion.isPending}
                  onClick={onUpdateExistingCriticalQuestion}
                >
                  Update response schemes
                </Button>
              </div>
            </div>

            {cqSuccessMessage && (
              <p className="mt-3 text-sm text-emerald-400">{cqSuccessMessage}</p>
            )}
            {cqErrorMessage && <p className="mt-3 text-sm text-red-400">{cqErrorMessage}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
