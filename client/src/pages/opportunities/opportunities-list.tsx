import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AlertTriangle, FolderOpen, MapPin, Plus, RefreshCw, Search } from "lucide-react";
import { OPPORTUNITY_STATUS_LABELS } from "@shared/schema";
import type { Opportunity, SignType } from "@shared/schema";
import { useState } from "react";
import { qk } from "@/lib/queryKeys";

const STATUS_BAR_COLORS: Record<string, string> = {
  OPEN: "bg-green-500",
  WON: "bg-blue-500",
  LOST: "bg-red-500",
  FOLLOW_UP: "bg-purple-500",
};

export default function OpportunitiesListPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const {
    data: opportunities,
    isLoading,
    isError,
    isFetching,
    error,
  } = useQuery<Opportunity[]>({
    queryKey: qk.opportunities.list(),
  });

  const { data: signTypesData } = useQuery<SignType[]>({
    queryKey: qk.signTypes.all(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.opportunities.all() });
  const signTypeLabels = Object.fromEntries((signTypesData ?? []).map((st) => [st.name, st.label]));

  const filtered = (opportunities ?? []).filter(
    (o) =>
      o.clientName.toLowerCase().includes(search.toLowerCase()) ||
      o.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Opportunities</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLoading ? "Loading..." : `${opportunities?.length ?? 0} total opportunities`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            disabled={isFetching}
            data-testid="button-refresh"
            aria-label="Refresh opportunities"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Link href="/opportunities/new">
            <Button data-testid="button-new-opportunity">
              <Plus className="h-4 w-4 mr-2" />
              New Opportunity
            </Button>
          </Link>
        </div>
      </div>

      {isError && (
        <Card>
          <CardContent className="py-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">
                Failed to load opportunities
                {error instanceof Error ? `: ${error.message}` : ""}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search"
          type="search"
          placeholder="Search by client or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {["s1", "s2", "s3", "s4"].map((k) => (
            <Card key={k}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="inline-flex items-center justify-center rounded-md bg-muted p-3 mb-3">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">
              {search ? "No matching opportunities" : "No opportunities yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search
                ? "Try adjusting your search."
                : "Create your first opportunity to get started."}
            </p>
            {!search && (
              <Link href="/opportunities/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Opportunity
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((opp) => (
            <Link key={opp.id} href={`/opportunities/${opp.id}`}>
              <Card
                className="hover-elevate cursor-pointer overflow-hidden"
                data-testid={`card-opp-${opp.id}`}
              >
                <div className="flex">
                  <div
                    className={`w-1.5 flex-shrink-0 ${STATUS_BAR_COLORS[opp.status] || STATUS_BAR_COLORS.OPEN}`}
                  />
                  <CardContent className="p-4 flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-md bg-primary/10 p-2.5">
                          <FolderOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate" data-testid={`text-client-${opp.id}`}>
                            {opp.clientName}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{opp.address}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">
                          {signTypeLabels[opp.signType] ?? opp.signType}
                        </Badge>
                        <Badge variant="outline">
                          {OPPORTUNITY_STATUS_LABELS[opp.status] || "Open"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
