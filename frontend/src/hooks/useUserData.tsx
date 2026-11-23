import { useAuth } from "@/hooks/useAuth";

/** Returns the current authenticated user object from auth context. */
export function useUserData() {
  const { user } = useAuth();
  return user;
}
