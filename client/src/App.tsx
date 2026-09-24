import { AppSidebar } from "@/components/app-sidebar";
import { AppSwitcherWidget } from "@/components/AppSwitcherWidget";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminRoute } from "@/components/routing/AdminRoute";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ENABLE_GBB_TIERS } from "@/lib/featureFlags";
import { ThemeProvider, useTheme } from "@/lib/theme";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import LoginPage from "@/pages/auth/login";
import ResetPasswordPage from "@/pages/auth/reset-password";
import NotFound from "@/pages/not-found";
import OpportunitiesListPage from "@/pages/opportunities/opportunities-list";
import OpportunityDetailPage from "@/pages/opportunities/opportunity-detail";
import OpportunityFormPage from "@/pages/opportunities/opportunity-form";
import ReferenceMeasurementsPage from "@/pages/opportunities/reference-measurements";
import DashboardPage from "@/pages/owner/dashboard";
import MySubscriptionPage from "@/pages/owner/my-subscription";
import OwnerOnboardingPage from "@/pages/owner/owner-onboarding";
import ProfilePage from "@/pages/owner/profile";
import SubscriptionPricingPage from "@/pages/owner/subscription-pricing";
import { QueryClientProvider } from "@tanstack/react-query";
import { Loader2, Moon, Sun } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";

const AdminRulesPage = lazy(() => import("@/pages/admin/admin-rules"));
const AdminReferencesPage = lazy(() => import("@/pages/admin/admin-references"));
const AdminSignTypesPage = lazy(() => import("@/pages/admin/admin-sign-types"));
const AdminTenantsPage = lazy(() => import("@/pages/admin/admin-tenants"));
const AdminUsersPage = lazy(() => import("@/pages/admin/admin-users"));
const AdminCompanyPage = lazy(() => import("@/pages/admin/admin-company"));
const AdminUsagePage = lazy(() => import("@/pages/admin/admin-usage"));
const AdminSubscriptionsPage = lazy(() => import("@/pages/admin/admin-subscriptions"));
const AdminEmailTemplatesPage = lazy(() => import("@/pages/admin/admin-email-templates"));

function AdminSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AdminRoute>{children}</AdminRoute>
    </Suspense>
  );
}

function DarkModeToggle() {
  const { darkMode, toggleDarkMode } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleDarkMode}
      className="shrink-0"
      data-testid="button-toggle-dark-mode"
    >
      {darkMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function ProtectedRouter() {
  const { user, isLoading, isAuthenticated, needsOnboarding, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [gateToastShown, setGateToastShown] = useState(false);

  const subStatus = user?.subscriptionStatus;
  const needsSubscription = !isSuperAdmin && !!subStatus?.needsSubscription;

  useEffect(() => {
    if (needsSubscription && !gateToastShown) {
      setGateToastShown(true);
      toast({
        title: "Subscription Required",
        description:
          "An active subscription is required to access features. Please choose a plan to continue.",
        variant: "destructive",
        duration: 8000,
      });
    }
  }, [needsSubscription, gateToastShown]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route>
          <LoginPage />
        </Route>
      </Switch>
    );
  }

  if (needsOnboarding) {
    return <OwnerOnboardingPage />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <span className="text-sm font-medium text-muted-foreground">SignSalesIQ</span>
            <div className="ml-auto flex items-center gap-2">
              {user?.widgetToken ? (
                <AppSwitcherWidget token={user.widgetToken} position="top-right" />
              ) : null}
              <DarkModeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/opportunities" component={OpportunitiesListPage} />
              <Route path="/opportunities/new" component={OpportunityFormPage} />
              <Route path="/opportunities/:id/edit" component={OpportunityFormPage} />
              <Route path="/opportunities/:id" component={OpportunityDetailPage} />
              <Route path="/admin/tenants">
                <AdminSuspense>
                  <AdminTenantsPage />
                </AdminSuspense>
              </Route>
              <Route path="/admin/users">
                <AdminSuspense>
                  <AdminUsersPage />
                </AdminSuspense>
              </Route>
              {ENABLE_GBB_TIERS && (
                <Route path="/admin/rules">
                  <AdminSuspense>
                    <AdminRulesPage />
                  </AdminSuspense>
                </Route>
              )}
              <Route path="/admin/references">
                <AdminSuspense>
                  <AdminReferencesPage />
                </AdminSuspense>
              </Route>
              <Route path="/admin/sign-types">
                <AdminSuspense>
                  <AdminSignTypesPage />
                </AdminSuspense>
              </Route>
              <Route path="/admin/company">
                <AdminSuspense>
                  <AdminCompanyPage />
                </AdminSuspense>
              </Route>
              <Route path="/admin/usage">
                <AdminSuspense>
                  <AdminUsagePage />
                </AdminSuspense>
              </Route>
              <Route path="/admin/subscriptions">
                <AdminSuspense>
                  <AdminSubscriptionsPage />
                </AdminSuspense>
              </Route>
              <Route path="/admin/email-templates">
                <AdminSuspense>
                  <AdminEmailTemplatesPage />
                </AdminSuspense>
              </Route>
              <Route path="/subscribe">{() => <SubscriptionPricingPage />}</Route>
              <Route path="/my-subscription" component={MySubscriptionPage} />
              <Route path="/measurements" component={ReferenceMeasurementsPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/forgot-password" component={ForgotPasswordPage} />
              <Route path="/reset-password" component={ResetPasswordPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>

      {needsSubscription && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          data-testid="subscription-modal-overlay"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-background mx-4">
            <SubscriptionPricingPage isModal />
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <ProtectedRouter />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
