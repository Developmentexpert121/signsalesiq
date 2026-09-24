import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import type { ActivityLog } from "@shared/schema";

const PAGE_SIZE = 50;

export default function ActivityLogPage() {
  const { isSuperAdmin } = useAuth();
  const [, navigate] = useLocation();
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery<{ logs: ActivityLog[]; total: number }>({
    queryKey: ["/api/admin/activity-logs", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/activity-logs?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`
      );
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) {
    navigate("/");
    return null;
  }

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens ?? 0), 0);
  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount = logs.filter((l) => l.status === "error").length;

  return (
    <div className="flex-1 overflow-auto" data-testid="activity-log-page">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Activity Log
          </h1>
          <p className="text-muted-foreground mt-1">AI API usage and token consumption</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-xl font-bold" data-testid="text-total-calls">
                  {isLoading ? <Skeleton className="h-6 w-12" /> : total}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tokens (page)</p>
                <p className="text-xl font-bold" data-testid="text-total-tokens">
                  {isLoading ? <Skeleton className="h-6 w-12" /> : totalTokens.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <CheckCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success / Error</p>
                <p className="text-xl font-bold" data-testid="text-success-error">
                  {isLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    `${successCount} / ${errorCount}`
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold">Recent API Calls</h2>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={`activity-log-skeleton-${i}`} className="h-16 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
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
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">User</th>
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b last:border-0 hover:bg-muted/50"
                        data-testid={`row-activity-${log.id}`}
                      >
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{formatDate(log.createdAt)}</span>
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of{" "}
                  {total}
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
    </div>
  );
}

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
