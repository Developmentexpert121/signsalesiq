import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUpload } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ImageIcon, Trash2, Upload, Pencil, Check, X, Star, Search } from "lucide-react";
import type { SignTypeReference, SignType } from "@shared/schema";
import { useState, useRef, useCallback } from "react";

function ReferenceCard({
  refItem,
  signTypeLabels,
  allSignTypes,
}: {
  refItem: SignTypeReference;
  signTypeLabels: Record<string, string>;
  allSignTypes: SignType[];
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(refItem.label || "");
  const [editSignType, setEditSignType] = useState(refItem.signType);

  const updateMutation = useMutation({
    mutationFn: async (data: { label?: string; signType?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/references/${refItem.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/references"] });
      toast({ title: "Reference updated" });
      setEditing(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/references/${refItem.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/references"] });
      toast({ title: "Reference image removed" });
    },
  });

  const bestMutation = useMutation({
    mutationFn: async (isPrimary: boolean) => {
      const res = await apiRequest("PATCH", `/api/admin/references/${refItem.id}`, { isPrimary });
      return res.json();
    },
    onSuccess: (_data, isPrimary) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/references"] });
      toast({
        title: isPrimary
          ? "Marked as Best Selection — AI will prioritize this image"
          : "Removed from Best Selection",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ label: editLabel.trim() || "", signType: editSignType });
  };

  const handleCancel = () => {
    setEditLabel(refItem.label || "");
    setEditSignType(refItem.signType);
    setEditing(false);
  };

  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative group" data-testid={`ref-image-${refItem.id}`}>
      <div
        className="relative border rounded-md overflow-hidden bg-muted/30 aspect-video cursor-zoom-in"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img
          src={`/api/uploads/${refItem.filename}`}
          alt={refItem.label || signTypeLabels[refItem.signType] || refItem.signType}
          className="w-full h-full object-cover"
        />
        {refItem.isPrimary && (
          <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-semibold shadow">
            <Star className="h-2.5 w-2.5 fill-yellow-900" /> Best
          </div>
        )}
      </div>
      {hovered && (
        <div
          className="fixed z-[100] pointer-events-none border-2 border-primary rounded-lg shadow-2xl overflow-hidden bg-background"
          style={{
            width: "min(500px, 40vw)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
          data-testid={`ref-image-preview-${refItem.id}`}
        >
          <img
            src={`/api/uploads/${refItem.filename}`}
            alt={refItem.label || signTypeLabels[refItem.signType] || refItem.signType}
            className="w-full h-auto"
          />
          {refItem.label && (
            <div className="px-2 py-1 text-xs text-center bg-background border-t">
              {refItem.label}
            </div>
          )}
        </div>
      )}
      {editing ? (
        <div className="mt-2 space-y-2">
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder="Label (optional)"
            className="text-xs"
            data-testid={`input-edit-label-${refItem.id}`}
          />
          <Select value={editSignType} onValueChange={setEditSignType}>
            <SelectTrigger className="text-xs" data-testid={`select-edit-signtype-${refItem.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allSignTypes.map((st) => (
                <SelectItem key={st.name} value={st.name}>
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid={`button-save-ref-${refItem.id}`}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              data-testid={`button-cancel-ref-${refItem.id}`}
            >
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="text-xs text-muted-foreground truncate">
            {refItem.label || "No label"}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              title={refItem.isPrimary ? "Remove from Best Selection" : "Mark as Best Selection"}
              onClick={() => bestMutation.mutate(!refItem.isPrimary)}
              disabled={bestMutation.isPending}
              data-testid={`button-best-ref-${refItem.id}`}
            >
              {bestMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Star
                  className={`h-3 w-3 ${refItem.isPrimary ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(true)}
              data-testid={`button-edit-ref-${refItem.id}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm("Delete this reference image?")) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-ref-${refItem.id}`}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminReferencesPage() {
  const { toast } = useToast();
  const [selectedSignType, setSelectedSignType] = useState<string>("");
  const [label, setLabel] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<"ALL" | "INTERIOR" | "EXTERIOR">("ALL");
  const [filterSignType, setFilterSignType] = useState<string>("ALL");
  const [bestOnly, setBestOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: refs, isLoading } = useQuery<SignTypeReference[]>({
    queryKey: ["/api/admin/references"],
  });

  const { data: signTypesData } = useQuery<SignType[]>({
    queryKey: ["/api/sign-types"],
  });
  const signTypeLabels = Object.fromEntries((signTypesData ?? []).map((st) => [st.name, st.label]));
  const signTypeCategories = Object.fromEntries(
    (signTypesData ?? []).map((st) => [st.name, st.category])
  );
  const allSignTypes = signTypesData ?? [];

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    const allowedFiles = Array.from(files).filter((f) => {
      const ext = f.name.toLowerCase().split(".").pop();
      return f.type.startsWith("image/") || ext === "pdf" || ext === "svg";
    });
    setSelectedFiles((prev) => [...prev, ...allowedFiles]);
  }, []);

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      if (selectedSignType) formData.append("signType", selectedSignType);
      if (label.trim()) formData.append("label", label.trim());

      const data = await apiUpload<any>("/api/admin/references", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/references"] });
      if (data.skipped && data.skipped.length > 0) {
        const results = data.results || data;
        toast({ title: data.message, variant: "destructive" });
      } else {
        const count = Array.isArray(data)
          ? data.length
          : data.results?.length || selectedFiles.length;
        toast({ title: `${count} reference image${count !== 1 ? "s" : ""} uploaded` });
      }
      setLabel("");
      setSelectedSignType("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected]
  );

  const q = search.trim().toLowerCase();
  const visibleRefs = (refs ?? []).filter((r) => {
    if (filterCategory !== "ALL" && signTypeCategories[r.signType] !== filterCategory) return false;
    if (filterSignType !== "ALL" && r.signType !== filterSignType) return false;
    if (bestOnly && !r.isPrimary) return false;
    if (!q) return true;
    return (
      (r.label ?? "").toLowerCase().includes(q) ||
      r.filename.toLowerCase().includes(q) ||
      r.signType.toLowerCase().includes(q) ||
      (signTypeLabels[r.signType] ?? "").toLowerCase().includes(q)
    );
  });

  const grouped = visibleRefs.reduce<Record<string, SignTypeReference[]>>((acc, ref) => {
    if (!acc[ref.signType]) acc[ref.signType] = [];
    acc[ref.signType].push(ref);
    return acc;
  }, {});

  const isFiltering = q !== "" || filterCategory !== "ALL" || filterSignType !== "ALL" || bestOnly;

  const signTypesWithRefs = Object.keys(grouped).sort();

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1
          className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"
          data-testid="text-page-title"
        >
          <ImageIcon className="h-6 w-6" /> Sign Type Reference Images
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload example photos of each sign type. These are sent to the AI during mockup
          generation. Click the <Star className="inline h-3 w-3 mb-0.5" /> star on any image to mark
          it as <strong>Best Selection</strong> — when any Best Selection images exist for a sign
          type, the AI will receive <em>only those</em> during generation (up to 6). If none are
          starred, all images are used as a fallback.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Upload Reference Images</h3>
          <div
            className={`border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-upload"
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Drag and drop images here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, SVG, PDF supported. Select multiple files for bulk upload.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.svg"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
              data-testid="input-ref-files"
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFiles([])}
                  data-testid="button-clear-files"
                >
                  Clear all
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {selectedFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}-${i}`}
                    className="relative border rounded-md overflow-hidden bg-muted/30 aspect-video"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-0.5 right-0.5 h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSelectedFile(i);
                      }}
                      data-testid={`button-remove-file-${i}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                      {file.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <Label className="text-xs">Assign Sign Type (optional)</Label>
                  <Select value={selectedSignType} onValueChange={setSelectedSignType}>
                    <SelectTrigger data-testid="select-ref-sign-type">
                      <SelectValue placeholder="Assign later..." />
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
                  <Label className="text-xs">Label for all (optional)</Label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Front-lit example"
                    data-testid="input-ref-label"
                  />
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || selectedFiles.length === 0}
                  data-testid="button-upload-ref"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload {selectedFiles.length} Image{selectedFiles.length !== 1 ? "s" : ""}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You can assign sign types and edit labels after uploading too.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-references"
            type="search"
            placeholder="Search by label, filename, or sign type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterCategory}
          onValueChange={(v) => {
            setFilterCategory(v as "ALL" | "INTERIOR" | "EXTERIOR");
            setFilterSignType("ALL");
          }}
        >
          <SelectTrigger className="w-full sm:w-44" data-testid="select-category-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            <SelectItem value="INTERIOR">Interior</SelectItem>
            <SelectItem value="EXTERIOR">Exterior</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSignType} onValueChange={setFilterSignType}>
          <SelectTrigger className="w-full sm:w-56" data-testid="select-signtype-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sign types</SelectItem>
            {allSignTypes
              .filter((st) => filterCategory === "ALL" || st.category === filterCategory)
              .map((st) => (
                <SelectItem key={st.id} value={st.name}>
                  {st.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          variant={bestOnly ? "default" : "outline"}
          onClick={() => setBestOnly((v) => !v)}
          data-testid="button-best-only"
        >
          <Star className={`h-4 w-4 mr-2 ${bestOnly ? "fill-current" : ""}`} />
          Best Selection
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={`refs-skeleton-${i}`}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : signTypesWithRefs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium mb-1">
              {isFiltering
                ? "No reference images match your search/filters"
                : "No reference images uploaded"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isFiltering
                ? "Try clearing the search box or adjusting the filters above."
                : "Upload example photos of sign types above. The AI will use these to understand what each sign type should look like."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {signTypesWithRefs.map((signType) => (
            <Card key={signType} data-testid={`card-ref-group-${signType}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{signTypeLabels[signType] ?? signType}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {grouped[signType].length} reference
                      {grouped[signType].length !== 1 ? "s" : ""}
                    </span>
                    {grouped[signType].some((r) => r.isPrimary) && (
                      <span className="flex items-center gap-0.5 text-[11px] font-medium text-yellow-600 dark:text-yellow-400">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        {grouped[signType].filter((r) => r.isPrimary).length} Best
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {grouped[signType].map((ref) => (
                    <ReferenceCard
                      key={ref.id}
                      refItem={ref}
                      signTypeLabels={signTypeLabels}
                      allSignTypes={allSignTypes}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
