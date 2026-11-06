import type { AdminScheme } from "@inch/types";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAdminActiveSchemes, useAdminSchemes, useSetAdminActiveSchemes } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/hooks/useUserData";

/**
 * Admin scheme-management page for inspecting schemes and critical questions.
 *
 * @returns Admin UI split between scheme list and scheme detail panel.
 */
export default function AdminPage() {
  const user = useUserData();
  const { token } = useAuth();
  const { data: schemes = [] } = useAdminSchemes();
  const { data: activeSchemes } = useAdminActiveSchemes();
  const setActiveSchemes = useSetAdminActiveSchemes();
  const [draftActiveIds, setDraftActiveIds] = useState<string[]>([]);

  if (!token) {
    return null;
  }

  if (user && user.username && (user as { isAdmin?: boolean }).isAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    if (!activeSchemes) return;
    setDraftActiveIds([...activeSchemes.activeSchemeIds].sort());
  }, [activeSchemes]);

  const persistedIds = useMemo(
    () => [...(activeSchemes?.activeSchemeIds ?? [])].sort(),
    [activeSchemes?.activeSchemeIds],
  );
  const draftSet = useMemo(() => new Set(draftActiveIds), [draftActiveIds]);
  const hasChanges = useMemo(
    () => persistedIds.join("::") !== [...draftActiveIds].sort().join("::"),
    [persistedIds, draftActiveIds],
  );

  const toggleScheme = (schemeId: string) => {
    const next = new Set(draftSet);
    if (next.has(schemeId)) {
      next.delete(schemeId);
    } else {
      next.add(schemeId);
    }
    setDraftActiveIds(Array.from(next).sort());
  };

  const onSelectAll = () => {
    setDraftActiveIds(schemes.map((scheme) => scheme.id).sort());
  };

  const onUnselectAll = () => {
    setDraftActiveIds([]);
  };

  const onConfirm = () => {
    if (!hasChanges) return;
    setActiveSchemes.mutate({ activeSchemeIds: [...draftActiveIds].sort() });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <AdminSidebar />

        <section className="min-w-0 flex-1 rounded-lg border border-border p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Active Schemes</h1>
              <p className="text-sm text-muted-foreground">
                Choose which schemes are available for new argument creation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onUnselectAll}>
                Unselect all
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onConfirm}
                disabled={!hasChanges || setActiveSchemes.isPending}
              >
                Confirm
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/50 text-left">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Active</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">CQs</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((scheme: AdminScheme) => (
                  <tr key={scheme.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={draftSet.has(scheme.id)}
                        onChange={() => toggleScheme(scheme.id)}
                        disabled={setActiveSchemes.isPending}
                        aria-label={`Toggle ${scheme.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{scheme.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {scheme.id}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{scheme.description}</td>
                    <td className="px-3 py-2">{scheme.criticalQuestions.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
