import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isFullSceneOnly } from "@shared/fullSceneOnlySignTypes";
import type { SignType, SignTypeReference } from "@shared/schema";

type Category = "INTERIOR" | "EXTERIOR" | "VEHICLE";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "INTERIOR", label: "Interior" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "VEHICLE", label: "Vehicle" },
];

interface SignTypePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signTypes: SignType[];
  value: string;
  onChange: (name: string) => void;
  defaultCategory?: Category;
}

function SignTypeCard({
  st,
  selected,
  reference,
  onSelect,
}: {
  st: SignType;
  selected: boolean;
  reference?: SignTypeReference;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`card-sign-type-${st.name}`}
      className={cn(
        "group flex flex-col rounded-lg border bg-card overflow-hidden text-left transition-all hover:shadow-md hover:border-primary/60",
        selected ? "ring-2 ring-primary border-primary" : "border-border"
      )}
    >
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {reference ? (
          <img
            src={`/api/uploads/${reference.filename}`}
            alt={st.label}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        )}
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium truncate">{st.label}</div>
          {isFullSceneOnly(st.name) && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              Full scene
            </span>
          )}
        </div>
        {st.description && (
          <div className="text-xs text-muted-foreground line-clamp-2">{st.description}</div>
        )}
      </div>
    </button>
  );
}

export function SignTypePickerDialog({
  open,
  onOpenChange,
  signTypes,
  value,
  onChange,
  defaultCategory,
}: SignTypePickerDialogProps) {
  const [search, setSearch] = useState("");

  const { data: references = [] } = useQuery<SignTypeReference[]>({
    queryKey: ["/api/sign-type-references"],
    enabled: open,
  });

  const referenceBySignType = useMemo(() => {
    const map = new Map<string, SignTypeReference>();
    for (const ref of references) {
      const existing = map.get(ref.signType);
      if (!existing || (ref.isPrimary && !existing.isPrimary)) {
        map.set(ref.signType, ref);
      }
    }
    return map;
  }, [references]);

  const activeTypes = useMemo(() => signTypes.filter((st) => st.active !== false), [signTypes]);

  const typesByCategory = useMemo(() => {
    const grouped: Record<Category, SignType[]> = {
      INTERIOR: [],
      EXTERIOR: [],
      VEHICLE: [],
    };
    for (const st of activeTypes) {
      const cat = st.category as Category;
      if (cat in grouped) grouped[cat].push(st);
    }
    for (const cat of Object.keys(grouped) as Category[]) {
      grouped[cat].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label)
      );
    }
    return grouped;
  }, [activeTypes]);

  const q = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return null;
    return activeTypes
      .filter(
        (st) =>
          st.label.toLowerCase().includes(q) ||
          st.description?.toLowerCase().includes(q) ||
          st.name.toLowerCase().includes(q)
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label));
  }, [q, activeTypes]);

  const handleSelect = (name: string) => {
    onChange(name);
    onOpenChange(false);
    setSearch("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setSearch("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Choose a sign type</DialogTitle>
          <DialogDescription>
            Browse reference images for each sign type and pick the one that fits.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search sign types…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-sign-type-search"
            autoComplete="off"
          />
        </div>

        {searchResults ? (
          <div className="flex-1 overflow-y-auto pr-1">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No sign types match "{search}".
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 py-2">
                {searchResults.map((st) => (
                  <SignTypeCard
                    key={st.name}
                    st={st}
                    selected={st.name === value}
                    reference={referenceBySignType.get(st.name)}
                    onSelect={() => handleSelect(st.name)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <Tabs
            defaultValue={defaultCategory ?? "INTERIOR"}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <TabsList className="self-start">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.value} value={c.value} data-testid={`tab-sign-type-${c.value}`}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {CATEGORIES.map((c) => {
              const types = typesByCategory[c.value];
              return (
                <TabsContent key={c.value} value={c.value} className="flex-1 overflow-y-auto pr-1">
                  {types.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No sign types available in this category.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 py-2">
                      {types.map((st) => (
                        <SignTypeCard
                          key={st.name}
                          st={st}
                          selected={st.name === value}
                          reference={referenceBySignType.get(st.name)}
                          onSelect={() => handleSelect(st.name)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
