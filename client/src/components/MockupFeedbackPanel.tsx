import {
  FREE_TEXT_REQUIRED_KEY,
  MOCKUP_ISSUE_GROUPS,
  MOCKUP_ISSUE_OPTIONS,
} from "@shared/mockupIssueOptions";
import type { Output } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { Loader2, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MockupFeedbackPanelProps {
  output: Output;
  opportunityId: string;
  // Regeneration needs a linked sign spec; legacy opportunity-level outputs
  // can only collect feedback.
  canRegenerate: boolean;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}

export function MockupFeedbackPanel({
  output,
  opportunityId,
  canRegenerate,
  onClose,
  onPendingChange,
}: MockupFeedbackPanelProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [pendingRegen, setPendingRegen] = useState(false);

  const mutation = useMutation({
    mutationFn: async (regenerate: boolean) => {
      const res = await apiRequest("POST", `/api/outputs/${output.id}/feedback`, {
        issues: Array.from(selected),
        notes: notes.trim() || undefined,
        regenerate,
      });
      return res.json();
    },
    onMutate: (regenerate) => {
      setPendingRegen(regenerate);
      onPendingChange(true);
    },
    onSuccess: async (data: any, regenerate) => {
      if (regenerate) {
        await queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
        if (data?.aiFailureReason) {
          toast({
            title: "Regeneration failed",
            description: data.aiFailureReason,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Mockup regenerated",
          description: "A new version was generated using your feedback.",
        });
      } else {
        toast({
          title: "Feedback submitted",
          description: "Your report was recorded for review.",
        });
      }

      onClose();
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to submit feedback",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      onPendingChange(false);
    },
  });

  const isPending = mutation.isPending;
  const needsNotes = selected.has(FREE_TEXT_REQUIRED_KEY) && !notes.trim();
  const canSubmit = (selected.size > 0 || notes.trim().length > 0) && !needsNotes && !isPending;

  const toggleIssue = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const submit = (regenerate: boolean) => {
    mutation.mutate(regenerate);
  };

  return (
    <section
      className="mt-4 rounded-lg border bg-muted/20 p-4"
      aria-label="Report a problem with this mockup"
      data-testid={`mockup-feedback-panel-${output.id}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold">Report a problem with this mockup</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Select everything that looks wrong. Your feedback guides the regeneration.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          disabled={isPending}
          aria-label="Close mockup feedback"
          data-testid="button-close-mockup-feedback"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MOCKUP_ISSUE_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-2">
              {MOCKUP_ISSUE_OPTIONS.filter((option) => option.group === group.id).map((option) => (
                <label key={option.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.has(option.key)}
                    onCheckedChange={(value) => toggleIssue(option.key, !!value)}
                    disabled={isPending}
                    data-testid={`checkbox-issue-${option.key}`}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Describe the problem {selected.has(FREE_TEXT_REQUIRED_KEY) ? "(required)" : "(optional)"}
        </p>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Tell us what looks wrong or what you expected to see..."
          rows={3}
          maxLength={2000}
          disabled={isPending}
          data-testid="textarea-feedback-notes"
        />
        {needsNotes && (
          <p className="mt-1 text-xs text-destructive">
            Please describe the problem when selecting "Something else".
          </p>
        )}
      </div>

      {isPending && pendingRegen && (
        <div className="mt-4 flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          Regenerating mockup. You can continue reviewing this opportunity while it finishes.
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => submit(false)}
          disabled={!canSubmit}
          data-testid="button-submit-feedback-only"
        >
          {isPending && !pendingRegen && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit feedback only
        </Button>
        {canRegenerate && (
          <Button
            onClick={() => submit(true)}
            disabled={!canSubmit}
            data-testid="button-submit-and-regenerate"
          >
            {isPending && pendingRegen ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Submit & Regenerate
          </Button>
        )}
      </div>
    </section>
  );
}
