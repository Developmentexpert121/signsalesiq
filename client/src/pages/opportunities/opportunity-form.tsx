import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, ArrowLeft, Save, Plus, Trash2, Layers } from "lucide-react";
import { useState, useEffect } from "react";
import { BUDGET_LABELS } from "@shared/schema";
import type { Opportunity, SignType, SignSpec } from "@shared/schema";
import { SignTypePickerDialog } from "./sign-type-picker-dialog";

const clientFormSchema = z.object({
  clientName: z.string().min(1, "Business name is required"),
  contactName: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface InlineSignSpec {
  id?: string;
  key: string;
  signType: string;
  locationType: "INTERIOR" | "EXTERIOR";
  budgetRange: string;
  signDuration: "PERMANENT" | "TEMPORARY";
  targetAudience: "SELL" | "DIRECT" | "INFORMATION";
  showSignCode: boolean;
  promptBox: string;
}

let specKeyCounter = 0;

function createDefaultSpec(): InlineSignSpec {
  return {
    key: `spec-${++specKeyCounter}`,
    signType: "",
    locationType: "EXTERIOR",
    budgetRange: "0_500",
    signDuration: "PERMANENT",
    targetAudience: "SELL",
    showSignCode: true,
    promptBox: "",
  };
}

function InlineSpecCard({
  spec,
  index,
  signTypesData,
  onChange,
  onRemove,
  canRemove,
}: {
  spec: InlineSignSpec;
  index: number;
  signTypesData: SignType[];
  onChange: (updated: InlineSignSpec) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const filteredTypes = signTypesData.filter(
    (st) => st.category === spec.locationType && st.active !== false
  );

  const handleLocationChange = (val: string) => {
    const st = signTypesData.find((s) => s.name === spec.signType);
    const newSpec = { ...spec, locationType: val as "INTERIOR" | "EXTERIOR" };
    if (st && st.category !== val) {
      newSpec.signType = "";
      newSpec.showSignCode = val === "EXTERIOR";
    }
    onChange(newSpec);
  };

  const handleSignTypeChange = (val: string) => {
    const st = signTypesData.find((s) => s.name === val);
    const updates: any = {
      ...spec,
      signType: val,
      showSignCode: st?.showSignCode ?? spec.locationType === "EXTERIOR",
    };
    if (st?.samplePrompt) {
      const currentSignType = signTypesData.find((s) => s.name === spec.signType);
      const currentIsSample =
        !spec.promptBox?.trim() || spec.promptBox === currentSignType?.samplePrompt;
      if (currentIsSample) {
        updates.promptBox = st.samplePrompt;
      }
    }
    onChange(updates);
  };

  return (
    <Card className="border-l-4 border-l-primary/40" data-testid={`card-inline-spec-${index}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Sign Spec #{index + 1}
          </h3>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              data-testid={`button-remove-spec-${index}`}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Location Type *</label>
            <Select value={spec.locationType} onValueChange={handleLocationChange}>
              <SelectTrigger data-testid={`select-spec-location-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERIOR">Interior</SelectItem>
                <SelectItem value="EXTERIOR">Exterior</SelectItem>
                <SelectItem value="VEHICLE">Vehicle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Sign Type *</label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              data-testid={`button-spec-signType-picker-${index}`}
              className="w-full justify-between font-normal"
            >
              <span className={spec.signType ? "text-foreground" : "text-muted-foreground"}>
                {spec.signType
                  ? (filteredTypes.find((st) => st.name === spec.signType)?.label ?? spec.signType)
                  : "Select sign type…"}
              </span>
              <Plus className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </div>
        </div>
        <SignTypePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          signTypes={signTypesData}
          value={spec.signType}
          onChange={handleSignTypeChange}
          defaultCategory={spec.locationType}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Budget Range *</label>
            <Select
              value={spec.budgetRange}
              onValueChange={(v) => onChange({ ...spec, budgetRange: v })}
            >
              <SelectTrigger data-testid={`select-spec-budget-${index}`}>
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Duration</label>
            <Select
              value={spec.signDuration}
              onValueChange={(v) =>
                onChange({ ...spec, signDuration: v as "PERMANENT" | "TEMPORARY" })
              }
            >
              <SelectTrigger data-testid={`select-spec-duration-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERMANENT">Permanent</SelectItem>
                <SelectItem value="TEMPORARY">Temporary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Target Audience</label>
            <Select
              value={spec.targetAudience}
              onValueChange={(v) =>
                onChange({ ...spec, targetAudience: v as "SELL" | "DIRECT" | "INFORMATION" })
              }
            >
              <SelectTrigger data-testid={`select-spec-audience-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SELL">Sell</SelectItem>
                <SelectItem value="DIRECT">Direct</SelectItem>
                <SelectItem value="INFORMATION">Information</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={spec.showSignCode}
            onCheckedChange={(v) => onChange({ ...spec, showSignCode: v })}
            data-testid={`switch-spec-signCode-${index}`}
          />
          <label className="text-sm">Show Local Sign Code Regulations</label>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description / Prompt</label>
          <Textarea
            placeholder="Describe the desired signage look and feel for this sign..."
            className="resize-none"
            rows={2}
            value={spec.promptBox}
            onChange={(e) => onChange({ ...spec, promptBox: e.target.value })}
            data-testid={`input-spec-prompt-${index}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function OpportunityFormPage() {
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id && params.id !== "new";
  const [, navigate] = useLocation();

  const { data: existingData } = useQuery<{ opportunity: Opportunity; signSpecs: SignSpec[] }>({
    queryKey: ["/api/opportunities", params.id],
    enabled: isEdit,
  });
  const existing = existingData?.opportunity;
  const existingSpecs = existingData?.signSpecs ?? [];

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      clientName: "",
      contactName: "",
      address: "",
      phone: "",
      email: "",
      notes: "",
    },
    values: existing
      ? {
          clientName: existing.clientName,
          contactName: existing.contactName ?? "",
          address: existing.address,
          phone: existing.phone ?? "",
          email: existing.email ?? "",
          notes: existing.notes ?? "",
        }
      : undefined,
  });

  const [specs, setSpecs] = useState<InlineSignSpec[]>([createDefaultSpec()]);
  const [specsInitialized, setSpecsInitialized] = useState(false);

  useEffect(() => {
    if (isEdit && existingSpecs.length > 0 && !specsInitialized) {
      setSpecs(
        existingSpecs.map((s) => ({
          id: s.id,
          key: `existing-${s.id}`,
          signType: s.signType,
          locationType: s.locationType as "INTERIOR" | "EXTERIOR",
          budgetRange: s.budgetRange,
          signDuration: s.signDuration as "PERMANENT" | "TEMPORARY",
          targetAudience: s.targetAudience as "SELL" | "DIRECT" | "INFORMATION",
          showSignCode: s.showSignCode ?? false,
          promptBox: s.promptBox ?? "",
        }))
      );
      setSpecsInitialized(true);
    } else if (isEdit && existingSpecs.length === 0 && existing && !specsInitialized) {
      setSpecs([
        {
          key: `existing-opp`,
          signType: existing.signType,
          locationType: existing.locationType as "INTERIOR" | "EXTERIOR",
          budgetRange: existing.budgetRange,
          signDuration: existing.signDuration as "PERMANENT" | "TEMPORARY",
          targetAudience: existing.targetAudience as "SELL" | "DIRECT" | "INFORMATION",
          showSignCode: existing.showSignCode ?? false,
          promptBox: existing.promptBox ?? "",
        },
      ]);
      setSpecsInitialized(true);
    }
  }, [isEdit, existingSpecs, existing, specsInitialized]);

  const { data: signTypesData } = useQuery<SignType[]>({
    queryKey: ["/api/sign-types"],
  });

  const addSpec = () => {
    setSpecs((prev) => [...prev, createDefaultSpec()]);
  };

  const removeSpec = (index: number) => {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSpec = (index: number, updated: InlineSignSpec) => {
    setSpecs((prev) => prev.map((s, i) => (i === index ? updated : s)));
  };

  const mutation = useMutation({
    mutationFn: async (clientData: ClientFormValues) => {
      const validSpecs = specs.filter((s) => s.signType);
      if (validSpecs.length === 0) {
        throw new Error("At least one sign specification with a sign type is required");
      }

      const first = validSpecs[0];
      const payload = {
        ...clientData,
        contactName: clientData.contactName || null,
        phone: clientData.phone || null,
        email: clientData.email || null,
        notes: clientData.notes || null,
        signDuration: first.signDuration,
        locationType: first.locationType,
        targetAudience: first.targetAudience,
        readDistanceFt: null,
        showSignCode: first.showSignCode,
        budgetRange: first.budgetRange,
        signType: first.signType,
        promptBox: first.promptBox || null,
        signSpecs: validSpecs.map((s, i) => ({
          id: s.id,
          signType: s.signType,
          locationType: s.locationType,
          budgetRange: s.budgetRange,
          signDuration: s.signDuration,
          targetAudience: s.targetAudience,
          showSignCode: s.showSignCode,
          promptBox: s.promptBox || null,
          sortOrder: i,
        })),
      };

      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/opportunities/${params.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/opportunities", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      navigate(`/opportunities/${data.id}`);
    },
  });

  const hasEmptySpecs = specs.some((s) => !s.signType);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(isEdit ? `/opportunities/${params.id}` : "/opportunities")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {isEdit ? "Edit Opportunity" : "New Opportunity"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isEdit ? "Update the opportunity details" : "Create a new signage sales opportunity"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">Client Information</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name *</FormLabel>
                      <FormControl>
                        <Input data-testid="input-clientName" placeholder="Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-contactName"
                          placeholder="John Smith"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-address"
                        placeholder="123 Main St, City, State"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-email"
                          type="email"
                          placeholder="client@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input data-testid="input-phone" placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="input-notes"
                        placeholder="Internal notes about this opportunity..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4" /> Sign Specifications
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSpec}
                data-testid="button-add-spec"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Sign Spec
              </Button>
            </div>

            {specs.map((spec, i) => (
              <InlineSpecCard
                key={spec.key}
                spec={spec}
                index={i}
                signTypesData={signTypesData ?? []}
                onChange={(updated) => updateSpec(i, updated)}
                onRemove={() => removeSpec(i)}
                canRemove={specs.length > 1}
              />
            ))}
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive" data-testid="text-form-error">
              {(mutation.error as Error)?.message ||
                "Failed to save. Please check your inputs and try again."}
            </p>
          )}

          {hasEmptySpecs && (
            <p className="text-sm text-amber-600">
              Each sign specification needs a sign type selected before saving.
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isEdit ? `/opportunities/${params.id}` : "/opportunities")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || hasEmptySpecs}
              data-testid="button-save"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {isEdit ? "Update" : "Create"} Opportunity
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
