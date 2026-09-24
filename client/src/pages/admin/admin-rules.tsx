import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ENABLE_GBB_TIERS } from "@/lib/featureFlags";
import {
  Plus,
  Loader2,
  Settings,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  Building2,
  Copy,
} from "lucide-react";
import { BUDGET_LABELS } from "@shared/schema";
import type { ProductRule, SignType } from "@shared/schema";
import { useState } from "react";

function ProductTagList({
  products,
  onChange,
  tierLabel,
  tierColor,
  testIdPrefix,
  disabled,
}: {
  products: string[];
  onChange: (products: string[]) => void;
  tierLabel: string;
  tierColor: string;
  testIdPrefix: string;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");

  const addProduct = () => {
    const val = inputValue.trim();
    if (val && !products.includes(val)) {
      onChange([...products, val]);
      setInputValue("");
    }
  };

  const removeProduct = (index: number) => {
    onChange(products.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addProduct();
    }
  };

  return (
    <div className={`space-y-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {products.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {products.map((product, i) => (
            <Badge
              key={`${testIdPrefix}-product-${i}-${product}`}
              variant="secondary"
              className="gap-1 pr-1"
              data-testid={`${testIdPrefix}-product-${i}`}
            >
              <span className="text-xs">{product}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 no-default-hover-elevate no-default-active-elevate"
                onClick={() => removeProduct(i)}
                data-testid={`${testIdPrefix}-remove-${i}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add ${tierLabel.toLowerCase()} product description...`}
          className="text-sm"
          data-testid={`${testIdPrefix}-input`}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={addProduct}
          disabled={!inputValue.trim()}
          data-testid={`${testIdPrefix}-add`}
        >
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

function TierSection({
  tierLabel,
  tierColor,
  enabled,
  signType,
  onSignTypeChange,
  products,
  onProductsChange,
  allSignTypes,
  baseSignType,
  testIdPrefix,
}: {
  tierLabel: string;
  tierColor: string;
  enabled: boolean;
  signType: string;
  onSignTypeChange: (v: string) => void;
  products: string[];
  onProductsChange: (p: string[]) => void;
  allSignTypes: SignType[];
  baseSignType: string;
  testIdPrefix: string;
}) {
  const disabled = !enabled;

  return (
    <div className={`space-y-3 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${tierColor}`} />
        <Label className="text-sm font-semibold">{tierLabel}</Label>
      </div>

      <div className="ml-4 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Sign Type for this tier</Label>
          <Select
            value={signType || "__base__"}
            onValueChange={(v) => onSignTypeChange(v === "__base__" ? "" : v)}
          >
            <SelectTrigger className="mt-1" data-testid={`${testIdPrefix}-sign-type`}>
              <SelectValue placeholder="Same as base sign type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__base__">
                Same as base (
                {allSignTypes.find((s) => s.name === baseSignType)?.label || baseSignType})
              </SelectItem>
              {allSignTypes.map((st) => (
                <SelectItem key={st.name} value={st.name}>
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Product descriptions (optional)</Label>
          <div className="mt-1">
            <ProductTagList
              products={products}
              onChange={onProductsChange}
              tierLabel={tierLabel}
              tierColor={tierColor}
              testIdPrefix={testIdPrefix}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({
  rule,
  onClose,
  apiBase,
}: {
  rule?: ProductRule;
  onClose: () => void;
  apiBase: string;
}) {
  const { toast } = useToast();
  const [locationType, setLocationType] = useState<string>(rule?.locationType ?? "EXTERIOR");
  const [signType, setSignType] = useState<string>(rule?.signType ?? "");
  const [budgetRange, setBudgetRange] = useState<string>(rule?.budgetRange ?? "2K_5K");
  const [enabledTiers, setEnabledTiers] = useState<string[]>(rule?.enabledTiers ?? []);
  const [goodSignType, setGoodSignType] = useState<string>(rule?.goodSignType ?? "");
  const [betterSignType, setBetterSignType] = useState<string>(rule?.betterSignType ?? "");
  const [bestSignType, setBestSignType] = useState<string>(rule?.bestSignType ?? "");
  const [goodProducts, setGoodProducts] = useState<string[]>(rule?.goodProducts ?? []);
  const [betterProducts, setBetterProducts] = useState<string[]>(rule?.betterProducts ?? []);
  const [bestProducts, setBestProducts] = useState<string[]>(rule?.bestProducts ?? []);

  const toggleTier = (tier: string) => {
    setEnabledTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        locationType,
        signType,
        budgetRange,
        enabledTiers,
        goodSignType: enabledTiers.includes("GOOD") ? goodSignType || null : null,
        betterSignType: enabledTiers.includes("BETTER") ? betterSignType || null : null,
        bestSignType: enabledTiers.includes("BEST") ? bestSignType || null : null,
        goodProducts: enabledTiers.includes("GOOD") ? goodProducts : [],
        betterProducts: enabledTiers.includes("BETTER") ? betterProducts : [],
        bestProducts: enabledTiers.includes("BEST") ? bestProducts : [],
      };
      if (rule) {
        await apiRequest("PATCH", `${apiBase}/${rule.id}`, data);
      } else {
        await apiRequest("POST", apiBase, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/rules/merged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules"] });
      toast({ title: rule ? "Rule updated" : "Rule created" });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: signTypesData } = useQuery<SignType[]>({
    queryKey: ["/api/sign-types"],
  });
  const allSignTypes = (signTypesData ?? [])
    .filter((st) => st.category === locationType)
    .sort((a, b) => a.label.localeCompare(b.label));
  const isValid = !!signType;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Location Type</Label>
          <Select
            value={locationType}
            onValueChange={(val) => {
              setLocationType(val);
              setSignType("");
            }}
          >
            <SelectTrigger data-testid="select-rule-location">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INTERIOR">Interior</SelectItem>
              <SelectItem value="EXTERIOR">Exterior</SelectItem>
              <SelectItem value="VEHICLE">Vehicle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Base Sign Type</Label>
          <Select value={signType} onValueChange={setSignType}>
            <SelectTrigger data-testid="select-rule-sign">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {allSignTypes.map((st) => (
                <SelectItem key={st.name} value={st.name}>
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Budget</Label>
          <Select value={budgetRange} onValueChange={setBudgetRange}>
            <SelectTrigger data-testid="select-rule-budget">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BUDGET_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {ENABLE_GBB_TIERS && (
        <>
          <div className="border rounded-md p-4 space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Tier Options (Optional)</h4>
              <p className="text-xs text-muted-foreground">
                Enable tiers to present Good/Better/Best options. Each tier can use a different sign
                type. If no tiers are enabled, a single mockup will be generated using the base sign
                type.
              </p>
            </div>

            <div className="flex items-center gap-4">
              {[
                { tier: "GOOD", label: "Good", color: "bg-yellow-500" },
                { tier: "BETTER", label: "Better", color: "bg-blue-500" },
                { tier: "BEST", label: "Best", color: "bg-green-500" },
              ].map(({ tier, label, color }) => (
                <label
                  key={tier}
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`checkbox-tier-${tier.toLowerCase()}`}
                >
                  <Checkbox
                    checked={enabledTiers.includes(tier)}
                    onCheckedChange={() => toggleTier(tier)}
                  />
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>

            {enabledTiers.length === 0 && (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
                No tiers enabled — a single mockup will be generated using the base sign type
                selected above.
              </p>
            )}
          </div>

          {enabledTiers.length > 0 && (
            <div className="border rounded-md p-4 space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Tier Configuration</h4>
                <p className="text-xs text-muted-foreground">
                  Select a sign type for each tier. If left as "Same as base", it uses the base sign
                  type above.
                </p>
              </div>

              {enabledTiers.includes("GOOD") && (
                <>
                  <TierSection
                    tierLabel="Good"
                    tierColor="bg-yellow-500"
                    enabled={true}
                    signType={goodSignType}
                    onSignTypeChange={setGoodSignType}
                    products={goodProducts}
                    onProductsChange={setGoodProducts}
                    allSignTypes={allSignTypes}
                    baseSignType={signType}
                    testIdPrefix="good"
                  />
                  {(enabledTiers.includes("BETTER") || enabledTiers.includes("BEST")) && (
                    <div className="border-t" />
                  )}
                </>
              )}

              {enabledTiers.includes("BETTER") && (
                <>
                  <TierSection
                    tierLabel="Better"
                    tierColor="bg-blue-500"
                    enabled={true}
                    signType={betterSignType}
                    onSignTypeChange={setBetterSignType}
                    products={betterProducts}
                    onProductsChange={setBetterProducts}
                    allSignTypes={allSignTypes}
                    baseSignType={signType}
                    testIdPrefix="better"
                  />
                  {enabledTiers.includes("BEST") && <div className="border-t" />}
                </>
              )}

              {enabledTiers.includes("BEST") && (
                <TierSection
                  tierLabel="Best"
                  tierColor="bg-green-500"
                  enabled={true}
                  signType={bestSignType}
                  onSignTypeChange={setBestSignType}
                  products={bestProducts}
                  onProductsChange={setBestProducts}
                  allSignTypes={allSignTypes}
                  baseSignType={signType}
                  testIdPrefix="best"
                />
              )}
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-rule">
          Cancel
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !isValid}
          data-testid="button-save-rule"
        >
          {mutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          {rule ? "Update" : "Create"} Rule
        </Button>
      </div>
    </div>
  );
}

function TierDetail({
  label,
  color,
  signType,
  products,
}: {
  label: string;
  color: string;
  signType: string | null;
  products: string[];
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs font-semibold">{label}</span>
        {signType && (
          <Badge variant="outline" className="text-xs">
            {signType}
          </Badge>
        )}
      </div>
      {products.length > 0 && (
        <div className="flex flex-wrap gap-1 ml-4">
          {products.map((p, i) => (
            <Badge key={`rule-product-${i}-${p}`} variant="secondary" className="text-xs">
              {p}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({
  rule,
  onEdit,
  onDelete,
  isDeleting,
  isGlobal,
  signTypeLabels,
}: {
  rule: ProductRule;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isGlobal?: boolean;
  signTypeLabels: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const enabledTiers = ENABLE_GBB_TIERS ? (rule.enabledTiers ?? []) : [];
  const tierCount = enabledTiers.length;

  return (
    <Card data-testid={`card-rule-${rule.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            {isGlobal && (
              <Badge variant="outline" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                Global
              </Badge>
            )}
            {rule.tenantId && (
              <Badge variant="outline" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />
                Custom
              </Badge>
            )}
            <Badge variant="secondary">{rule.locationType}</Badge>
            <Badge variant="outline">{signTypeLabels[rule.signType] ?? rule.signType}</Badge>
            <Badge variant="outline">{BUDGET_LABELS[rule.budgetRange] ?? rule.budgetRange}</Badge>
            <span className="text-xs text-muted-foreground">
              {tierCount > 0 ? `${tierCount} tier${tierCount !== 1 ? "s" : ""}` : "Single mockup"}
            </span>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-expand-rule-${rule.id}`}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              data-testid={`button-edit-rule-${rule.id}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={isDeleting}
              data-testid={`button-delete-rule-${rule.id}`}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {!expanded && tierCount > 0 && (
          <div className="space-y-1 text-xs overflow-hidden">
            {enabledTiers.includes("GOOD") && (
              <div className="flex items-start gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1 shrink-0" />
                <span className="text-muted-foreground truncate min-w-0 flex-1">
                  {rule.goodSignType
                    ? (signTypeLabels[rule.goodSignType] ?? rule.goodSignType)
                    : "Base type"}
                  {rule.goodProducts.length > 0 ? ` · ${rule.goodProducts.join(", ")}` : ""}
                </span>
              </div>
            )}
            {enabledTiers.includes("BETTER") && (
              <div className="flex items-start gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                <span className="text-muted-foreground truncate min-w-0 flex-1">
                  {rule.betterSignType
                    ? (signTypeLabels[rule.betterSignType] ?? rule.betterSignType)
                    : "Base type"}
                  {rule.betterProducts.length > 0 ? ` · ${rule.betterProducts.join(", ")}` : ""}
                </span>
              </div>
            )}
            {enabledTiers.includes("BEST") && (
              <div className="flex items-start gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0" />
                <span className="text-muted-foreground truncate min-w-0 flex-1">
                  {rule.bestSignType
                    ? (signTypeLabels[rule.bestSignType] ?? rule.bestSignType)
                    : "Base type"}
                  {rule.bestProducts.length > 0 ? ` · ${rule.bestProducts.join(", ")}` : ""}
                </span>
              </div>
            )}
          </div>
        )}

        {expanded && tierCount > 0 && (
          <div className="space-y-3 border-t pt-3">
            {enabledTiers.includes("GOOD") && (
              <TierDetail
                label="Good"
                color="bg-yellow-500"
                signType={
                  rule.goodSignType
                    ? (signTypeLabels[rule.goodSignType] ?? rule.goodSignType)
                    : null
                }
                products={rule.goodProducts}
              />
            )}
            {enabledTiers.includes("BETTER") && (
              <TierDetail
                label="Better"
                color="bg-blue-500"
                signType={
                  rule.betterSignType
                    ? (signTypeLabels[rule.betterSignType] ?? rule.betterSignType)
                    : null
                }
                products={rule.betterProducts}
              />
            )}
            {enabledTiers.includes("BEST") && (
              <TierDetail
                label="Best"
                color="bg-green-500"
                signType={
                  rule.bestSignType
                    ? (signTypeLabels[rule.bestSignType] ?? rule.bestSignType)
                    : null
                }
                products={rule.bestProducts}
              />
            )}
          </div>
        )}

        {expanded && tierCount === 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              No tiers configured — generates a single mockup using the base sign type.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GlobalTemplateCard({
  rule,
  signTypeLabels,
  onCopy,
  isCopying,
  alreadyCopied,
}: {
  rule: ProductRule;
  signTypeLabels: Record<string, string>;
  onCopy: (globalRuleId: string) => void;
  isCopying: boolean;
  alreadyCopied: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const enabledTiers = ENABLE_GBB_TIERS ? (rule.enabledTiers ?? []) : [];
  const tierCount = enabledTiers.length;

  return (
    <Card data-testid={`card-global-rule-${rule.id}`} className={alreadyCopied ? "opacity-50" : ""}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            <Badge variant="outline" className="text-xs">
              <Globe className="h-3 w-3 mr-1" />
              Template
            </Badge>
            <Badge variant="secondary">{rule.locationType}</Badge>
            <Badge variant="outline">{signTypeLabels[rule.signType] ?? rule.signType}</Badge>
            <Badge variant="outline">{BUDGET_LABELS[rule.budgetRange] ?? rule.budgetRange}</Badge>
            <span className="text-xs text-muted-foreground">
              {tierCount > 0 ? `${tierCount} tier${tierCount !== 1 ? "s" : ""}` : "Single mockup"}
            </span>
          </div>
          <div className="flex gap-1 items-center shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-expand-global-${rule.id}`}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {alreadyCopied ? (
              <Badge variant="secondary" className="text-xs ml-1">
                Already customized
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCopy(rule.id)}
                disabled={isCopying}
                data-testid={`button-copy-rule-${rule.id}`}
              >
                {isCopying ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                Copy & Customize
              </Button>
            )}
          </div>
        </div>

        {!expanded && tierCount > 0 && (
          <div className="space-y-1 text-xs overflow-hidden">
            {enabledTiers.includes("GOOD") && (
              <div className="flex items-start gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1 shrink-0" />
                <span className="text-muted-foreground truncate min-w-0 flex-1">
                  {rule.goodSignType
                    ? (signTypeLabels[rule.goodSignType] ?? rule.goodSignType)
                    : "Base type"}
                  {rule.goodProducts.length > 0 ? ` · ${rule.goodProducts.join(", ")}` : ""}
                </span>
              </div>
            )}
            {enabledTiers.includes("BETTER") && (
              <div className="flex items-start gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                <span className="text-muted-foreground truncate min-w-0 flex-1">
                  {rule.betterSignType
                    ? (signTypeLabels[rule.betterSignType] ?? rule.betterSignType)
                    : "Base type"}
                  {rule.betterProducts.length > 0 ? ` · ${rule.betterProducts.join(", ")}` : ""}
                </span>
              </div>
            )}
            {enabledTiers.includes("BEST") && (
              <div className="flex items-start gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0" />
                <span className="text-muted-foreground truncate min-w-0 flex-1">
                  {rule.bestSignType
                    ? (signTypeLabels[rule.bestSignType] ?? rule.bestSignType)
                    : "Base type"}
                  {rule.bestProducts.length > 0 ? ` · ${rule.bestProducts.join(", ")}` : ""}
                </span>
              </div>
            )}
          </div>
        )}

        {expanded && tierCount > 0 && (
          <div className="space-y-3 border-t pt-3">
            {enabledTiers.includes("GOOD") && (
              <TierDetail
                label="Good"
                color="bg-yellow-500"
                signType={
                  rule.goodSignType
                    ? (signTypeLabels[rule.goodSignType] ?? rule.goodSignType)
                    : null
                }
                products={rule.goodProducts}
              />
            )}
            {enabledTiers.includes("BETTER") && (
              <TierDetail
                label="Better"
                color="bg-blue-500"
                signType={
                  rule.betterSignType
                    ? (signTypeLabels[rule.betterSignType] ?? rule.betterSignType)
                    : null
                }
                products={rule.betterProducts}
              />
            )}
            {enabledTiers.includes("BEST") && (
              <TierDetail
                label="Best"
                color="bg-green-500"
                signType={
                  rule.bestSignType
                    ? (signTypeLabels[rule.bestSignType] ?? rule.bestSignType)
                    : null
                }
                products={rule.bestProducts}
              />
            )}
          </div>
        )}

        {expanded && tierCount === 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              No tiers configured — generates a single mockup using the base sign type.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GlobalTemplatesSection({
  globalRules,
  signTypeLabels,
  signTypesData,
  tenantRuleKeys,
  onCopy,
  isCopying,
}: {
  globalRules: ProductRule[];
  signTypeLabels: Record<string, string>;
  signTypesData: SignType[];
  tenantRuleKeys: Set<string>;
  onCopy: (id: string) => void;
  isCopying: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("ALL");

  const alreadyCopiedSignTypes = new Set<string>();
  for (const key of Array.from(tenantRuleKeys)) {
    const parts = key.split("|");
    alreadyCopiedSignTypes.add(parts[1]);
  }

  const sorted = [...globalRules].sort((a, b) => {
    const labelA = signTypeLabels[a.signType] ?? a.signType;
    const labelB = signTypeLabels[b.signType] ?? b.signType;
    return labelA.localeCompare(labelB);
  });

  const filtered = sorted.filter((rule) => {
    const label = signTypeLabels[rule.signType] ?? rule.signType;
    if (locationFilter !== "ALL" && rule.locationType !== locationFilter) return false;
    if (searchTerm && !label.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5" /> Global Templates
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Copy a sign type to your account, then customize the budget range, tiers, and products.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search sign types..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-templates"
        />
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-location-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="EXTERIOR">Exterior</SelectItem>
            <SelectItem value="INTERIOR">Interior</SelectItem>
            <SelectItem value="VEHICLE">Vehicle</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center">
          {filtered.length} sign type{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-1.5">
        {filtered.map((rule) => {
          const label = signTypeLabels[rule.signType] ?? rule.signType;
          const isCopied = alreadyCopiedSignTypes.has(rule.signType);

          return (
            <div
              key={rule.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${isCopied ? "opacity-50 bg-muted/30" : "bg-card"}`}
              data-testid={`template-row-${rule.signType}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {rule.locationType}
                </Badge>
                <span className="font-medium text-sm">{label}</span>
              </div>
              {isCopied ? (
                <Badge variant="outline" className="text-xs">
                  Already copied
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(rule.id)}
                  disabled={isCopying}
                  data-testid={`button-copy-rule-${rule.id}`}
                >
                  {isCopying ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  Copy & Customize
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminRulesPage() {
  const { isSuperAdmin, isTenantAdmin } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<ProductRule | undefined>();

  const apiBase = isSuperAdmin ? "/api/admin/rules" : "/api/tenant/rules";

  const { data: signTypesData } = useQuery<SignType[]>({
    queryKey: ["/api/sign-types"],
  });
  const signTypeLabels = Object.fromEntries((signTypesData ?? []).map((st) => [st.name, st.label]));

  const { data: rules, isLoading } = useQuery<ProductRule[]>({
    queryKey: [apiBase],
    enabled: isSuperAdmin,
  });

  const { data: tenantRules, isLoading: tenantLoading } = useQuery<ProductRule[]>({
    queryKey: ["/api/tenant/rules"],
    enabled: isTenantAdmin && !isSuperAdmin,
  });

  const { data: globalRules, isLoading: globalLoading } = useQuery<ProductRule[]>({
    queryKey: ["/api/admin/rules-public"],
    enabled: isTenantAdmin && !isSuperAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiBase}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/rules"] });
      toast({ title: "Rule deleted" });
    },
  });

  const copyMutation = useMutation({
    mutationFn: async (globalRuleId: string) => {
      await apiRequest("POST", "/api/tenant/rules/copy", { globalRuleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/rules"] });
      toast({ title: "Rule copied — you can now customize it" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!isSuperAdmin && !isTenantAdmin) {
    return (
      <div className="p-3 sm:p-6 text-center">
        <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const loading = isSuperAdmin ? isLoading : tenantLoading || globalLoading;

  const tenantRuleKeys = new Set(
    (tenantRules ?? []).map((r) => `${r.locationType}|${r.signType}|${r.budgetRange}`)
  );

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"
            data-testid="text-rules-title"
          >
            <Settings className="h-6 w-6" /> Product Rules Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
            {isSuperAdmin ? (
              <>
                <Globe className="h-3.5 w-3.5" />
                Configure global default rules. Owners can copy these and customize them.
              </>
            ) : (
              <>
                <Building2 className="h-3.5 w-3.5" />
                Manage your product rules. Copy from global templates or create your own.
              </>
            )}
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditRule(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="button-add-rule">
              <Plus className="h-4 w-4 mr-2" /> Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editRule ? "Edit Rule" : "New Product Rule"}</DialogTitle>
            </DialogHeader>
            <RuleEditor
              rule={editRule}
              onClose={() => {
                setDialogOpen(false);
                setEditRule(undefined);
              }}
              apiBase={apiBase}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={`rules-skeleton-${i}`}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isSuperAdmin ? (
        (rules?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Settings className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">No product rules configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add global rules to define default products for each sign type / budget combination.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rules?.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => {
                  setEditRule(rule);
                  setDialogOpen(true);
                }}
                onDelete={() => {
                  if (confirm("Delete this rule?")) {
                    deleteMutation.mutate(rule.id);
                  }
                }}
                isDeleting={deleteMutation.isPending}
                isGlobal={!rule.tenantId}
                signTypeLabels={signTypeLabels}
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-8">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Your Rules
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                These are your account's product rules. Edit them to customize tiers, sign types,
                and products for your team.
              </p>
            </div>

            {(tenantRules?.length ?? 0) === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Settings className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <h3 className="font-medium mb-1 text-sm">No rules yet</h3>
                  <p className="text-xs text-muted-foreground">
                    Copy from the global templates below, or create your own with the "Add Rule"
                    button above.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {tenantRules?.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onEdit={() => {
                      setEditRule(rule);
                      setDialogOpen(true);
                    }}
                    onDelete={() => {
                      if (confirm("Delete this rule?")) {
                        deleteMutation.mutate(rule.id);
                      }
                    }}
                    isDeleting={deleteMutation.isPending}
                    signTypeLabels={signTypeLabels}
                  />
                ))}
              </div>
            )}
          </div>

          {(globalRules?.length ?? 0) > 0 && (
            <GlobalTemplatesSection
              globalRules={globalRules ?? []}
              signTypeLabels={signTypeLabels}
              signTypesData={signTypesData ?? []}
              tenantRuleKeys={tenantRuleKeys}
              onCopy={(id) => copyMutation.mutate(id)}
              isCopying={copyMutation.isPending}
            />
          )}
        </div>
      )}
    </div>
  );
}
