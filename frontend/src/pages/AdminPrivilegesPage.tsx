import type { PromoteUserToAdminResponse } from "@inch/types";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePromoteUserToAdmin } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/hooks/useUserData";

/** Admin page for promoting existing users to admin role by username. */
export default function AdminPrivilegesPage() {
  const user = useUserData();
  const { token } = useAuth();
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<PromoteUserToAdminResponse | null>(null);
  const promoteUser = usePromoteUserToAdmin();

  if (!token) return null;
  if (user && user.username && (user as { isAdmin?: boolean }).isAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  const onConfirm = () => {
    const value = username.trim();
    if (value.length < 3) return;
    promoteUser.mutate(
      { username: value },
      {
        onSuccess: (response) => setResult(response),
      },
    );
  };

  const statusTone =
    result?.status === "already_admin"
      ? "border-yellow-500/60 bg-yellow-500/10 text-yellow-400"
      : result?.status === "promoted"
        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
        : result?.status === "not_found"
          ? "border-red-500/60 bg-red-500/10 text-red-400"
          : "";

  const statusText =
    result?.status === "already_admin"
      ? `${result.username} is already an admin.`
      : result?.status === "promoted"
        ? `${result.username} was promoted to admin successfully.`
        : result?.status === "not_found"
          ? `Username "${result.username}" not found.`
          : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 rounded-lg border border-border p-4">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold">Admin Privileges</h1>
            <p className="text-sm text-muted-foreground">Enter a username to grant admin access.</p>
          </div>

          <div className="flex max-w-xl items-center gap-2">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
            />
            <Button
              type="button"
              onClick={onConfirm}
              disabled={username.trim().length < 3 || promoteUser.isPending}
            >
              Confirm
            </Button>
          </div>

          {statusText && (
            <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${statusTone}`}>
              {statusText}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
