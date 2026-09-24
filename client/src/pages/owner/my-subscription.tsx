import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  Star,
  Shield,
  Zap,
  Loader2,
  CheckCircle2,
  ArrowUp,
  Crown,
  Calendar,
  TrendingUp,
  BarChart3,
  Clock,
  CreditCard,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { SubscriptionPlan } from "@shared/schema";

const PLAN_THEMES = [
  {
    gradient: "from-indigo-500 to-purple-600",
    accent: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    button: "bg-indigo-600 hover:bg-indigo-700",
    icon: Star,
    ring: "ring-indigo-500",
    border: "border-indigo-200 dark:border-indigo-800",
    light: "bg-indigo-500/10",
  },
  {
    gradient: "from-blue-500 to-cyan-600",
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    button: "bg-blue-600 hover:bg-blue-700",
    icon: Shield,
    ring: "ring-blue-500",
    border: "border-blue-200 dark:border-blue-800",
    light: "bg-blue-500/10",
  },
  {
    gradient: "from-orange-500 to-amber-600",
    accent: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    button: "bg-orange-600 hover:bg-orange-700",
    icon: Zap,
    ring: "ring-orange-500",
    border: "border-orange-200 dark:border-orange-800",
    light: "bg-orange-500/10",
  },
];

function CountdownTimer({ subscribedAt }: { subscribedAt: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const calcTimeLeft = () => {
      const subDate = new Date(subscribedAt);
      const expiryDate = new Date(subDate);
      expiryDate.setDate(expiryDate.getDate() + 30);
      const now = new Date();
      const diff = expiryDate.getTime() - now.getTime();

      if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
        secs: Math.floor((diff / 1000) % 60),
      };
    };

    setTimeLeft(calcTimeLeft());
    const interval = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(interval);
  }, [subscribedAt]);

  const blocks = [
    { value: timeLeft.days, label: "DAYS" },
    { value: timeLeft.hours, label: "HOURS" },
    { value: timeLeft.mins, label: "MINS" },
    { value: timeLeft.secs, label: "SECS" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3" data-testid="countdown-timer">
      {blocks.map((block) => (
        <div
          key={block.label}
          className="text-center rounded-xl bg-gradient-to-b from-background to-muted/30 border shadow-sm p-4"
        >
          <div className="text-3xl font-bold tabular-nums tracking-tight">
            {String(block.value).padStart(2, "0")}
          </div>
          <div className="text-[10px] font-semibold text-muted-foreground tracking-widest mt-1">
            {block.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MySubscriptionPage() {
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(false);
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const isSuccess = params.get("success") === "true";
  const sessionId = params.get("session_id");

  const { data: subStatus, isLoading: statusLoading } = useQuery<any>({
    queryKey: ["/api/subscription/status"],
  });

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans/public"],
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
          }
          window.history.replaceState({}, "", "/my-subscription");
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
      if (data.url) window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({ title: "Unable to proceed", description: err.message, variant: "destructive" });
    },
  });

  if (statusLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500 mx-auto" />
          <p className="text-sm text-muted-foreground">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  const hasActiveSub = subStatus?.hasActiveSubscription;
  const planDetails = subStatus?.planDetails;
  const eventsUsed = subStatus?.eventsUsed || 0;
  const eventLimit = planDetails?.eventLimit || 100;
  const remaining = Math.max(0, eventLimit - eventsUsed);
  const usagePercent = Math.min(100, (eventsUsed / eventLimit) * 100);

  const usageColor =
    usagePercent >= 90 ? "bg-red-500" : usagePercent >= 70 ? "bg-amber-500" : "bg-emerald-500";

  const usageGradient =
    usagePercent >= 90
      ? "from-red-500 to-red-600"
      : usagePercent >= 70
        ? "from-amber-400 to-amber-600"
        : "from-emerald-400 to-emerald-600";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-muted/20 to-background">
      <div className="w-full px-6 lg:px-10 xl:px-16 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-subscription-title">
              Subscription Plans
            </h1>
            <p className="text-sm text-muted-foreground">View and manage your subscription</p>
          </div>
        </div>

        {hasActiveSub && planDetails && (
          <Card
            className="overflow-hidden border-0 shadow-lg"
            data-testid="card-active-subscription"
          >
            <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400" />
            <CardContent className="p-0">
              <div className="p-8">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold">{planDetails.name}</h2>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 px-3 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Active
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      ${planDetails.price}/month · {eventLimit} opportunities per month
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <div
                      className="text-5xl font-extrabold text-orange-500 tracking-tight"
                      data-testid="text-events-count"
                    >
                      {eventsUsed}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">opportunities this month</p>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>{eventsUsed} used</span>
                    <span>{eventLimit} total</span>
                  </div>
                  <div className="w-full h-3 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${usageGradient}`}
                      style={{ width: `${Math.max(usagePercent, 1)}%` }}
                      data-testid="progress-usage"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                  <div className="flex items-center gap-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-5">
                    <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold" data-testid="text-used-count">
                        {eventsUsed}
                      </div>
                      <div className="text-sm text-muted-foreground">Used</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-5">
                    <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold" data-testid="text-remaining-count">
                        {remaining}
                      </div>
                      <div className="text-sm text-muted-foreground">Remaining</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 p-5">
                    <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                      <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold" data-testid="text-completed-count">
                        0
                      </div>
                      <div className="text-sm text-muted-foreground">Completed</div>
                    </div>
                  </div>
                </div>

                {subStatus?.subscribedAt && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
                        Plan Expires In
                      </span>
                    </div>
                    <CountdownTimer subscribedAt={subStatus.subscribedAt} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!hasActiveSub && (
          <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 shadow-lg">
            <CardContent className="p-10 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
                <Crown className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold mb-2">No Active Subscription</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Choose a plan below to unlock all features of SignSalesIQ and start creating
                proposals.
              </p>
            </CardContent>
          </Card>
        )}

        <div>
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold">Available Plans</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
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
              const isUpgrade = hasActiveSub && !isCurrentPlan;

              return (
                <div key={plan.id} className="relative" data-testid={`card-plan-${plan.id}`}>
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-emerald-500 text-white border-0 shadow-md px-4 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Active
                      </Badge>
                    </div>
                  )}
                  {isPopular && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-md px-4 py-1">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <Card
                    className={`h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isCurrentPlan ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/10" : isPopular ? "ring-2 " + theme.ring + " shadow-lg" : "shadow-md hover:shadow-lg"}`}
                  >
                    <div className={`h-2 bg-gradient-to-r ${theme.gradient}`} />

                    <CardContent className="p-6 flex flex-col h-[calc(100%-0.5rem)]">
                      <div className="flex items-center gap-3 mb-5">
                        <div
                          className={`h-11 w-11 rounded-xl ${theme.bg} flex items-center justify-center`}
                        >
                          <IconComp className={`h-5 w-5 ${theme.accent}`} />
                        </div>
                        <h3 className="text-lg font-bold">{plan.name}</h3>
                      </div>

                      {savings && (
                        <Badge className="mb-3 w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs font-semibold px-2.5">
                          Save ${savings}
                        </Badge>
                      )}

                      <div className="mb-5">
                        {plan.originalPrice && (
                          <p className="text-sm text-muted-foreground line-through mb-0.5">
                            ${plan.originalPrice}
                          </p>
                        )}
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-extrabold tracking-tight">
                            ${plan.price}
                          </span>
                          <span className="text-sm text-muted-foreground font-medium">/ month</span>
                        </div>
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
                          className="w-full h-12 rounded-xl font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-0"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Active Plan
                        </Button>
                      ) : (
                        <Button
                          onClick={() => checkoutMutation.mutate(plan.id)}
                          disabled={checkoutMutation.isPending}
                          className={`w-full h-12 ${theme.button} text-white rounded-xl font-semibold transition-all duration-200 hover:shadow-lg`}
                          data-testid={`button-subscribe-${plan.id}`}
                        >
                          {checkoutMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : isUpgrade ? (
                            <ArrowUp className="h-4 w-4 mr-2" />
                          ) : (
                            <ArrowRight className="h-4 w-4 mr-2" />
                          )}
                          {isUpgrade ? "Upgrade Plan" : "Get Started"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
