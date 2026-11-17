import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogoMark } from "./Logo";
import { Spinner } from "./ui";
import type { Role } from "../lib/types";

export function AuthSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper">
      <LogoMark className="h-14 w-14 animate-pulse" />
      <div className="flex items-center gap-2 text-sm font-medium text-ink/50">
        <Spinner /> Memuat SIMPATIK…
      </div>
    </div>
  );
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/kabid"} replace />;
  }
  return <>{children}</>;
}

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/kabid"} replace />;
}
