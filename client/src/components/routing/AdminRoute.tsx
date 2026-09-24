import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";

function FullScreenLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function AdminRoute({
  children,
  requireSuperAdmin = false,
}: {
  children: ReactNode;
  requireSuperAdmin?: boolean;
}) {
  const { isAuthenticated, isLoading, isAdmin, isSuperAdmin } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Redirect to="/" />;
  if (requireSuperAdmin ? !isSuperAdmin : !isAdmin) return <Redirect to="/" />;
  return <>{children}</>;
}
