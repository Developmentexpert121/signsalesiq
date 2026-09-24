export const qk = {
  auth: {
    me: () => ["/api/auth/me"] as const,
  },
  opportunities: {
    all: () => ["/api/opportunities"] as const,
    list: () => ["/api/opportunities"] as const,
    detail: (id: string) => ["/api/opportunities", id] as const,
  },
  signTypes: {
    all: () => ["/api/sign-types"] as const,
    admin: () => ["/api/admin/sign-types"] as const,
  },
  tenant: {
    profile: () => ["/api/tenant/profile"] as const,
    rules: () => ["/api/tenant/rules"] as const,
  },
  tenants: {
    all: () => ["/api/tenants"] as const,
    users: (tenantId: string) => ["/api/tenants", tenantId, "users"] as const,
  },
  subscription: {
    status: () => ["/api/subscription/status"] as const,
    plansPublic: () => ["/api/subscription-plans/public"] as const,
    plansAdmin: () => ["/api/subscription-plans"] as const,
    settings: () => ["/api/subscription-settings"] as const,
    ownerOwned: () => ["/api/owner-subscriptions"] as const,
  },
  admin: {
    activityLogs: () => ["/api/admin/activity-logs"] as const,
    activity: () => ["/api/admin/activity"] as const,
    usage: () => ["/api/admin/usage"] as const,
    emailTemplates: () => ["/api/admin/email-templates"] as const,
    emailLogs: () => ["/api/admin/email-logs"] as const,
    references: () => ["/api/admin/references"] as const,
    rules: () => ["/api/admin/rules"] as const,
    rulesPublic: () => ["/api/admin/rules-public"] as const,
    mockupFeedbackStats: () => ["/api/admin/mockup-feedback/stats"] as const,
  },
};
