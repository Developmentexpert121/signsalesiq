import type { ActivityLog } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  FileText,
  FolderOpen,
  Upload,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";

interface UsageUser {
  user_id: string;
  username: string;
  user_name: string;
  email: string;
  role: string;
  user_created_at: string;
  tenant_id: string | null;
  tenant_name: string | null;
  opportunities_count: string;
  mockups_count: string;
  ai_mockups_count: string;
  exports_count: string;
  assets_count: string;
  last_opportunity_at: string | null;
  last_mockup_at: string | null;
  last_export_at: string | null;
}

interface UsageTenant {
  tenant_id: string;
  tenant_name: string;
  user_count: string;
  opportunities_count: string;
  mockups_count: string;
  exports_count: string;
}

interface ActivityItem {
  action: string;
  timestamp: string;
  user_id: string;
  username: string;
  user_name: string;
  tenant_name: string | null;
  resource_id: string;
  detail: string;
  extra: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: typeof FolderOpen; color: string }> = {
  opportunity_created: { label: "Created Opportunity", icon: FolderOpen, color: "text-green-600" },
  opportunity_updated: { label: "Updated Opportunity", icon: FolderOpen, color: "text-blue-600" },
  mockup_generated: { label: "Generated Mockup", icon: Zap, color: "text-purple-600" },
  pdf_exported: { label: "Exported PDF", icon: FileText, color: "text-orange-600" },
  asset_uploaded: { label: "Uploaded Asset", icon: Upload, color: "text-cyan-600" },
};

const COST_PER_1K_TOKENS = 0.00125;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" | "destructive" {
  if (role === "SUPER_ADMIN") return "destructive";
  if (role === "ADMIN") return "default";
  return "secondary";
}

function roleLabel(role: string) {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAdmin\b/, "Admin");
}

function estimateCost(tokens: number) {
  return (tokens / 1000) * COST_PER_1K_TOKENS;
}

