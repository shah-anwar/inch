import { User } from "@inch/types";
import axios, { AxiosError } from "axios";
import { useState } from "react";
import PasswordEyeToggle from "@/components/password-eye-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

/**
 * Signup form that registers a user, immediately authenticates, and loads profile data.
 *
 * Side effects:
 * - Calls `/users`, `/login`, and `/me`.
 * - Persists auth context and redirects to home.
 *
 * @param props Card component props for layout integration.
 * @returns Signup card UI.
 */
export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const { setToken, setRefreshToken, setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const payload: User.CreateUserInput = { username, email, password };
      await axios.post(`${import.meta.env.VITE_API_URL}/users`, payload);
      const loginRes = await axios.post(`${import.meta.env.VITE_API_URL}/login`, {
        loginString: email,
        password,
      });
      setToken(loginRes.data.token);
      setRefreshToken(loginRes.data.refreshToken);
      const meRes = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
        headers: { Authorization: `Bearer ${loginRes.data.token}` },
      });
      setUser(meRes.data);
      window.location.href = "/";
    } catch (err: unknown) {
      const message = (err as AxiosError<{ error?: string }>)?.response?.data?.error;
      setError(message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Enter your information below to create your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordEyeToggle
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
              <PasswordEyeToggle
                id="confirm-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            {error && (
              <FieldDescription className="text-red-500 text-center">{error}</FieldDescription>
            )}
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating account…" : "Create Account"}
                </Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account?{" "}
                  <a
                    href="#"
                    className="underline-offset-4 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = "/login";
                    }}
                  >
                    Sign in
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
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
