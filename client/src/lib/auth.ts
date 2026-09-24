import type { User } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import { qk } from "./queryKeys";

export type SubscriptionStatus = {
  gateEnabled: boolean;
  hasActiveSubscription: boolean;
  needsSubscription: boolean;
  planId: string | null;
};

export type AuthUser = Omit<User, "passwordHash"> & {
  tenantName?: string;
  tenantOnboardingComplete?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  widgetToken?: string;
};

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: qk.auth.me(),
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    staleTime: 60000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.auth.me() });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.auth.me() });
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === "SUPER_ADMIN",
    isTenantAdmin: user?.role === "ADMIN",
    isAdmin: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN",
    needsOnboarding: user?.role === "ADMIN" && user?.tenantOnboardingComplete === false,
    login: loginMutation,
    logout: logoutMutation,
  };
}