function TenantUsageCard({ tenant, users }: { tenant: UsageTenant; users: UsageUser[] }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card data-testid={`card-tenant-usage-${tenant.tenant_id}`}>
      <CardHeader className="cursor-pointer py-3 px-4" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{tenant.tenant_name}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
            <span
              className="flex items-center gap-1"
              data-testid={`text-tenant-users-${tenant.tenant_id}`}
            >
              <Users className="h-3 w-3" /> {tenant.user_count} users
            </span>
            <span className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" /> {tenant.opportunities_count} opps
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> {tenant.mockups_count} mockups
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" /> {tenant.exports_count} exports
            </span>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              data-testid={`table-tenant-users-${tenant.tenant_id}`}
            >
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">User</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium text-center">Opportunities</th>
                  <th className="py-2 pr-3 font-medium text-center">Mockups</th>
                  <th className="py-2 pr-3 font-medium text-center">AI Mockups</th>
                  <th className="py-2 pr-3 font-medium text-center">Exports</th>
                  <th className="py-2 pr-3 font-medium text-center">Assets</th>
                  <th className="py-2 pr-3 font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const lastDates = [
                    u.last_opportunity_at,
                    u.last_mockup_at,
                    u.last_export_at,
                  ].filter(Boolean);
                  const lastActivity =
                    lastDates.length > 0
                      ? lastDates.sort(
                          (a, b) => new Date(b!).getTime() - new Date(a!).getTime()
                        )[0]!
                      : null;

                  return (
                    <tr
                      key={u.user_id}
                      className="border-b last:border-0 hover:bg-muted/30"
                      data-testid={`row-user-${u.user_id}`}
                    >
                      <td className="py-2 pr-3">
                        <div>
                          <p className="font-medium">{u.user_name || u.username}</p>
                          {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={roleBadgeVariant(u.role)} className="text-[10px]">
                          {roleLabel(u.role)}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-center font-mono">{u.opportunities_count}</td>
                      <td className="py-2 pr-3 text-center font-mono">{u.mockups_count}</td>
                      <td className="py-2 pr-3 text-center font-mono">{u.ai_mockups_count}</td>
                      <td className="py-2 pr-3 text-center font-mono">{u.exports_count}</td>
                      <td className="py-2 pr-3 text-center font-mono">{u.assets_count}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {lastActivity ? (
                          timeAgo(lastActivity)
                        ) : (
                          <span className="italic">No activity</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function UsageTab() {
  const { isSuperAdmin } = useAuth();

  const { data, isLoading } = useQuery<{ users: UsageUser[]; tenants: UsageTenant[] }>({
    queryKey: ["/api/admin/usage"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={`usage-stat-skeleton-${i}`} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  const totalUsers = data.users.length;
  const totalOpps = data.users.reduce((sum, u) => sum + parseInt(u.opportunities_count, 10), 0);
  const totalMockups = data.users.reduce((sum, u) => sum + parseInt(u.mockups_count, 10), 0);
  const totalExports = data.users.reduce((sum, u) => sum + parseInt(u.exports_count, 10), 0);

  const tenantGroups = new Map<string, UsageUser[]>();
  data.users.forEach((u) => {
    const key = u.tenant_id || "__none__";
    if (!tenantGroups.has(key)) tenantGroups.set(key, []);
    tenantGroups.get(key)?.push(u);
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card data-testid="card-stat-users">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Total Users</span>
            </div>
            <p className="text-2xl font-bold">{totalUsers}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-opportunities">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FolderOpen className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Opportunities</span>
            </div>
            <p className="text-2xl font-bold">{totalOpps}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-mockups">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Mockups</span>
            </div>
            <p className="text-2xl font-bold">{totalMockups}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-exports">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Exports</span>
            </div>
            <p className="text-2xl font-bold">{totalExports}</p>
          </CardContent>
        </Card>
      </div>

      {isSuperAdmin && data.tenants.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            By Owner
          </h3>
          {data.tenants.map((tenant) => (
            <TenantUsageCard
              key={tenant.tenant_id}
              tenant={tenant}
              users={tenantGroups.get(tenant.tenant_id) || []}
            />
          ))}
          {tenantGroups.has("__none__") && (
            <TenantUsageCard
              tenant={{
                tenant_id: "__none__",
                tenant_name: "No Owner",
                user_count: String(tenantGroups.get("__none__")?.length),
                opportunities_count: "0",
                mockups_count: "0",
                exports_count: "0",
              }}
              users={tenantGroups.get("__none__")!}
            />
          )}
        </div>
      )}

      {!isSuperAdmin && data.users.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <h3 className="font-semibold">Team Usage</h3>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-team-users">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">User</th>
                    <th className="py-2 pr-3 font-medium">Role</th>
                    <th className="py-2 pr-3 font-medium text-center">Opportunities</th>
                    <th className="py-2 pr-3 font-medium text-center">Mockups</th>
                    <th className="py-2 pr-3 font-medium text-center">AI Mockups</th>
                    <th className="py-2 pr-3 font-medium text-center">Exports</th>
                    <th className="py-2 pr-3 font-medium text-center">Assets</th>
                    <th className="py-2 pr-3 font-medium">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => {
                    const lastDates = [
                      u.last_opportunity_at,
                      u.last_mockup_at,
                      u.last_export_at,
                    ].filter(Boolean);
                    const lastActivity =
                      lastDates.length > 0
                        ? lastDates.sort(
                            (a, b) => new Date(b!).getTime() - new Date(a!).getTime()
                          )[0]!
                        : null;
                    return (
                      <tr
                        key={u.user_id}
                        className="border-b last:border-0 hover:bg-muted/30"
                        data-testid={`row-user-${u.user_id}`}
                      >
                        <td className="py-2 pr-3">
                          <p className="font-medium">{u.user_name || u.username}</p>
                          {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={roleBadgeVariant(u.role)} className="text-[10px]">
                            {roleLabel(u.role)}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-center font-mono">{u.opportunities_count}</td>
                        <td className="py-2 pr-3 text-center font-mono">{u.mockups_count}</td>
                        <td className="py-2 pr-3 text-center font-mono">{u.ai_mockups_count}</td>
                        <td className="py-2 pr-3 text-center font-mono">{u.exports_count}</td>
                        <td className="py-2 pr-3 text-center font-mono">{u.assets_count}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {lastActivity ? (
                            timeAgo(lastActivity)
                          ) : (
                            <span className="italic">No activity</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActivityTab() {
  const [, navigate] = useLocation();
  const [filterUser, setFilterUser] = useState<string>("");

  const { data, isLoading } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ["/api/admin/activity"],
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={`usage-row-skeleton-${i}`} className="h-16" />
        ))}
      </div>
    );
  }

  if (!data || data.activities.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No activity recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  const uniqueUsers = Array.from(
    new Map(
      data.activities.map((a) => [a.user_id, { id: a.user_id, name: a.user_name || a.username }])
    ).values()
  );

  const filtered = filterUser
    ? data.activities.filter((a) => a.user_id === filterUser)
    : data.activities;

  let lastDateLabel = "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          data-testid="select-filter-user"
        >
          <option value="">All Users</option>
          {uniqueUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">Showing {filtered.length} activities</span>
      </div>

      <div className="space-y-1">
        {filtered.map((a, idx) => {
          const actionInfo = ACTION_LABELS[a.action] || {
            label: a.action,
            icon: AlertCircle,
            color: "text-muted-foreground",
          };
          const Icon = actionInfo.icon;

          const dateLabel = new Date(a.timestamp).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          const showDateHeader = dateLabel !== lastDateLabel;
          lastDateLabel = dateLabel;

          return (
            <div key={`${a.action}-${a.resource_id}-${idx}`}>
              {showDateHeader && (
                <div className="py-2 mt-2 first:mt-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {dateLabel}
                  </p>
                </div>
              )}
              <div
                className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/30 cursor-pointer"
                onClick={() => {
                  if (a.action === "opportunity_created" || a.action === "opportunity_updated") {
                    navigate(`/opportunities/${a.resource_id}`);
                  }
                }}
                data-testid={`row-activity-${idx}`}
              >
                <div className={`mt-0.5 ${actionInfo.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{a.user_name || a.username}</span>
                    {a.tenant_name && (
                      <span className="text-muted-foreground"> ({a.tenant_name})</span>
                    )}{" "}
                    <span className="text-muted-foreground">{actionInfo.label.toLowerCase()}</span>{" "}
                    {a.detail && <span className="font-medium">"{a.detail}"</span>}
                    {a.extra && a.action === "mockup_generated" && (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {a.extra}
                      </Badge>
                    )}
                    {a.extra && a.action === "asset_uploaded" && (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {a.extra}
                      </Badge>
                    )}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(a.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const AI_LOG_PAGE_SIZE = 50;

function AILogTab() {
  const { isSuperAdmin } = useAuth();
  const [page, setPage] = useState(0);
  const [filterUser, setFilterUser] = useState<string>("");

  const { data, isLoading } = useQuery<{ logs: ActivityLog[]; total: number }>({
    queryKey: ["/api/admin/activity-logs", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/activity-logs?limit=${AI_LOG_PAGE_SIZE}&offset=${page * AI_LOG_PAGE_SIZE}`
      );
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  const filteredLogs = filterUser
    ? logs.filter((l) => (l.userName || l.userId || "system") === filterUser)
    : logs;

  const totalTokens = filteredLogs.reduce((sum, l) => sum + (l.totalTokens ?? 0), 0);
  const totalCost = estimateCost(totalTokens);
  const successCount = filteredLogs.filter((l) => l.status === "success").length;
  const errorCount = filteredLogs.filter((l) => l.status === "error").length;
  const totalPages = Math.ceil(total / AI_LOG_PAGE_SIZE);

  const uniqueUsers = Array.from(
    new Map(
      logs.map((l) => {
        const name = l.userName || l.userId || "system";
        return [name, name];
      })
    ).values()
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Total Calls</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-calls">
              {isLoading ? <Skeleton className="h-7 w-12" /> : total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Tokens (page)</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-tokens">
              {isLoading ? <Skeleton className="h-7 w-12" /> : totalTokens.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Est. Cost (page)</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-est-cost">
              {isLoading ? <Skeleton className="h-7 w-12" /> : `$${totalCost.toFixed(4)}`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              @ ${COST_PER_1K_TOKENS}/1K tokens
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Success / Error</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-success-error">
              {isLoading ? <Skeleton className="h-7 w-12" /> : `${successCount} / ${errorCount}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <h2 className="text-lg font-semibold">Recent API Calls</h2>
          <div className="flex items-center gap-3">
            <select
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              data-testid="select-filter-ai-user"
            >
              <option value="">All Users</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {filterUser && (
              <span className="text-xs text-muted-foreground">
                {filteredLogs.length} of {logs.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={`usage-log-skeleton-${i}`} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No activity logs yet</p>
              <p className="text-sm mt-1">
                AI API calls will appear here once mockups are generated.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-activity-logs">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Time</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Action</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Provider</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Model</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Tokens</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Est. Cost</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">User</th>
                    <th className="pb-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const rowCost = log.totalTokens != null ? estimateCost(log.totalTokens) : null;
                    return (
                      <tr
                        key={log.id}
                        className="border-b last:border-0 hover:bg-muted/50"
                        data-testid={`row-ai-log-${log.id}`}
                      >
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{formatDateTime(log.createdAt)}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="capitalize">
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{log.provider}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">{log.model || "—"}</td>
                        <td className="py-3 pr-4 font-mono">
                          {log.totalTokens != null ? log.totalTokens.toLocaleString() : "—"}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">
                          {rowCost != null ? `$${rowCost.toFixed(4)}` : "—"}
                        </td>
                        <td className="py-3 pr-4">{log.userName || log.userId || "system"}</td>
                        <td className="py-3">
                          {log.status === "success" ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {page * AI_LOG_PAGE_SIZE + 1}–
                {Math.min((page + 1) * AI_LOG_PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminUsagePage() {
  const { isAdmin, isSuperAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="p-3 sm:p-6 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1
          className="text-xl sm:text-2xl font-bold flex items-center gap-2"
          data-testid="text-page-title"
        >
          <BarChart3 className="h-5 w-5" />
          Platform Stats
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor platform usage, activity, and AI API consumption.
        </p>
      </div>

      <Tabs defaultValue="usage">
        <TabsList data-testid="tabs-platform-stats">
          <TabsTrigger value="usage" data-testid="tab-usage">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            Activity
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="ai-log" data-testid="tab-ai-log">
              <Cpu className="h-3.5 w-3.5 mr-1.5" />
              AI Log
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="usage" className="mt-4">
          <UsageTab />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityTab />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="ai-log" className="mt-4">
            <AILogTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
