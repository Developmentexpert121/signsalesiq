import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUpload } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  Type,
  Zap,
  ImageIcon,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Search,
  Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { SignType } from "@shared/schema";
import { useState, useRef, useCallback, useEffect } from "react";

function AttributeTagList({
  attributes,
  onChange,
  testIdPrefix,
}: {
  attributes: string[];
  onChange: (attrs: string[]) => void;
  testIdPrefix: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const addAttribute = () => {
    const val = inputValue.trim();
    if (val && !attributes.includes(val)) {
      onChange([...attributes, val]);
      setInputValue("");
    }
  };

  const removeAttribute = (index: number) => {
    onChange(attributes.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAttribute();
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Attributes / Finish Options</Label>
      <div className="flex gap-1">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Chrome, Polished, Brushed Metal"
          data-testid={`${testIdPrefix}-input`}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={addAttribute}
          disabled={!inputValue.trim()}
          data-testid={`${testIdPrefix}-add`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {attributes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attributes.map((attr, i) => (
            <Badge
              key={`${testIdPrefix}-attr-${i}-${attr}`}
              variant="secondary"
              className="gap-1"
              data-testid={`${testIdPrefix}-tag-${i}`}
            >
              {attr}
              <button
                type="button"
                onClick={() => removeAttribute(i)}
                className="ml-0.5 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function SignTypeEditor({ signType, onClose }: { signType?: SignType; onClose: () => void }) {
  const { toast } = useToast();
  const isEditing = !!signType;

  const [name, setName] = useState(signType?.name ?? "");
  const [label, setLabel] = useState(signType?.label ?? "");
  const [category, setCategory] = useState(signType?.category ?? "INTERIOR");
  const [description, setDescription] = useState(signType?.description ?? "");
  const [samplePrompt, setSamplePrompt] = useState(signType?.samplePrompt ?? "");
  const [generationNotes, setGenerationNotes] = useState(signType?.generationNotes ?? "");
  const [attributes, setAttributes] = useState<string[]>(signType?.attributes ?? []);
  const [sortOrder, setSortOrder] = useState(signType?.sortOrder ?? 0);
  const [active, setActive] = useState(signType?.active !== false);
  const [showSignCode, setShowSignCode] = useState(
    signType?.showSignCode ?? signType?.category === "EXTERIOR"
  );

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/sign-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sign-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sign-types"] });
      toast({ title: "Sign type created" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/admin/sign-types/${signType?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sign-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sign-types"] });
      toast({ title: "Sign type updated" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const autoGenerateName = (lbl: string) => {
    return lbl
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (!isEditing) {
      setName(autoGenerateName(val));
    }
  };

  const handleSave = () => {
    if (!name.trim() || !label.trim()) return;
    const data = {
      name: name.trim(),
      label: label.trim(),
      category,
      description: description.trim() || null,
      samplePrompt: samplePrompt.trim() || null,
      generationNotes: generationNotes.trim() || null,
      attributes,
      sortOrder,
      active,
      showSignCode,
    };
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isValid = name.trim() && label.trim();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Display Name</Label>
          <Input
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="e.g. Dimensional Logo"
            data-testid="input-sign-type-label"
          />
        </div>
        <div>
          <Label className="text-xs">System Key</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            placeholder="e.g. DIMENSIONAL_LOGO"
            disabled={isEditing}
            data-testid="input-sign-type-name"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Auto-generated from name</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-sign-type-category">
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
          <Label className="text-xs">Sort Order</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
            data-testid="input-sign-type-sort"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Description (for AI Mockup Generation)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe how this sign type looks, materials used, construction methods, and visual characteristics. This helps AI generate accurate mockups."
          rows={3}
          data-testid="input-sign-type-description"
        />
      </div>

      <div>
        <Label className="text-xs">Sample Prompt (auto-fills for customers)</Label>
        <Textarea
          value={samplePrompt}
          onChange={(e) => setSamplePrompt(e.target.value)}
          placeholder="A starter prompt that auto-fills when this sign type is selected. Customers can edit it. e.g. 'Brushed aluminum dimensional letters with company logo, mounted on lobby feature wall with accent lighting...'"
          rows={2}
          data-testid="input-sign-type-sample-prompt"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          This text pre-fills the Description/Prompt field when a user selects this sign type on the
          opportunity form.
        </p>
      </div>

      <div>
        <Label className="text-xs">AI Generation Notes (injected as critical instructions)</Label>
        <Textarea
          value={generationNotes}
          onChange={(e) => setGenerationNotes(e.target.value)}
          placeholder="e.g. 'Always show individual letter depth of at least 1.5 inches. Background wall must remain fully visible. No cabinet or panel behind letters.' These notes are injected as critical instructions directly into the AI prompt."
          rows={3}
          data-testid="input-sign-type-generation-notes"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Use this to fix recurring AI generation issues for this sign type. These notes are marked
          as CRITICAL in the AI prompt.
        </p>
      </div>

      <AttributeTagList attributes={attributes} onChange={setAttributes} testIdPrefix="attr" />

      <div className="flex items-center gap-2">
        <Switch
          checked={active}
          onCheckedChange={setActive}
          data-testid="switch-sign-type-active"
        />
        <Label className="text-xs">Active (available for selection)</Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={showSignCode}
          onCheckedChange={setShowSignCode}
          data-testid="switch-sign-type-show-sign-code"
        />
        <Label className="text-xs">
          Show Local Sign Code (auto-lookup regulations when generating mockups)
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-4 pb-1 sticky bottom-0 bg-background border-t mt-2">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-sign-type">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isValid || isPending}
          data-testid="button-save-sign-type"
        >
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? "Update" : "Create"} Sign Type
        </Button>
      </div>
    </div>
  );
}

function MockupTestBench({ signTypes }: { signTypes: SignType[] }) {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [selectedSignType, setSelectedSignType] = useState("");
  const IMPROVEMENT_AREAS = [
    "Logo/Branding",
    "Colors",
    "Materials/Texture",
    "Background/Wall",
    "Composition/Layout",
    "Depth/Shadows",
    "Text/Typography",
    "Overall Style",
  ];

  const [prompt, setPrompt] = useState("");
  const [sitePhoto, setSitePhoto] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [sitePhotoPreview, setSitePhotoPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{
    mockupUrl: string;
    signType: string;
    signTypeName: string;
    signTypeCategory: string;
    referenceCount: number;
    generatedFilename: string;
  } | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<"APPROVED" | "NEEDS_WORK" | null>(
    null
  );
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  const [planePoints, setPlanePoints] = useState<{ x: number; y: number }[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!sitePhotoPreview) {
      imgRef.current = null;
      setImgLoaded(false);
      setPlanePoints([]);
      return;
    }
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = sitePhotoPreview;
  }, [sitePhotoPreview]);

  const drawPlaneCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (planePoints.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(planePoints[0].x, planePoints[0].y);
      for (let i = 1; i < planePoints.length; i++) {
        ctx.lineTo(planePoints[i].x, planePoints[i].y);
      }
      if (planePoints.length === 4) ctx.closePath();
      ctx.strokeStyle = "rgba(59,130,246,0.9)";
      ctx.lineWidth = Math.max(2, img.naturalWidth / 300);
      ctx.stroke();
      if (planePoints.length === 4) {
        ctx.fillStyle = "rgba(59,130,246,0.12)";
        ctx.fill();
      }
    }
    const r = Math.max(8, img.naturalWidth / 80);
    const fontSize = Math.max(12, img.naturalWidth / 60);
    planePoints.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(59,130,246,0.95)";
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = Math.max(1.5, img.naturalWidth / 400);
      ctx.stroke();
      ctx.fillStyle = "white";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), pt.x, pt.y);
    });
  }, [planePoints, imgLoaded]);

  useEffect(() => {
    drawPlaneCanvas();
  }, [drawPlaneCanvas]);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }, []);

  const POINT_HIT_RADIUS = 20;

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e);
      if (!coords) return;
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return;
      const rect = canvas.getBoundingClientRect();
      const hitR = POINT_HIT_RADIUS * (img.naturalWidth / rect.width);
      const hitIdx = planePoints.findIndex(
        (pt) => Math.sqrt((pt.x - coords.x) ** 2 + (pt.y - coords.y) ** 2) < hitR
      );
      if (hitIdx !== -1) {
        setDraggingIdx(hitIdx);
        return;
      }
      if (planePoints.length < 4) {
        setPlanePoints((prev) => [...prev, coords]);
      }
    },
    [getCanvasCoords, planePoints]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (draggingIdx === null) return;
      const coords = getCanvasCoords(e);
      if (!coords) return;
      setPlanePoints((prev) => prev.map((pt, i) => (i === draggingIdx ? coords : pt)));
    },
    [draggingIdx, getCanvasCoords]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingIdx(null);
  }, []);

  if (!isSuperAdmin) return null;

  const activeSignTypes = signTypes.filter((st) => st.active !== false);

  const handleFileChange = (file: File | null, type: "site" | "logo") => {
    if (!file) {
      if (type === "site") {
        setSitePhoto(null);
        setSitePhotoPreview(null);
      } else {
        setLogo(null);
        setLogoPreview(null);
      }
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "site") {
        setSitePhoto(file);
        setSitePhotoPreview(reader.result as string);
      } else {
        setLogo(file);
        setLogoPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const CUSTOM_MODEL = "__custom__";
  const { data: mockupSettings } = useQuery<{ model: string; knownModels: string[] }>({
    queryKey: ["/api/admin/mockup-settings"],
  });
  const knownModels = mockupSettings?.knownModels ?? [];
  const currentModel = mockupSettings?.model ?? "";
  const [modelSelect, setModelSelect] = useState("");
  const [customModel, setCustomModel] = useState("");

  useEffect(() => {
    if (!currentModel) return;
    if (knownModels.includes(currentModel)) {
      setModelSelect(currentModel);
    } else {
      setModelSelect(CUSTOM_MODEL);
      setCustomModel(currentModel);
    }
  }, [currentModel, knownModels.join(",")]);

  const resolvedModel = modelSelect === CUSTOM_MODEL ? customModel.trim() : modelSelect;

  const modelMutation = useMutation({
    mutationFn: async (model: string) => {
      return apiRequest("POST", "/api/admin/mockup-settings", { model }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mockup-settings"] });
      toast({ title: "Model updated", description: `Mockup generation now uses ${resolvedModel}` });
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("signType", selectedSignType);
      if (prompt) formData.append("prompt", prompt);
      if (sitePhoto) formData.append("sitePhoto", sitePhoto);
      if (logo) formData.append("logo", logo);
      if (planePoints.length === 4) formData.append("planePoints", JSON.stringify(planePoints));

      return apiUpload<{ signType: string }>("/api/admin/test-mockup", formData);
    },
    onSuccess: (data: any) => {
      setResult(data);
      setFeedbackSubmitted(null);
      setFeedbackNotes("");
      setSelectedAreas([]);
      toast({ title: "Mockup generated", description: `${data.signType} mockup ready` });
    },
    onError: (err) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({
      rating,
      generatedFilename,
      signType,
      notes,
      improvementAreas,
    }: {
      rating: "APPROVED" | "NEEDS_WORK";
      generatedFilename: string;
      signType: string;
      notes?: string;
      improvementAreas?: string[];
    }) => {
      return apiRequest("POST", "/api/admin/mockup-feedback", {
        rating,
        generatedFilename,
        signType,
        notes: notes || null,
        improvementAreas: improvementAreas && improvementAreas.length > 0 ? improvementAreas : null,
      }).then((r) => r.json());
    },
    onSuccess: (_data, variables) => {
      setFeedbackSubmitted(variables.rating);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mockup-feedback/stats"] });
      toast({
        title: variables.rating === "APPROVED" ? "Marked as Approved" : "Marked as Needs Work",
        description:
          variables.rating === "APPROVED"
            ? "This mockup will be used as a reference for future generations."
            : "Feedback recorded — will help improve future generations.",
      });
    },
    onError: (err) => {
      toast({ title: "Feedback failed", description: err.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({
      generatedFilename,
      signType,
      notes,
      improvementAreas,
    }: {
      generatedFilename: string;
      signType: string;
      notes: string;
      improvementAreas: string[];
    }) => {
      await apiRequest("POST", "/api/admin/mockup-feedback", {
        rating: "NEEDS_WORK",
        generatedFilename,
        signType,
        notes: notes || null,
        improvementAreas: improvementAreas.length > 0 ? improvementAreas : null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mockup-feedback/stats"] });

      const correctionParts: string[] = [];
      if (notes.trim()) correctionParts.push(`CORRECTION FROM PREVIOUS ATTEMPT: ${notes.trim()}.`);
      if (improvementAreas.length > 0)
        correctionParts.push(`Fix these areas: ${improvementAreas.join(", ")}.`);
      const correctionContext = correctionParts.join(" ");
      const combinedPrompt = correctionContext
        ? `${correctionContext}\n\n${prompt}`.trim()
        : prompt;

      const formData = new FormData();
      formData.append("signType", signType);
      if (combinedPrompt) formData.append("prompt", combinedPrompt);
      if (sitePhoto) formData.append("sitePhoto", sitePhoto);
      if (logo) formData.append("logo", logo);
      if (planePoints.length === 4) formData.append("planePoints", JSON.stringify(planePoints));

      return apiUpload<{ signType: string }>("/api/admin/test-mockup", formData);
    },
    onSuccess: (data: any) => {
      setResult(data);
      setFeedbackSubmitted(null);
      setFeedbackNotes("");
      setSelectedAreas([]);
      toast({ title: "Regenerated", description: "New mockup generated with your corrections." });
    },
    onError: (err) => {
      toast({ title: "Regeneration failed", description: err.message, variant: "destructive" });
    },
  });

  const selectedSt = activeSignTypes.find((st) => st.name === selectedSignType);

  return (
    <Card data-testid="card-mockup-test-bench">
      <CardHeader className="pb-2">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4" />
          Mockup Test Bench
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload a site photo and logo, pick a sign type, and generate a test mockup directly — no
          opportunity needed.
        </p>
        <div className="mt-3 rounded-md border bg-muted/40 p-3">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Generation Model
          </Label>
          <p className="text-[10px] text-muted-foreground mb-2">
            Platform-wide AI model used for all mockup generation. Applies immediately.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Select value={modelSelect} onValueChange={setModelSelect}>
              <SelectTrigger className="h-8 text-xs sm:w-72" data-testid="select-mockup-model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {knownModels.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_MODEL} className="text-xs">
                  Custom…
                </SelectItem>
              </SelectContent>
            </Select>
            {modelSelect === CUSTOM_MODEL && (
              <Input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="e.g. gemini-3-pro-image-preview"
                className="h-8 text-xs sm:w-72"
                data-testid="input-custom-mockup-model"
              />
            )}
            <Button
              size="sm"
              className="h-8"
              disabled={!resolvedModel || resolvedModel === currentModel || modelMutation.isPending}
              onClick={() => modelMutation.mutate(resolvedModel)}
              data-testid="button-save-mockup-model"
            >
              {modelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Site Photo (optional)</Label>
            <div className="border-2 border-dashed rounded-lg p-3 text-center relative">
              {sitePhotoPreview ? (
                <div className="relative">
                  <div className="relative w-full">
                    <img
                      src={sitePhotoPreview}
                      alt="Site photo preview"
                      className="w-full rounded block"
                    />
                    {imgLoaded && (
                      <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 w-full h-full rounded"
                        style={{ cursor: planePoints.length < 4 ? "crosshair" : "default" }}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        data-testid="canvas-plane-selector"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-muted-foreground">
                      {planePoints.length === 4 ? (
                        <span className="text-blue-600 font-medium">Plane defined (4 points)</span>
                      ) : (
                        <span>Click photo to place point {planePoints.length + 1} of 4</span>
                      )}
                    </p>
                    <div className="flex gap-1">
                      {planePoints.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={() => setPlanePoints([])}
                          data-testid="button-clear-plane"
                        >
                          Clear Plane
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-6 w-6"
                        onClick={() => handleFileChange(null, "site")}
                        data-testid="button-remove-site-photo"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block py-4">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Click to upload site photo</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null, "site")}
                    data-testid="input-test-site-photo"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Logo (optional)</Label>
            <div className="border-2 border-dashed rounded-lg p-3 text-center relative">
              {logoPreview ? (
                <div className="relative">
                  <img src={logoPreview} alt="Logo preview" className="max-h-40 mx-auto rounded" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => handleFileChange(null, "logo")}
                    data-testid="button-remove-logo"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block py-4">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Click to upload logo</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null, "logo")}
                    data-testid="input-test-logo"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium">Short Prompt / Description</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Modern dental office, white and teal branding, clean minimalist look"
            rows={2}
            className="resize-none"
            data-testid="input-test-prompt"
          />
        </div>

        <div>
          <Label className="text-xs font-medium">Sign Type</Label>
          <Select value={selectedSignType} onValueChange={setSelectedSignType}>
            <SelectTrigger data-testid="select-test-sign-type">
              <SelectValue placeholder="Choose a sign type..." />
            </SelectTrigger>
            <SelectContent>
              {activeSignTypes.map((st) => (
                <SelectItem key={st.name} value={st.name}>
                  {st.label} ({st.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSt?.description && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
              {selectedSt.description}
            </p>
          )}
        </div>

        <Button
          onClick={() => testMutation.mutate()}
          disabled={!selectedSignType || testMutation.isPending}
          className="w-full"
          data-testid="button-run-test-mockup"
        >
          {testMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Mockup...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Generate Test Mockup
            </>
          )}
        </Button>

        {testMutation.isPending && (
          <p className="text-xs text-muted-foreground text-center">
            Generating with Gemini AI. This usually takes 15-30 seconds...
          </p>
        )}

        {result && (
          <div className="space-y-3 pt-2 border-t" data-testid="div-test-result">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Badge variant="secondary">{result.signTypeCategory}</Badge>
                {result.signType}
              </h4>
              <p className="text-[10px] text-muted-foreground">
                {result.referenceCount} reference image{result.referenceCount !== 1 ? "s" : ""} used
              </p>
            </div>

            {sitePhotoPreview && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    Original Photo
                  </p>
                  <div className="rounded border overflow-hidden" style={{ height: 440 }}>
                    <img
                      src={sitePhotoPreview}
                      alt="Original"
                      className="w-full h-full object-cover"
                      data-testid="img-test-original"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">AI Mockup</p>
                  <div className="rounded border overflow-hidden" style={{ height: 440 }}>
                    <img
                      src={result.mockupUrl}
                      alt="Mockup result"
                      className="w-full h-full object-cover"
                      data-testid="img-test-mockup"
                    />
                  </div>
                </div>
              </div>
            )}

            {!sitePhotoPreview && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">AI Mockup</p>
                <img
                  src={result.mockupUrl}
                  alt="Mockup result"
                  className="max-w-md w-full rounded border"
                  data-testid="img-test-mockup"
                />
              </div>
            )}

            <div
              className="border rounded-lg p-3 bg-muted/30 space-y-3"
              data-testid="div-feedback-section"
            >
              {feedbackSubmitted ? (
                <div className="flex items-center gap-2 justify-center py-1">
                  {feedbackSubmitted === "APPROVED" ? (
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <ThumbsDown className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="text-sm font-medium">
                    {feedbackSubmitted === "APPROVED"
                      ? "Marked as Approved — will be used as a future reference"
                      : "Marked as Needs Work — feedback recorded"}
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Rate this mockup to improve future generations:
                  </p>

                  <div>
                    <Label className="text-xs font-medium">
                      What needs improvement? (optional)
                    </Label>
                    <Textarea
                      value={feedbackNotes}
                      onChange={(e) => setFeedbackNotes(e.target.value)}
                      placeholder="e.g. The logo colors look washed out and the background is too dark..."
                      rows={2}
                      className="resize-none text-xs mt-1"
                      data-testid="input-feedback-notes"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">
                      Improvement areas (optional — pick all that apply)
                    </Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {IMPROVEMENT_AREAS.map((area) => {
                        const isSelected = selectedAreas.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() =>
                              setSelectedAreas((prev) =>
                                isSelected ? prev.filter((a) => a !== area) : [...prev, area]
                              )
                            }
                            className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                            }`}
                            data-testid={`chip-area-${area.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                          >
                            {area}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-green-500 text-green-700 hover:bg-green-50 dark:hover:bg-green-950 flex-1 min-w-[120px]"
                      onClick={() =>
                        feedbackMutation.mutate({
                          rating: "APPROVED",
                          generatedFilename: result.generatedFilename,
                          signType: result.signTypeName,
                          notes: feedbackNotes,
                          improvementAreas: selectedAreas,
                        })
                      }
                      disabled={feedbackMutation.isPending || regenerateMutation.isPending}
                      data-testid="button-feedback-approved"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 flex-1 min-w-[120px]"
                      onClick={() =>
                        feedbackMutation.mutate({
                          rating: "NEEDS_WORK",
                          generatedFilename: result.generatedFilename,
                          signType: result.signTypeName,
                          notes: feedbackNotes,
                          improvementAreas: selectedAreas,
                        })
                      }
                      disabled={feedbackMutation.isPending || regenerateMutation.isPending}
                      data-testid="button-feedback-needs-work"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      Save Feedback
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1.5 flex-1 min-w-[160px]"
                      onClick={() =>
                        regenerateMutation.mutate({
                          generatedFilename: result.generatedFilename,
                          signType: result.signTypeName,
                          notes: feedbackNotes,
                          improvementAreas: selectedAreas,
                        })
                      }
                      disabled={feedbackMutation.isPending || regenerateMutation.isPending}
                      data-testid="button-regenerate-with-feedback"
                    >
                      {regenerateMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Regenerating...
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5" /> Regenerate with Feedback
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackDashboard() {
  const { isSuperAdmin } = useAuth();

  const { data: stats } = useQuery<
    {
      signType: string;
      approved: number;
      needsWork: number;
      total: number;
      areaCounts: Record<string, number>;
    }[]
  >({
    queryKey: ["/api/admin/mockup-feedback/stats"],
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) return null;
  if (!stats || stats.length === 0) return null;

  return (
    <Card data-testid="card-feedback-dashboard">
      <CardHeader className="pb-2">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <BarChart3 className="h-4 w-4" />
          Mockup Feedback Summary
        </h3>
        <p className="text-xs text-muted-foreground">
          Approved mockups are automatically used as reference images for future AI generation.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stats.map((row) => {
            const topAreas = Object.entries(row.areaCounts || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4);
            return (
              <div
                key={row.signType}
                className="py-2 border-b last:border-0"
                data-testid={`row-feedback-${row.signType}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium flex-1 truncate">
                    {row.signType.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="flex items-center gap-1 text-green-700 bg-green-50 dark:bg-green-950/50 dark:text-green-400 px-2 py-0.5 rounded"
                      data-testid={`text-approved-${row.signType}`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      {row.approved}
                    </span>
                    <span
                      className="flex items-center gap-1 text-orange-600 bg-orange-50 dark:bg-orange-950/50 dark:text-orange-400 px-2 py-0.5 rounded"
                      data-testid={`text-needs-work-${row.signType}`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      {row.needsWork}
                    </span>
                    <span className="text-muted-foreground">{row.total} total</span>
                  </div>
                </div>
                {topAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {topAreas.map(([area, count]) => (
                      <span
                        key={area}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800"
                        data-testid={`chip-area-count-${row.signType}-${area.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                      >
                        {area} ×{count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSignTypesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<SignType | undefined>();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "INTERIOR" | "EXTERIOR">("ALL");

  const { data: signTypesData, isLoading } = useQuery<SignType[]>({
    queryKey: ["/api/admin/sign-types"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/sign-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sign-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sign-types"] });
      toast({ title: "Sign type removed" });
    },
  });

  const handleEdit = (st: SignType) => {
    setEditingType(st);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingType(undefined);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingType(undefined);
  };

  const q = search.trim().toLowerCase();
  const matches = (st: SignType) =>
    !q ||
    st.label.toLowerCase().includes(q) ||
    st.name.toLowerCase().includes(q) ||
    (st.description ?? "").toLowerCase().includes(q) ||
    (st.attributes ?? []).some((a) => a.toLowerCase().includes(q));
  const filtered = (signTypesData ?? []).filter(matches);
  const interiorTypes = filtered.filter((st) => st.category === "INTERIOR");
  const exteriorTypes = filtered.filter((st) => st.category === "EXTERIOR");

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold flex items-center gap-2"
            data-testid="text-page-title"
          >
            <Type className="h-5 w-5" />
            Sign Types
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure the types of signs available for proposals. Add attributes like finishes and
            materials.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} data-testid="button-add-sign-type">
              <Plus className="h-4 w-4 mr-2" />
              Add Sign Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingType ? "Edit Sign Type" : "New Sign Type"}</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 -mx-6 px-6">
              <SignTypeEditor signType={editingType} onClose={handleClose} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-sign-types"
            type="search"
            placeholder="Search by name, description, or attribute..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as "ALL" | "INTERIOR" | "EXTERIOR")}
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
      </div>

      {[
        { label: "Interior", types: interiorTypes, category: "INTERIOR" as const },
        { label: "Exterior", types: exteriorTypes, category: "EXTERIOR" as const },
      ]
        .filter(({ category }) => categoryFilter === "ALL" || categoryFilter === category)
        .map(({ label: groupLabel, types }) => (
          <div key={groupLabel}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
              {groupLabel} Sign Types ({types.length})
            </h2>
            {types.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center text-sm text-muted-foreground">
                  No {groupLabel.toLowerCase()} sign types configured.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {types.map((st) => (
                  <Card key={st.id} data-testid={`card-sign-type-${st.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-medium text-sm"
                            data-testid={`text-sign-type-label-${st.id}`}
                          >
                            {st.label}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {st.name}
                          </Badge>
                          {!st.active && (
                            <Badge variant="secondary" className="text-[10px]">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        {st.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {st.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(st)}
                          data-testid={`button-edit-sign-type-${st.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Remove this sign type?")) {
                              deleteMutation.mutate(st.id);
                            }
                          }}
                          data-testid={`button-delete-sign-type-${st.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    {(st.attributes ?? []).length > 0 && (
                      <CardContent className="px-4 pb-3 pt-0">
                        <div className="flex flex-wrap gap-1">
                          {(st.attributes ?? []).map((attr, i) => (
                            <Badge
                              key={`${st.id}-attr-${i}-${attr}`}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {attr}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}

      <FeedbackDashboard />

      <MockupTestBench signTypes={signTypesData ?? []} />
    </div>
  );
}
