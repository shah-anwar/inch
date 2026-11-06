import { AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useMyArguments } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";

/**
 * Authenticated profile page that loads current user details from `/me`.
 *
 * Side effects:
 * - Fetches profile data on mount/token changes.
 * - Redirects to login when token is invalid/expired.
 *
 * @returns Profile card with loading and error states.
 */
export default function ProfilePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "arguments" | "password">("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "IN" | "OUT" | "UNDECIDED">("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "status">("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [page, setPage] = useState(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const { data: myArguments = [], isLoading: myArgumentsLoading } = useMyArguments(
    !!token && !loading && !error,
  );

  const visibleArguments = useMemo(() => {
    const statusFiltered =
      statusFilter === "ALL"
        ? myArguments
        : myArguments.filter((arg) => arg.status === statusFilter);
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const searched =
      normalizedSearch.length === 0
        ? statusFiltered
        : statusFiltered.filter((arg) =>
            [arg.argumentText, arg.schemeId, arg.status, arg.topicTitle, arg.subtopicTitle]
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearch),
          );

    const sorted = [...searched];
    if (sortBy === "newest") {
      sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    } else if (sortBy === "oldest") {
      sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    } else {
      const rank: Record<"IN" | "OUT" | "UNDECIDED", number> = { IN: 0, OUT: 1, UNDECIDED: 2 };
      sorted.sort(
        (a, b) =>
          rank[a.status] - rank[b.status] || +new Date(b.createdAt) - +new Date(a.createdAt),
      );
    }
    return sorted;
  }, [myArguments, sortBy, statusFilter, searchQuery]);

  const paginatedArguments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleArguments.slice(start, start + pageSize);
  }, [visibleArguments, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(visibleArguments.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sortBy, searchQuery, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get("/me")
      .then((res) => {
        if (cancelled) return;
        setUsername(res.data.username);
        setEmail(res.data.email);
        const date = res.data.createdAt ? new Date(res.data.createdAt) : null;
        setCreatedAt(date ? date.toLocaleDateString(undefined, { dateStyle: "medium" }) : null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as AxiosError)?.response?.status;
        if (status === 401 || status === 403) {
          navigate("/login", { replace: true, state: { from: location } });
          return;
        }
        setError(
          (err as AxiosError<{ error?: string }>)?.response?.data?.error ||
            "Failed to load profile",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate, location]);

  if (loading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Loading your profile…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription className="text-red-500">{error}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setUpdatingPassword(true);
    try {
      await apiClient.post("/me/password", {
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      setPasswordNotice("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: unknown) {
      const message =
        (err as AxiosError<{ error?: string }>)?.response?.data?.error ??
        "Failed to update password.";
      setPasswordError(Array.isArray(message) ? "Invalid password payload." : message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your account and review your submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border pb-4">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "profile"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("profile")}
              >
                Profile
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "arguments"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("arguments")}
              >
                My Arguments
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "password"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("password")}
              >
                Password
              </button>
            </div>

            {activeTab === "profile" && (
              <FieldGroup>
                <Field>
                  <FieldLabel>Username</FieldLabel>
                  <p className="text-sm text-muted-foreground">{username ?? "—"}</p>
                </Field>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <p className="text-sm text-muted-foreground">{email ?? "—"}</p>
                </Field>
                <hr className="border-border" />
                <Field>
                  <FieldLabel>Member since</FieldLabel>
                  <p className="text-sm text-muted-foreground">{createdAt ?? "—"}</p>
                </Field>
              </FieldGroup>
            )}

            {activeTab === "arguments" && (
              <div className="rounded-md border border-border overflow-hidden">
                <div className="border-b border-border bg-muted/40 px-4 py-3">
                  <div className="mb-2 text-sm text-muted-foreground">
                    Submitted arguments: {myArguments.length}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search submitted arguments..."
                      className="h-8 w-full min-w-[220px] flex-1"
                    />
                    <select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(e.target.value as "ALL" | "IN" | "OUT" | "UNDECIDED")
                      }
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <option value="ALL">All statuses</option>
                      <option value="IN">IN</option>
                      <option value="OUT">OUT</option>
                      <option value="UNDECIDED">UNDECIDED</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "status")}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="status">Sort by status</option>
                    </select>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value) as 25 | 50 | 100)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                  </div>
                </div>
                {myArgumentsLoading ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    Loading your arguments…
                  </div>
                ) : visibleArguments.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    No arguments match the selected filter.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {paginatedArguments.map((arg) => (
                      <div key={arg.id} className="px-4 py-3">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <Link
                            to={`/arg/${arg.id}`}
                            className="text-sm font-medium text-foreground hover:underline"
                          >
                            {arg.argumentText}
                          </Link>
                          <span
                            className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${
                              arg.status === "IN"
                                ? "border-green-500 text-green-500"
                                : arg.status === "OUT"
                                  ? "border-red-500 text-red-500"
                                  : "border-amber-500 text-amber-500"
                            }`}
                          >
                            {arg.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{arg.schemeId}</span>
                          <span>•</span>
                          <span>
                            {arg.topicTitle} / {arg.subtopicTitle}
                          </span>
                          <span>•</span>
                          <time dateTime={arg.createdAt}>
                            {new Date(arg.createdAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </time>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!myArgumentsLoading && visibleArguments.length > 0 ? (
                  <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded border border-border px-2 py-1 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded border border-border px-2 py-1 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {activeTab === "password" && (
              <form onSubmit={onPasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Current password</FieldLabel>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>New password</FieldLabel>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Confirm new password</FieldLabel>
                  <Input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
                {passwordNotice && <p className="text-sm text-emerald-500">{passwordNotice}</p>}
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60"
                >
                  {updatingPassword ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
