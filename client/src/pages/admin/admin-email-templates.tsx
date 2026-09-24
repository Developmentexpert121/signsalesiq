import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Mail,
  Pencil,
  Eye,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  AlertTriangle,
  Search,
} from "lucide-react";
import { useState } from "react";
import type { EmailTemplate, EmailLog } from "@shared/schema";

type TabKey = "templates" | "logs";

const TEMPLATE_LABELS: Record<string, { label: string; color: string }> = {
  admin_welcome: {
    label: "Admin Welcome",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  user_welcome: {
    label: "User Welcome",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  opportunity_created: {
    label: "Opportunity Created",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  },
  opportunity_status: {
    label: "Status Update",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  plan_purchase: {
    label: "Plan Purchase",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  plan_expiration: {
    label: "Plan Expiration",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

function TemplateEditDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/email-templates/${template.id}`, {
        name,
        subject,
        bodyHtml,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: "Template updated successfully" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update template",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-edit-template">Edit Email Template</DialogTitle>
          <DialogDescription>
            Modify the email template content. Use {"{{variableName}}"} for dynamic values.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Template Name</Label>
            <Input
              data-testid="input-template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Subject Line</Label>
            <Input
              data-testid="input-template-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <Label>Available Variables</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {((template.variables as string[]) || []).map((v) => (
                <Badge key={v} variant="outline" className="text-xs font-mono">
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label>Body HTML</Label>
            <Textarea
              data-testid="input-template-body"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              className="min-h-[300px] font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              data-testid="button-save-template"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplatePreviewDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate;
}) {
  const previewHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Preview</title></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr>
<td style="background: linear-gradient(135deg, #1C4587 0%, #0d2e5e 100%);padding:28px 32px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">SignSalesIQ</h1>
<p style="margin:4px 0 0;color:#7eb8f0;font-size:13px;">Intelligent Signage Sales Platform</p>
</td>
</tr>
<tr>
<td style="padding:32px;">
<h2 style="margin:0 0 20px;color:#1C4587;font-size:20px;font-weight:600;">${template.name}</h2>
${template.bodyHtml}
</td>
</tr>
<tr>
<td style="background-color:#f8f9fb;padding:20px 32px;border-top:1px solid #e8ecf1;">
<p style="margin:0;color:#8896a8;font-size:12px;text-align:center;">
This is an automated message from SignSalesIQ. Please do not reply directly to this email.
</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body></html>`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-preview-template">
            Email Preview: {template.name}
          </DialogTitle>
          <DialogDescription>Subject: {template.subject}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 border rounded-lg overflow-hidden">
          <iframe
            srcDoc={previewHtml}
            className="w-full min-h-[500px] border-0"
            title="Email Preview"
            data-testid="iframe-email-preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplatesTab() {
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const { data: templates, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={`tpl-list-skeleton-${i}`} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {templates?.map((template) => {
          const labelInfo = TEMPLATE_LABELS[template.templateKey] || {
            label: template.templateKey,
            color: "bg-gray-100 text-gray-800",
          };
          return (
            <Card key={template.id} data-testid={`card-template-${template.templateKey}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h3 className="font-semibold text-sm">{template.name}</h3>
                      <Badge className={`text-[10px] ${labelInfo.color}`}>{labelInfo.label}</Badge>
                      {!template.active && (
                        <Badge variant="destructive" className="text-[10px]">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Subject: <span className="font-mono">{template.subject}</span>
                    </p>
                    {template.description && (
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {((template.variables as string[]) || []).map((v) => (
                        <Badge key={v} variant="outline" className="text-[10px] font-mono">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewTemplate(template)}
                      data-testid={`button-preview-${template.templateKey}`}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditTemplate(template)}
                      data-testid={`button-edit-${template.templateKey}`}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {(!templates || templates.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>
              No email templates found. Templates will be created automatically on next server
              restart.
            </p>
          </div>
        )}
      </div>

      {editTemplate && (
        <TemplateEditDialog
          open={!!editTemplate}
          onOpenChange={(open) => !open && setEditTemplate(null)}
          template={editTemplate}
        />
      )}
      {previewTemplate && (
        <TemplatePreviewDialog
          open={!!previewTemplate}
          onOpenChange={(open) => !open && setPreviewTemplate(null)}
          template={previewTemplate}
        />
      )}
    </>
  );
}

function LogsTab() {
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery<EmailLog[]>({
    queryKey: ["/api/admin/email-logs"],
  });

  const filteredLogs = logs?.filter((log) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      log.recipientEmail.toLowerCase().includes(term) ||
      (log.recipientName || "").toLowerCase().includes(term) ||
      log.subject.toLowerCase().includes(term) ||
      log.templateKey.toLowerCase().includes(term) ||
      log.status.toLowerCase().includes(term)
    );
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-600" />;
      case "skipped":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      sent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      skipped: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    };
    return variants[status] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={`tpl-log-skeleton-${i}`} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-logs"
          placeholder="Search by email, name, subject, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredLogs && filteredLogs.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const labelInfo = TEMPLATE_LABELS[log.templateKey] || {
                  label: log.templateKey,
                  color: "bg-gray-100 text-gray-800",
                };
                return (
                  <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                    <TableCell>{statusIcon(log.status)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{log.recipientName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{log.recipientEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm max-w-[250px] truncate">{log.subject}</p>
                      {log.errorMessage && (
                        <p className="text-xs text-red-600 mt-0.5 truncate max-w-[250px]">
                          {log.errorMessage}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${labelInfo.color}`}>{labelInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${statusBadge(log.status)}`}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.sentAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Send className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{search ? "No matching email logs found." : "No emails have been sent yet."}</p>
        </div>
      )}

      {filteredLogs && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filteredLogs.length} of {logs?.length || 0} log entries
        </p>
      )}
    </div>
  );
}

export default function AdminEmailTemplatesPage() {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("templates");

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Access denied. Super Admin privileges required.</p>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: typeof Mail }[] = [
    { key: "templates", label: "Templates", icon: Mail },
    { key: "logs", label: "Sent Emails", icon: Send },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Email Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage email templates and view sent email history
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            data-testid={`tab-${tab.key}`}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "logs" && <LogsTab />}
    </div>
  );
}
