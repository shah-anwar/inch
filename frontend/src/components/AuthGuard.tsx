import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard that redirects unauthenticated users to login while preserving
 * the attempted destination in router state.
 *
 * @param props Guarded child content.
 * @returns Children for authenticated sessions, otherwise login redirect.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
