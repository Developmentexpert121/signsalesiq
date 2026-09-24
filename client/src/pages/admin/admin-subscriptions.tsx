import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  CreditCard,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Power,
  Shield,
  LayoutGrid,
  Users,
  Sparkles,
  Eye,
  Star,
  Zap,
  CheckCircle,
  Settings2,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { SubscriptionPlan, SubscriptionSettings } from "@shared/schema";

interface OwnerSubscriptionRow {
  id: string;
  tenantId: string | null;
  userId: string | null;
  planId: string | null;
  eventsUsed: number;
  status: string;
  subscribedAt: string | null;
  createdAt: string;
  tenantName: string | null;
  tenantEmail: string | null;
  userName: string | null;
  userEmail: string | null;
  planName: string | null;
  planPrice: string | null;
  planEventLimit: number | null;
}

type TabKey = "manage" | "owners" | "preview";

function PlanFormDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: SubscriptionPlan | null;
}) {
  const { toast } = useToast();
  const isEditing = !!plan;

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [eventLimit, setEventLimit] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [featuresText, setFeaturesText] = useState("");

  useEffect(() => {
    if (open) {
      setName(plan?.name || "");
      setPrice(plan?.price || "");
      setOriginalPrice(plan?.originalPrice || "");
      setEventLimit(plan?.eventLimit ?? 100);
      setIsActive(plan?.active ?? true);
      setIsDefault(plan?.isDefault ?? false);
      setFeaturesText((plan?.features || []).join("\n"));
    }
  }, [open, plan]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/subscription-plans", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({ title: "Plan created" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/subscription-plans/${plan?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({ title: "Plan updated" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const features = featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    const data = {
      name,
      price,
      originalPrice: originalPrice || null,
      eventLimit,
      active: isActive,
      isDefault,
      features,
    };
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            {isEditing ? "Edit Plan" : "Create Plan"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details for this subscription plan."
              : "Add a new subscription plan."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plan Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Basic Plan"
                data-testid="input-plan-name"
              />
            </div>
            <div>
              <Label>Original Price ($)</Label>
              <Input
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="99"
                data-testid="input-plan-original-price"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Shown crossed out as the "before" price
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Offer Price ($) *</Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="89.99"
                data-testid="input-plan-price"
              />
              <p className="text-xs text-muted-foreground mt-1">Discounted price shown to admins</p>
            </div>
            <div>
              <Label>Opportunity Limit *</Label>
              <Input
                type="number"
                value={eventLimit}
                onChange={(e) => setEventLimit(parseInt(e.target.value, 10) || 0)}
                data-testid="input-plan-event-limit"
              />
              <p className="text-xs text-muted-foreground mt-1">Included opportunities per month</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-plan-active"
                className="data-[state=checked]:bg-orange-500"
              />
              <Label className="cursor-pointer">Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isDefault}
                onCheckedChange={setIsDefault}
                data-testid="switch-plan-default"
              />
              <Label className="cursor-pointer">Default Plan</Label>
            </div>
          </div>
          <div>
            <Label>Features (one per line)</Label>
            <Textarea
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={"Feature 1\nFeature 2\nFeature 3"}
              rows={4}
              data-testid="input-plan-features"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-plan"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !name || !price}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              data-testid="button-save-plan"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Plan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChangePlanDialog({
  open,
  onOpenChange,
  ownerSub,
  plans,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerSub: OwnerSubscriptionRow;
  plans: SubscriptionPlan[];
}) {
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string>(ownerSub.planId || "__none__");

  useEffect(() => {
    if (open) {
      setSelectedPlanId(ownerSub.planId || "__none__");
    }
  }, [open, ownerSub]);

  const changeMutation = useMutation({
    mutationFn: async (data: { planId: string | null }) => {
      const subKey = ownerSub.tenantId || `user:${ownerSub.userId}`;
      const res = await apiRequest("PATCH", `/api/owner-subscriptions/${subKey}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-subscriptions"] });
      toast({ title: "Plan changed" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const activePlans = plans.filter((p) => p.active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Plan</DialogTitle>
          <DialogDescription>Select a plan for {ownerSub.tenantName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Subscription Plan</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger data-testid="select-change-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No Plan</SelectItem>
                {activePlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} - {p.price}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() =>
              changeMutation.mutate({
                planId: selectedPlanId === "__none__" ? null : selectedPlanId,
              })
            }
            disabled={changeMutation.isPending}
            className="w-full"
            data-testid="button-save-change-plan"
          >
            {changeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManagePlansTab() {
  const { toast } = useToast();
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  const { data: plans, isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/subscription-plans/${id}`, { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({ title: "Plan updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/subscription-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({ title: "Plan deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <>
      <Card>
        <CardHeader className="py-3 px-4">
          <h3 className="font-semibold" data-testid="text-manage-plans-title">
            All Plans ({plans?.length || 0})
          </h3>
          <p className="text-sm text-muted-foreground">
            Create, edit, and manage subscription plans available to admins.
          </p>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Plan Name</TableHead>
                  <TableHead className="text-xs">Price</TableHead>
                  <TableHead className="text-xs text-center">Opp. Limit</TableHead>
                  <TableHead className="text-xs text-center">Sort Order</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans && plans.length > 0 ? (
                  plans.map((plan) => (
                    <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                      <TableCell
                        className="font-medium text-sm"
                        data-testid={`text-plan-name-${plan.id}`}
                      >
                        {plan.name}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-plan-price-${plan.id}`}>
                        {plan.price}/mo
                      </TableCell>
                      <TableCell
                        className="text-center text-sm font-mono"
                        data-testid={`text-plan-limit-${plan.id}`}
                      >
                        {plan.eventLimit}
                      </TableCell>
                      <TableCell
                        className="text-center text-sm font-mono"
                        data-testid={`text-plan-sort-${plan.id}`}
                      >
                        {plan.sortOrder}
                      </TableCell>
                      <TableCell
                        className="text-center"
                        data-testid={`text-plan-status-${plan.id}`}
                      >
                        <Badge variant={plan.active ? "default" : "secondary"}>
                          {plan.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingPlan(plan)}
                            data-testid={`button-edit-plan-${plan.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              toggleMutation.mutate({ id: plan.id, active: !plan.active })
                            }
                            disabled={toggleMutation.isPending}
                            data-testid={`button-toggle-plan-${plan.id}`}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) {
                                deleteMutation.mutate(plan.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-plan-${plan.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No plans created yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editingPlan && (
        <PlanFormDialog
          open={!!editingPlan}
          onOpenChange={(open) => {
            if (!open) setEditingPlan(null);
          }}
          plan={editingPlan}
        />
      )}
    </>
  );
}

function OwnerSubsTab() {
  const [changingOwner, setChangingOwner] = useState<OwnerSubscriptionRow | null>(null);

  const { data: ownerSubs, isLoading: subsLoading } = useQuery<OwnerSubscriptionRow[]>({
    queryKey: ["/api/owner-subscriptions"],
  });

  const { data: plans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  if (subsLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <>
      <Card>
        <CardHeader className="py-3 px-4">
          <h3 className="font-semibold" data-testid="text-owner-subs-title">
            Owner Subscriptions
          </h3>
          <p className="text-sm text-muted-foreground">
            Track subscription status and opportunity usage for all owners.
          </p>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Owner</TableHead>
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs text-center">Opps Used</TableHead>
                  <TableHead className="text-xs text-center">Usage</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ownerSubs && ownerSubs.length > 0 ? (
                  ownerSubs.map((sub) => {
                    const usagePercent = sub.planEventLimit
                      ? Math.round((sub.eventsUsed / sub.planEventLimit) * 100)
                      : null;
                    const isHealthy = sub.planId && sub.status === "active";

                    const displayName = sub.tenantName || sub.userName || "Unknown";
                    const displayEmail = sub.tenantEmail || sub.userEmail || null;
                    const rowKey = sub.tenantId || sub.userId || sub.id;

                    return (
                      <TableRow key={sub.id} data-testid={`row-owner-sub-${rowKey}`}>
                        <TableCell data-testid={`text-owner-name-${rowKey}`}>
                          <div>
                            <p className="font-medium text-sm">{displayName}</p>
                            {displayEmail && (
                              <p className="text-xs text-muted-foreground">{displayEmail}</p>
                            )}
                            {!sub.tenantId && sub.userId && (
                              <Badge variant="outline" className="text-[10px] mt-1">
                                Individual
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-owner-plan-${rowKey}`}>
                          {sub.planName ? (
                            <div>
                              <p className="text-sm font-medium">{sub.planName}</p>
                              <p className="text-xs text-muted-foreground">{sub.planPrice}/mo</p>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No Plan</span>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-center text-sm font-mono"
                          data-testid={`text-owner-events-${rowKey}`}
                        >
                          {sub.planEventLimit
                            ? `${sub.eventsUsed} / ${sub.planEventLimit}`
                            : sub.eventsUsed}
                        </TableCell>
                        <TableCell
                          className="text-center text-sm"
                          data-testid={`text-owner-usage-${rowKey}`}
                        >
                          {usagePercent !== null ? `${usagePercent}%` : "\u2014"}
                        </TableCell>
                        <TableCell
                          className="text-center"
                          data-testid={`text-owner-status-${rowKey}`}
                        >
                          <Badge variant={isHealthy ? "default" : "secondary"}>
                            {isHealthy ? "Healthy" : "No Subscription"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setChangingOwner(sub)}
                            data-testid={`button-change-plan-${rowKey}`}
                          >
                            <Settings2 className="h-3.5 w-3.5 mr-1" />
                            Change Plan
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No owner subscriptions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {changingOwner && plans && (
        <ChangePlanDialog
          open={!!changingOwner}
          onOpenChange={(open) => {
            if (!open) setChangingOwner(null);
          }}
          ownerSub={changingOwner}
          plans={plans}
        />
      )}
    </>
  );
}

const PLAN_COLORS = ["border-l-purple-500", "border-l-blue-500", "border-l-orange-500"];
const PLAN_ICONS = [Star, Shield, Zap];

function PricingPreviewTab() {
  const { data: plans, isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  const activePlans = (plans || []).filter((p) => p.active);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Eye className="h-4 w-4" />
        <span>This is a preview of what admins see on their subscription page.</span>
      </div>

      {activePlans.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No active plans to preview. Create and activate plans first.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activePlans.map((plan, idx) => {
            const Icon = PLAN_ICONS[idx % PLAN_ICONS.length];
            const borderColor = PLAN_COLORS[idx % PLAN_COLORS.length];
            const isMostPopular = idx === 1;
            const savings =
              plan.originalPrice && plan.price
                ? (() => {
                    const orig = parseFloat(plan.originalPrice.replace(/[^0-9.]/g, ""));
                    const curr = parseFloat(plan.price.replace(/[^0-9.]/g, ""));
                    if (orig > curr) return `$${(orig - curr).toFixed(2)}`;
                    return null;
                  })()
                : null;

            return (
              <Card
                key={plan.id}
                className={`relative border-l-4 ${borderColor}`}
                data-testid={`card-preview-plan-${plan.id}`}
              >
                {isMostPopular && (
                  <div className="absolute -top-2 right-3">
                    <Badge variant="default" className="text-xs">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-bold text-lg" data-testid={`text-preview-name-${plan.id}`}>
                      {plan.name}
                    </h3>
                  </div>

                  {savings && (
                    <Badge variant="outline" className="text-green-600 border-green-600/30 text-xs">
                      Save {savings}
                    </Badge>
                  )}

                  <div className="space-y-1">
                    {plan.originalPrice && (
                      <p
                        className="text-sm text-muted-foreground line-through"
                        data-testid={`text-preview-original-${plan.id}`}
                      >
                        {plan.originalPrice}
                      </p>
                    )}
                    <p className="text-3xl font-bold" data-testid={`text-preview-price-${plan.id}`}>
                      {plan.price}
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </p>
                  </div>

                  {plan.features && (plan.features as string[]).length > 0 && (
                    <ul className="space-y-2">
                      {(plan.features as string[]).map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button className="w-full" data-testid={`button-preview-get-started-${plan.id}`}>
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminSubscriptionsPage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("manage");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<SubscriptionSettings>({
    queryKey: ["/api/subscription-settings"],
  });

  const toggleGateMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", "/api/subscription-settings", {
        subscriptionGateEnabled: enabled,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-settings"] });
      toast({ title: "Subscription gate updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!isSuperAdmin) {
    return (
      <div className="p-3 sm:p-6 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <p className="text-muted-foreground">Super Admin access required.</p>
      </div>
    );
  }

  const gateEnabled = settings?.subscriptionGateEnabled ?? false;

  const tabs: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
    { key: "manage", label: "Manage Plans", icon: LayoutGrid },
    { key: "owners", label: "Owner Subs", icon: Users },
    { key: "preview", label: "Pricing Preview", icon: Sparkles },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1
          className="text-xl sm:text-2xl font-bold flex items-center gap-2"
          data-testid="text-page-title"
        >
          <CreditCard className="h-5 w-5" />
          Subscription Plans
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage plans and view owner subscriptions
        </p>
      </div>

      <Card data-testid="card-subscription-gate">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`rounded-md p-2 ${gateEnabled ? "bg-green-500/10" : "bg-muted"}`}>
                <Shield
                  className={`h-5 w-5 ${gateEnabled ? "text-green-600" : "text-muted-foreground"}`}
                />
              </div>
              <div>
                <h3 className="font-semibold text-sm" data-testid="text-gate-title">
                  Subscription Gate
                </h3>
                <p className="text-xs text-muted-foreground">
                  When enabled, admins must subscribe and pay before accessing any feature
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium ${gateEnabled ? "text-green-600" : "text-muted-foreground"}`}
                data-testid="text-gate-status"
              >
                {gateEnabled ? "Active" : "Inactive"}
              </span>
              {settingsLoading ? (
                <Skeleton className="h-5 w-9" />
              ) : (
                <Switch
                  checked={gateEnabled}
                  onCheckedChange={(checked) => toggleGateMutation.mutate(checked)}
                  disabled={toggleGateMutation.isPending}
                  data-testid="switch-subscription-gate"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <Button
                key={tab.key}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab.key)}
                data-testid={`tab-${tab.key}`}
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {activeTab === "manage" && <ManagePlansTab />}
      {activeTab === "owners" && <OwnerSubsTab />}
      {activeTab === "preview" && <PricingPreviewTab />}

      <PlanFormDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}
