import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  CheckCircle,
  Star,
  Shield,
  Zap,
  Loader2,
  LogOut,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Crown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { SubscriptionPlan } from "@shared/schema";

const PLAN_THEMES = [
  {
    gradient: "from-indigo-500 to-purple-600",
    accent: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800",
    button: "bg-indigo-600 hover:bg-indigo-700",
    icon: Star,
    ring: "ring-indigo-500",
  },
  {
    gradient: "from-blue-500 to-cyan-600",
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    button: "bg-blue-600 hover:bg-blue-700",
    icon: Shield,
    ring: "ring-blue-500",
  },
  {
    gradient: "from-orange-500 to-amber-600",
    accent: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    button: "bg-orange-600 hover:bg-orange-700",
    icon: Zap,
    ring: "ring-orange-500",
  },
];

interface SubscriptionPricingPageProps {
  isModal?: boolean;
}

export default function SubscriptionPricingPage({ isModal = false }: SubscriptionPricingPageProps) {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const isSuccess = params.get("success") === "true";
  const sessionId = params.get("session_id");
  const isCanceled = params.get("canceled") === "true";

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans/public"],
  });

  const { data: subStatus, isLoading: statusLoading } = useQuery<any>({
    queryKey: ["/api/subscription/status"],
  });

  useEffect(() => {
    if (isSuccess && sessionId && !verifying) {
      setVerifying(true);
      fetch(`/api/stripe/verify-session/${sessionId}`, { credentials: "include" })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.success) {
            toast({
              title: "Subscription activated!",
              description: "Your plan is now active. Welcome aboard!",
            });
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
            window.history.replaceState({}, "", "/my-subscription");
            setLocation("/my-subscription");
          }
          setVerifying(false);
        })
        .catch(() => setVerifying(false));
    }
  }, [isSuccess, sessionId]);

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiRequest("POST", "/api/stripe/create-checkout-session", { planId });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast({ title: "Unable to proceed", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = plansLoading || statusLoading;

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center ${isModal ? "py-20" : "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900"}`}
      >
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    );
  }

  const hasActiveSub = subStatus?.hasActiveSubscription;
  const needsSub = subStatus?.needsSubscription;

  return (
    <div
      className={
        isModal
          ? "bg-background"
          : "min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      }
    >
      <div className={`px-4 sm:px-6 ${isModal ? "py-6 sm:py-8" : "py-8 sm:py-12"}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                data-testid="text-pricing-title"
              >
                Choose Your Plan
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Select the plan that best fits your business needs
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout.mutate()}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-pricing-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {needsSub && !hasActiveSub && (
          <div
            className="mb-5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-4 flex items-start gap-3"
            data-testid="alert-subscription-required"
          >
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                Subscription Required
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                An active subscription is required to access SignSalesIQ features. Select a plan
                below to get started.
              </p>
            </div>
          </div>
        )}

        {isCanceled && (
          <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 flex items-center gap-3">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Checkout was canceled. You can select a plan whenever you're ready.
            </p>
          </div>
        )}

        {verifying && (
          <div className="mb-5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/30 p-4 flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <p className="text-sm text-blue-700 dark:text-blue-300">Verifying your payment...</p>
          </div>
        )}

        {hasActiveSub && subStatus?.planDetails && (
          <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                Active: {subStatus.planDetails.name}
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Your subscription is active — you have full access to all features.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {(plans || []).map((plan, idx) => {
            const theme = PLAN_THEMES[idx % PLAN_THEMES.length];
            const IconComp = theme.icon;
            const isPopular = idx === 1;
            const isCurrentPlan = hasActiveSub && subStatus?.planId === plan.id;
            const origPrice = plan.originalPrice
              ? parseFloat(plan.originalPrice.replace(/[^0-9.]/g, ""))
              : 0;
            const offerPrice = parseFloat(plan.price.replace(/[^0-9.]/g, ""));
            const savings = origPrice > offerPrice ? (origPrice - offerPrice).toFixed(2) : null;

            return (
              <div key={plan.id} className="relative" data-testid={`card-plan-${plan.id}`}>
                {isPopular && !isCurrentPlan && (
                  <div className="absolute -top-3.5 left-0 right-0 flex justify-center z-10">
                    <span className="px-4 py-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold shadow-md">
                      Most Popular
                    </span>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3.5 left-0 right-0 flex justify-center z-10">
                    <span className="px-4 py-1 rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-md">
                      Current Plan
                    </span>
                  </div>
                )}

                <Card
                  className={`overflow-hidden transition-all duration-200 hover:shadow-lg ${isPopular ? "ring-2 " + theme.ring + " shadow-md" : "shadow-sm"} ${isCurrentPlan ? "ring-2 ring-emerald-500" : ""}`}
                >
                  <div className={`h-1.5 bg-gradient-to-r ${theme.gradient}`} />

                  <CardContent className="p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className={`h-10 w-10 rounded-lg ${theme.bg} flex items-center justify-center`}
                      >
                        <IconComp className={`h-5 w-5 ${theme.accent}`} />
                      </div>
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                    </div>

                    {savings && (
                      <Badge className="mb-3 w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 font-medium">
                        Save ${savings}
                      </Badge>
                    )}

                    <div className="mb-5">
                      {plan.originalPrice && (
                        <p className="text-sm text-muted-foreground line-through mb-0.5">
                          ${plan.originalPrice}/mo
                        </p>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold tracking-tight">
                          ${plan.price}
                        </span>
                        <span className="text-sm text-muted-foreground font-medium">/month</span>
                      </div>
                    </div>

                    <div className={`rounded-lg ${theme.bg} px-3 py-2 mb-5`}>
                      <p className={`text-sm font-medium ${theme.accent}`}>
                        {plan.eventLimit} opportunities / month
                      </p>
                    </div>

                    <div className="space-y-3 mb-6 flex-1">
                      {(plan.features || []).map((feature, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-2.5">
                          <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="text-sm text-foreground/80">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {isCurrentPlan ? (
                      <Button
                        disabled
                        className="w-full h-11 bg-emerald-600 text-white rounded-lg font-medium"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Active Plan
                      </Button>
                    ) : (
                      <Button
                        onClick={() => checkoutMutation.mutate(plan.id)}
                        disabled={checkoutMutation.isPending || hasActiveSub}
                        className={`w-full h-11 ${theme.button} text-white rounded-lg font-medium transition-all duration-200 hover:shadow-md`}
                        data-testid={`button-subscribe-${plan.id}`}
                      >
                        {checkoutMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4 mr-2" />
                        )}
                        Get Started
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {(!plans || plans.length === 0) && (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Crown className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No plans available</h3>
            <p className="text-sm text-muted-foreground">
              Subscription plans are being set up. Please check back later or contact your
              administrator.
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            All plans include secure payment processing via Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
