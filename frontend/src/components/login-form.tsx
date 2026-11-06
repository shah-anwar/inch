import axios, { AxiosError } from "axios";
import { useState } from "react";
import type { Location } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import PasswordEyeToggle from "@/components/password-eye-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/** Resolves return path from router state set by `Navigate` / `navigate(..., { state: { from } })`. */
function pathAfterLogin(state: unknown): string {
  const from = (state as { from?: Location })?.from;
  if (!from || typeof from.pathname !== "string") return "/";
  return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
}

/**
 * Login form that authenticates the user and redirects to the original protected route.
 *
 * Side effects:
 * - Calls `/login` and `/me`.
 * - Updates auth context with token and user payload.
 *
 * @param props Wrapper div props.
 * @returns Login form card.
 */
export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const { setToken, setRefreshToken, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loginString, setLoginString] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const payload = { loginString, password };
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/login`, payload);
      setToken(res.data.token);
      setRefreshToken(res.data.refreshToken);
      const meRes = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
        headers: { Authorization: `Bearer ${res.data.token}` },
      });
      setUser(meRes.data);
      navigate(pathAfterLogin(location.state), { replace: true });
    } catch (err: unknown) {
      setError((err as AxiosError<{ error: string }>)?.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Enter your email or username below to login</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="loginString">Email or Username</FieldLabel>
                <Input
                  id="loginString"
                  type="text"
                  required
                  value={loginString}
                  onChange={(e) => setLoginString(e.target.value)}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <PasswordEyeToggle value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {error && (
                <FieldDescription className="text-red-500 text-center">{error}</FieldDescription>
              )}
              <Field>
                <Button type="submit">Login</Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{" "}
                  <a
                    href="#"
                    className="underline-offset-4 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = "/signup";
                    }}
                  >
                    Sign up
                  </a>
                </FieldDescription>
                <div className="flex justify-center mt-2">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => (window.location.href = "/")}
                  >
                    Back to Home
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
