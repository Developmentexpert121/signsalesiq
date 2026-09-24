import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiUpload } from "@/lib/api";
import { buildMockupSrc } from "@/lib/buildMockupSrc";
import { ENABLE_GBB_TIERS } from "@/lib/featureFlags";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isFullSceneOnly } from "@shared/fullSceneOnlySignTypes";
import type { Asset, Opportunity, Output, Plane, SignSpec, SignType } from "@shared/schema";
import { BUDGET_LABELS, OPPORTUNITY_STATUS_LABELS, REQUIRED_FOOTER } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crop,
  Download,
  Edit,
  Eye,
  FileText,
  Flag,
  Image as ImageIcon,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Maximize2,
  MousePointer2,
  Phone,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  OPEN: {
    bg: "bg-green-500/10",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-500",
  },
  WON: {
    bg: "bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-500",
  },
  LOST: { bg: "bg-red-500/10", text: "text-red-700 dark:text-red-400", border: "border-red-500" },
  FOLLOW_UP: {
    bg: "bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-500",
  },
};

import ImageCropTool from "@/components/ImageCropTool";
import ImageZoomDialog from "@/components/ImageZoomDialog";
import { MockupFeedbackPanel } from "@/components/MockupFeedbackPanel";
import { SignTypePickerDialog } from "@/pages/opportunities/sign-type-picker-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useCallback, useEffect, useRef, useState } from "react";

function PlaneSelector({
  canvasAsset,
  opportunityId,
  existingPlane,
  signSpecId,
}: {
  canvasAsset: Asset;
  opportunityId: string;
  existingPlane?: Plane | null;
  signSpecId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>(existingPlane?.points ?? []);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const { toast } = useToast();

  const [refMode, setRefMode] = useState(false);
  const [refLine, setRefLine] = useState<{ x: number; y: number }[]>(
    existingPlane?.referenceLine ?? []
  );
  const [refLengthInches, setRefLengthInches] = useState<number>(
    existingPlane?.referenceLengthInches ?? 0
  );
  const [useHardShape, setUseHardShape] = useState<boolean>(
    existingPlane ? !existingPlane.straightenToRect : false
  );
  const [refUnit, setRefUnit] = useState<"inches" | "feet">("inches");
  const [refInputVal, setRefInputVal] = useState<string>(
    existingPlane?.referenceLengthInches ? String(existingPlane.referenceLengthInches) : ""
  );
  const [draggingRefIdx, setDraggingRefIdx] = useState<number | null>(null);

  useEffect(() => {
    if (existingPlane?.points) {
      setPoints(existingPlane.points);
    }
    if (existingPlane?.referenceLine) {
      setRefLine(existingPlane.referenceLine);
      setRefMode(true);
    }
    if (existingPlane?.referenceLengthInches) {
      setRefLengthInches(existingPlane.referenceLengthInches);
      setRefInputVal(String(existingPlane.referenceLengthInches));
      setRefUnit("inches");
    }
  }, [existingPlane]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = `/api/uploads/${canvasAsset.filename}`;
  }, [canvasAsset.filename]);

  const getBaseScale = useCallback(() => {
    if (!imgRef.current) return 1;
    const containerW = containerRef.current?.clientWidth || 800;
    return Math.min(containerW / imgRef.current.naturalWidth, 1);
  }, []);

  const clientToImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const cssScale = rect.width / canvas.width;
      const baseScale = getBaseScale();
      const canvasX = (clientX - rect.left) / cssScale;
      const canvasY = (clientY - rect.top) / cssScale;
      const imgX = (canvasX - panOffset.x) / (baseScale * zoom);
      const imgY = (canvasY - panOffset.y) / (baseScale * zoom);
      return { x: Math.round(imgX), y: Math.round(imgY) };
    },
    [zoom, panOffset, getBaseScale]
  );

  const estimatedDimensions = (() => {
    if (refLine.length !== 2 || !refLengthInches || refLengthInches <= 0 || points.length !== 4)
      return null;
    const refPixelDist = Math.sqrt(
      (refLine[1].x - refLine[0].x) ** 2 + (refLine[1].y - refLine[0].y) ** 2
    );
    if (refPixelDist < 1) return null;
    const pixelsPerInch = refPixelDist / refLengthInches;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const planePixelW = Math.max(...xs) - Math.min(...xs);
    const planePixelH = Math.max(...ys) - Math.min(...ys);
    const widthInches = planePixelW / pixelsPerInch;
    const heightInches = planePixelH / pixelsPerInch;
    const sqFt = (widthInches * heightInches) / 144;
    return { widthInches, heightInches, sqFt };
  })();

  const formatDimension = (inches: number) => {
    if (inches >= 24) {
      const ft = Math.floor(inches / 12);
      const remainIn = Math.round(inches % 12);
      return remainIn > 0 ? `${ft}' ${remainIn}"` : `${ft}'`;
    }
    return `${Math.round(inches)}"`;
  };

  const drawCanvas = useCallback(() => {
    if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = imgRef.current;
    const baseScale = getBaseScale();

    canvas.width = img.naturalWidth * baseScale;
    canvas.height = img.naturalHeight * baseScale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(baseScale * zoom, baseScale * zoom);
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    if (points.length > 0) {
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(baseScale * zoom, baseScale * zoom);

      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2 / (baseScale * zoom);
      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      if (points.length === 4) {
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();

      const pointRadius = 8 / (baseScale * zoom);
      points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = draggingIdx === i ? "#ef4444" : "#3b82f6";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2 / (baseScale * zoom);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(10, 12 / (baseScale * zoom))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${i + 1}`, p.x, p.y);
      });
      ctx.restore();
    }

    if (refLine.length > 0) {
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(baseScale * zoom, baseScale * zoom);

      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3 / (baseScale * zoom);
      ctx.setLineDash([8 / (baseScale * zoom), 4 / (baseScale * zoom)]);
      if (refLine.length === 2) {
        ctx.beginPath();
        ctx.moveTo(refLine[0].x, refLine[0].y);
        ctx.lineTo(refLine[1].x, refLine[1].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const refPointRadius = 8 / (baseScale * zoom);
      refLine.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, refPointRadius, 0, Math.PI * 2);
        ctx.fillStyle = draggingRefIdx === i ? "#ef4444" : "#f59e0b";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2 / (baseScale * zoom);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(10, 12 / (baseScale * zoom))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`R${i + 1}`, p.x, p.y);
      });

      if (refLine.length === 2 && refLengthInches > 0) {
        const midX = (refLine[0].x + refLine[1].x) / 2;
        const midY = (refLine[0].y + refLine[1].y) / 2;
        const labelText =
          refLengthInches >= 24
            ? `${Math.round((refLengthInches / 12) * 10) / 10} ft`
            : `${refLengthInches}"`;
        const fontSize = Math.max(14, 16 / (baseScale * zoom));
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = "rgba(245, 158, 11, 0.85)";
        ctx.fillRect(
          midX - textWidth / 2 - 4,
          midY - fontSize / 2 - 2,
          textWidth + 8,
          fontSize + 4
        );
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, midX, midY);
      }

      ctx.restore();
    }
  }, [
    imgLoaded,
    points,
    zoom,
    panOffset,
    draggingIdx,
    refLine,
    refLengthInches,
    draggingRefIdx,
    getBaseScale,
  ]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Redraw when the container is resized (covers the case where clientWidth was 0
  // on first mount and becomes non-zero after layout completes).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (canvasRef.current && (canvasRef.current.width === 0 || canvasRef.current.height === 0)) {
        drawCanvas();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [drawCanvas]);

  const findNearPoint = useCallback(
    (clientX: number, clientY: number): { type: "plane" | "ref"; idx: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const imgCoords = clientToImageCoords(clientX, clientY);
      const baseScale = getBaseScale();
      const screenHitRadius = 12 / (baseScale * zoom);

      if (refMode) {
        for (let i = 0; i < refLine.length; i++) {
          const dist = Math.sqrt(
            (imgCoords.x - refLine[i].x) ** 2 + (imgCoords.y - refLine[i].y) ** 2
          );
          if (dist < screenHitRadius) return { type: "ref", idx: i };
        }
      }

      for (let i = 0; i < points.length; i++) {
        const dist = Math.sqrt((imgCoords.x - points[i].x) ** 2 + (imgCoords.y - points[i].y) ** 2);
        if (dist < screenHitRadius) return { type: "plane", idx: i };
      }
      return null;
    },
    [points, refLine, refMode, clientToImageCoords, getBaseScale, zoom]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
        return;
      }
      const near = findNearPoint(e.clientX, e.clientY);
      if (near) {
        if (near.type === "ref") {
          setDraggingRefIdx(near.idx);
        } else {
          setDraggingIdx(near.idx);
        }
        e.preventDefault();
      }
    },
    [findNearPoint, panOffset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanning) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cssScale = rect.width / canvas.width;
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPanOffset({
          x: panStartRef.current.ox + dx / cssScale,
          y: panStartRef.current.oy + dy / cssScale,
        });
        return;
      }
      if (draggingRefIdx !== null) {
        const coords = clientToImageCoords(e.clientX, e.clientY);
        setRefLine((prev) => prev.map((p, i) => (i === draggingRefIdx ? coords : p)));
        return;
      }
      if (draggingIdx === null) return;
      const coords = clientToImageCoords(e.clientX, e.clientY);
      setPoints((prev) => prev.map((p, i) => (i === draggingIdx ? coords : p)));
    },
    [draggingIdx, draggingRefIdx, isPanning, clientToImageCoords]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingIdx(null);
    setDraggingRefIdx(null);
    setIsPanning(false);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (draggingIdx !== null || draggingRefIdx !== null || isPanning) return;
      if (findNearPoint(e.clientX, e.clientY) !== null) return;

      const coords = clientToImageCoords(e.clientX, e.clientY);

      if (refMode && refLine.length < 2) {
        setRefLine((prev) => [...prev, coords]);
        return;
      }

      if (!refMode && points.length < 4) {
        setPoints((prev) => [...prev, coords]);
      }
    },
    [
      points.length,
      refLine.length,
      refMode,
      draggingIdx,
      draggingRefIdx,
      isPanning,
      clientToImageCoords,
      findNearPoint,
    ]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.min(Math.max(prev * delta, 0.5), 5));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [imgLoaded]);

  const undoLastPoint = useCallback(() => {
    setPoints((prev) => prev.slice(0, -1));
  }, []);

  const handleRefInputChange = (val: string) => {
    setRefInputVal(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setRefLengthInches(refUnit === "feet" ? Math.round(num * 12) : Math.round(num));
    }
  };

  const handleRefUnitChange = (unit: "inches" | "feet") => {
    const num = parseFloat(refInputVal);
    if (!isNaN(num) && num > 0) {
      let newDisplayVal: number;
      if (unit === "feet" && refUnit === "inches") {
        newDisplayVal = Math.round((num / 12) * 10) / 10;
      } else if (unit === "inches" && refUnit === "feet") {
        newDisplayVal = Math.round(num * 12);
      } else {
        newDisplayVal = num;
      }
      setRefInputVal(String(newDisplayVal));
      setRefLengthInches(
        unit === "feet" ? Math.round(newDisplayVal * 12) : Math.round(newDisplayVal)
      );
    }
    setRefUnit(unit);
  };

  const savePlaneMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { points, straightenToRect: !useHardShape };
      if (refLine.length === 2 && refLengthInches > 0) {
        payload.referenceLine = refLine;
        payload.referenceLengthInches = refLengthInches;
      }
      const endpoint = signSpecId
        ? `/api/sign-specs/${signSpecId}/plane`
        : `/api/opportunities/${opportunityId}/plane`;
      const res = await apiRequest("POST", endpoint, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      toast({
        title: "Plane saved",
        description: estimatedDimensions
          ? `Plane saved. Estimated sign area: ${formatDimension(estimatedDimensions.widthInches)} × ${formatDimension(estimatedDimensions.heightInches)} (${estimatedDimensions.sqFt.toFixed(1)} sq ft)`
          : "The placement plane has been defined.",
      });
    },
  });

  const resetPlaneMutation = useMutation({
    mutationFn: async () => {
      const endpoint = signSpecId
        ? `/api/sign-specs/${signSpecId}/plane`
        : `/api/opportunities/${opportunityId}/plane`;
      const res = await apiRequest("DELETE", endpoint);
      return res.json();
    },
    onSuccess: () => {
      setPoints([]);
      setRefLine([]);
      setRefLengthInches(0);
      setRefInputVal("");
      setUseHardShape(false);
      setRefMode(false);
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      toast({
        title: "Plane reset",
        description: "The placement plane has been cleared.",
      });
    },
  });

  const hasPlaneData = points.length > 0 || refLine.length > 0 || !!existingPlane;

  const stickyBarState: "empty" | "points" | "scaled" = estimatedDimensions
    ? "scaled"
    : points.length === 4
      ? "points"
      : "empty";

  const refDisplayLabel =
    refLengthInches > 0
      ? refLengthInches >= 24
        ? `${Math.round((refLengthInches / 12) * 10) / 10} ft`
        : `${refLengthInches}"`
      : null;

  return (
    <div className="space-y-3">
      {/* Action toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((prev) => Math.max(prev * 0.8, 0.5))}
            data-testid="button-zoom-out"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span
            className="text-xs text-muted-foreground w-10 text-center tabular-nums"
            data-testid="text-zoom-level"
          >
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((prev) => Math.min(prev * 1.25, 5))}
            data-testid="button-zoom-in"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 ml-1 text-xs"
            onClick={() => {
              setZoom(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            data-testid="button-reset-view"
            title="Fit to window"
          >
            <Maximize2 className="h-3 w-3 mr-1" /> Fit
          </Button>
        </div>

        {/* Point / reference action buttons */}
        <div className="flex gap-2 flex-wrap items-center">
          {!refMode && points.length > 0 && points.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              onClick={undoLastPoint}
              data-testid="button-undo-point"
            >
              Undo
            </Button>
          )}
          {!refMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPoints([])}
              data-testid="button-clear-points"
            >
              Clear
            </Button>
          )}
          {refMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefLine([]);
              }}
              data-testid="button-clear-ref"
            >
              Clear Reference
            </Button>
          )}
          {hasPlaneData && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => resetPlaneMutation.mutate()}
              disabled={resetPlaneMutation.isPending}
              data-testid="button-reset-plane"
            >
              Reset Plane
            </Button>
          )}
          <label
            className="flex items-center gap-1.5 cursor-pointer select-none"
            data-testid="label-hard-shape"
          >
            <Checkbox
              checked={useHardShape}
              onCheckedChange={(v) => setUseHardShape(!!v)}
              data-testid="checkbox-hard-shape"
              id="checkbox-hard-shape"
            />
            <span className="text-xs text-muted-foreground">Warp to exact shape</span>
          </label>
          <Button
            size="sm"
            disabled={points.length !== 4 || savePlaneMutation.isPending}
            onClick={() => savePlaneMutation.mutate()}
            data-testid="button-save-plane"
          >
            {savePlaneMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save Plane
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="border rounded-md overflow-hidden bg-muted/30">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          className="cursor-crosshair w-full"
          style={{
            cursor:
              draggingIdx !== null || draggingRefIdx !== null
                ? "grabbing"
                : isPanning
                  ? "grabbing"
                  : undefined,
          }}
          data-testid="canvas-plane-selector"
        />
      </div>

      {/* Sticky status / instruction bar */}
      {stickyBarState === "scaled" && estimatedDimensions ? (
        <div
          className="flex items-center gap-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5"
          data-testid="bar-scale-set"
        >
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-green-800 dark:text-green-200">
              Scale set · Sign area ≈ {formatDimension(estimatedDimensions.widthInches)} ×{" "}
              {formatDimension(estimatedDimensions.heightInches)}
            </span>
            <span className="text-xs text-green-700 dark:text-green-300 ml-2">
              ({estimatedDimensions.sqFt.toFixed(1)} sq ft
              {refDisplayLabel ? ` · based on ${refDisplayLabel} reference` : ""})
            </span>
          </div>
        </div>
      ) : stickyBarState === "points" ? (
        <div
          className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5"
          data-testid="bar-add-reference"
        >
          <Ruler className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <span className="font-semibold">Optional:</span> Enable the reference measurement below
            to estimate sign dimensions — draw a line across a known feature (door, storefront
            width, window) and enter its real size.
          </p>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 bg-muted/40 border border-border rounded-lg px-4 py-2.5"
          data-testid="bar-instructions"
        >
          <MousePointer2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Click 4 corners <span className="font-medium text-foreground">clockwise</span> to define
            the sign placement area
            {points.length > 0 && ` · ${points.length}/4 placed`} ·{" "}
            <span className="font-medium text-foreground">Right-click drag</span> to pan ·{" "}
            <span className="font-medium text-foreground">Scroll</span> or use +/− to zoom
          </p>
        </div>
      )}

      {/* Reference measurement section */}
      {points.length === 4 && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={refMode}
              onCheckedChange={(checked) => {
                setRefMode(!!checked);
                if (!checked) {
                  setRefLine([]);
                  setRefLengthInches(0);
                  setRefInputVal("");
                }
              }}
              data-testid="checkbox-ref-measurement"
            />
            <Label className="text-sm flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-amber-600" />
              Add Reference Measurement (for estimating sign area size)
            </Label>
          </div>

          {refMode && (
            <div className="space-y-3 pl-6">
              <p className="text-xs text-muted-foreground">
                {refLine.length < 2
                  ? `Click 2 points on the photo to draw a reference line across a known feature (${refLine.length}/2 points placed).`
                  : "Reference line set. Enter its real-world size below."}
              </p>

              {refLine.length === 2 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-xs whitespace-nowrap">Reference length:</Label>
                  <Input
                    type="number"
                    value={refInputVal}
                    onChange={(e) => handleRefInputChange(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-24 h-8 text-sm"
                    data-testid="input-ref-length"
                  />
                  <Select
                    value={refUnit}
                    onValueChange={(v) => handleRefUnitChange(v as "inches" | "feet")}
                  >
                    <SelectTrigger className="w-24 h-8 text-sm" data-testid="select-ref-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inches">inches</SelectItem>
                      <SelectItem value="feet">feet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SignSpecDetail({
  spec,
  opportunityId,
  opportunity,
  signTypes,
  allAssets,
  allOutputs,
  allPlanes,
  isSuperAdmin,
  onBack,
}: {
  spec: SignSpec;
  opportunityId: string;
  opportunity: Opportunity;
  signTypes: SignType[];
  allAssets: Asset[];
  allOutputs: Output[];
  allPlanes: Plane[];
  isSuperAdmin?: boolean;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "details" | "assets" | "plane" | "generate" | "results"
  >("details");
  const [useAI, setUseAI] = useState(true);
  const [localPrompt, setLocalPrompt] = useState(spec.promptBox ?? "");
  const [promptDirty, setPromptDirty] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const fullSceneOnly = isFullSceneOnly(spec.signType);
  const canvasAsset = spec.canvasAssetId
    ? allAssets.find((a) => a.id === spec.canvasAssetId)
    : null;
  const logoAsset = spec.logoAssetId ? allAssets.find((a) => a.id === spec.logoAssetId) : null;
  const specPlane = allPlanes.find((p) => p.signSpecId === spec.id) ?? null;
  const signTypeLabels = Object.fromEntries(signTypes.map((st) => [st.name, st.label]));
  const filteredSignTypes = signTypes.filter(
    (st) => st.category === spec.locationType && st.active !== false
  );
  const specOutputs = allOutputs.filter((o) => o.signSpecId === spec.id);

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload(`/api/sign-specs/${spec.id}/upload-photo`, formData);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      toast({ title: "Site photo uploaded" });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload(`/api/sign-specs/${spec.id}/upload-logo`, formData);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      toast({ title: "Logo uploaded" });
    },
  });

  const clearPhotoMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/sign-specs/${spec.id}/photo`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      toast({ title: "Site photo removed", description: "Placement plane reset." });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to remove site photo",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const clearLogoMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/sign-specs/${spec.id}/logo`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      toast({ title: "Logo removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove logo", description: err.message, variant: "destructive" });
    },
  });

  const updateSpecMutation = useMutation({
    mutationFn: async (data: Partial<SignSpec>) => {
      const res = await apiRequest("PATCH", `/api/sign-specs/${spec.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (promptDirty) {
        await apiRequest("PATCH", `/api/sign-specs/${spec.id}`, { promptBox: localPrompt || null });
        setPromptDirty(false);
      }
      const res = await apiRequest("POST", `/api/sign-specs/${spec.id}/generate`, { useAI });
      return res.json();
    },
    onSuccess: async (data: any) => {
      await queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      setActiveTab("results");
      if (data?.aiFailureReason) {
        toast({ title: "AI Mockup Temporarily Unavailable", description: data.aiFailureReason });
      } else {
        toast({ title: "Mockups generated" });
      }
    },
    onError: (err) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const tabs = [
    { id: "details" as const, label: "Sign Details", icon: <Layers className="h-3.5 w-3.5" /> },
    {
      id: "assets" as const,
      label: "Assets",
      icon: <Camera className="h-3.5 w-3.5" />,
      badge: !!(canvasAsset || logoAsset),
    },
    {
      id: "plane" as const,
      label: "Plane",
      icon: <MousePointer2 className="h-3.5 w-3.5" />,
      badge: !!specPlane,
      disabled: fullSceneOnly || !canvasAsset,
    },
    { id: "generate" as const, label: "Generate", icon: <Zap className="h-3.5 w-3.5" /> },
    {
      id: "results" as const,
      label: "Results",
      icon: <Eye className="h-3.5 w-3.5" />,
      badge: specOutputs.length > 0,
    },
  ];

  return (
    <div className="space-y-4" data-testid={`detail-sign-spec-${spec.id}`}>
      <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-specs">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="min-w-0">
          <h3 className="font-semibold flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{signTypeLabels[spec.signType] ?? spec.signType}</Badge>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {spec.locationType} · {BUDGET_LABELS[spec.budgetRange]} · {spec.signDuration}
            </span>
          </h3>
        </div>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : tab.disabled
                  ? "border-transparent text-muted-foreground/40 cursor-not-allowed"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
            data-testid={`tab-${tab.id}`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && <span className="h-1.5 w-1.5 rounded-full bg-chart-2" />}
          </button>
        ))}
      </div>

      {activeTab === "details" && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="text-sm font-semibold">Sign Specifications</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Location</label>
                <Select
                  value={spec.locationType}
                  onValueChange={(v) => updateSpecMutation.mutate({ locationType: v as any })}
                >
                  <SelectTrigger data-testid={`select-spec-location-${spec.id}`}>
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
                <label className="text-xs text-muted-foreground">Sign Type</label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                  data-testid={`button-spec-signtype-picker-${spec.id}`}
                  className="w-full justify-between font-normal mt-1"
                >
                  <span>{signTypeLabels[spec.signType] ?? spec.signType}</span>
                  <Plus className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
                <SignTypePickerDialog
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  signTypes={signTypes}
                  value={spec.signType}
                  onChange={(v) => {
                    const newSt = signTypes.find((s) => s.name === v);
                    const currentSt = signTypes.find((s) => s.name === spec.signType);
                    const updates: any = { signType: v };
                    const currentIsSample =
                      !localPrompt.trim() || localPrompt === currentSt?.samplePrompt;
                    if (newSt?.samplePrompt && currentIsSample) {
                      updates.promptBox = newSt.samplePrompt;
                      setLocalPrompt(newSt.samplePrompt);
                      setPromptDirty(false);
                    }
                    updateSpecMutation.mutate(updates);
                  }}
                  defaultCategory={spec.locationType as any}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Budget Range</label>
                <Select
                  value={spec.budgetRange}
                  onValueChange={(v) => updateSpecMutation.mutate({ budgetRange: v as any })}
                >
                  <SelectTrigger data-testid={`select-spec-budget-${spec.id}`}>
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
              <div>
                <label className="text-xs text-muted-foreground">Sign Duration</label>
                <Select
                  value={spec.signDuration}
                  onValueChange={(v) => updateSpecMutation.mutate({ signDuration: v as any })}
                >
                  <SelectTrigger data-testid={`select-spec-duration-${spec.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERMANENT">Permanent</SelectItem>
                    <SelectItem value="TEMPORARY">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Target Audience</label>
                <Select
                  value={spec.targetAudience}
                  onValueChange={(v) => updateSpecMutation.mutate({ targetAudience: v as any })}
                >
                  <SelectTrigger data-testid={`select-spec-audience-${spec.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELL">Sell</SelectItem>
                    <SelectItem value="INFORM">Inform</SelectItem>
                    <SelectItem value="DIRECT">Direct</SelectItem>
                    <SelectItem value="BRAND">Brand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Read Distance (ft)</label>
                <Input
                  type="number"
                  value={spec.readDistanceFt ?? ""}
                  onChange={(e) =>
                    updateSpecMutation.mutate({
                      readDistanceFt: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  placeholder="e.g. 50"
                  data-testid={`input-spec-distance-${spec.id}`}
                />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={spec.showSignCode ?? false}
                    onCheckedChange={(v) => updateSpecMutation.mutate({ showSignCode: v })}
                    data-testid={`switch-spec-signcode-${spec.id}`}
                  />
                  <Label className="text-sm">Sign Code Lookup</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "assets" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Logo
                <p className="text-sm text-muted-foreground">
                  (if no logo is uploaded the company name will be used in the mockup)
                </p>
                {logoAsset && <CheckCircle2 className="h-4 w-4 text-chart-2" />}
              </h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {logoAsset ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center h-20 w-40 bg-muted/30 rounded-md border p-2">
                    <img
                      src={`/api/uploads/${logoAsset.filename}`}
                      alt="Logo"
                      className="max-h-full max-w-full object-contain"
                      data-testid={`img-spec-logo-${spec.id}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{logoAsset.mimeType}</p>
                    <div className="flex items-center gap-2">
                      <ImageZoomDialog
                        src={`/api/uploads/${logoAsset.filename}`}
                        alt="Logo"
                        title="Logo"
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            data-testid={`button-zoom-logo-${spec.id}`}
                            aria-label="Zoom logo"
                          >
                            <ZoomIn className="h-3 w-3 mr-1" /> Zoom
                          </Button>
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadLogoMutation.isPending || clearLogoMutation.isPending}
                        data-testid={`button-replace-logo-${spec.id}`}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Replace
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (!confirm("Remove the logo for this sign type?")) return;
                          clearLogoMutation.mutate();
                        }}
                        disabled={clearLogoMutation.isPending}
                        data-testid={`button-clear-logo-${spec.id}`}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Clear
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center gap-3 p-4 border border-dashed rounded-md cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                  data-testid={`button-upload-logo-${spec.id}`}
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Upload logo for this sign type</p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, SVG, or PDF · Max 10 MB
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*,.pdf,.svg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    toast({
                      title: "File too large",
                      description: "Logo must be 10 MB or smaller.",
                      variant: "destructive",
                    });
                    e.target.value = "";
                    return;
                  }
                  uploadLogoMutation.mutate(file);
                  e.target.value = "";
                }}
              />
              {uploadLogoMutation.isPending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading logo...
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4" /> Site Photo
                {!fullSceneOnly && canvasAsset && <CheckCircle2 className="h-4 w-4 text-chart-2" />}
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {fullSceneOnly ? (
                <div className="flex items-start gap-3 p-4 border border-dashed rounded-md bg-muted/20">
                  <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">No site photo needed</p>
                    <p className="text-xs text-muted-foreground">
                      This sign type generates a full scene from reference images — skip straight to
                      the Generate tab.
                    </p>
                  </div>
                </div>
              ) : canvasAsset ? (
                <div className="space-y-3">
                  <div className="w-full max-w-2xl bg-muted/30 rounded-md border overflow-hidden">
                    <img
                      src={`/api/uploads/${canvasAsset.filename}`}
                      alt="Site photo"
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ImageZoomDialog
                      src={`/api/uploads/${canvasAsset.filename}`}
                      alt="Site photo"
                      title="Site photo"
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label="Zoom site photo"
                        >
                          <ZoomIn className="h-3 w-3 mr-1" /> Zoom
                        </Button>
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadPhotoMutation.isPending || clearPhotoMutation.isPending}
                      data-testid={`button-replace-photo-${spec.id}`}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Replace Photo
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (
                          !confirm(
                            "Remove the site photo? This will also reset the placement plane."
                          )
                        )
                          return;
                        clearPhotoMutation.mutate();
                      }}
                      disabled={clearPhotoMutation.isPending}
                      data-testid={`button-clear-photo-${spec.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Clear Photo
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-16 border border-dashed rounded-md cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => photoInputRef.current?.click()}
                  data-testid={`button-upload-photo-${spec.id}`}
                >
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Upload site photo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click to browse or drag and drop
                  </p>
                </div>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadPhotoMutation.mutate(file);
                  e.target.value = "";
                }}
              />
              {uploadPhotoMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                </div>
              )}
              {canvasAsset && (
                <p className="text-xs text-muted-foreground">
                  Photo uploaded. Go to the{" "}
                  <button onClick={() => setActiveTab("plane")} className="text-primary underline">
                    Plane
                  </button>{" "}
                  tab to define the sign placement area.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "plane" && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MousePointer2 className="h-4 w-4" /> Placement Plane &amp; Reference Measurement
              {specPlane && <CheckCircle2 className="h-4 w-4 text-chart-2" />}
            </h3>
            <p className="text-sm italic text-muted-foreground mt-1">
              For best results, use a straight-on, level photo. Photos taken at an angle can affect
              dimension estimates — but they'll still work great for generating mockups! These
              measurements are estimates only.
            </p>
          </CardHeader>
          <CardContent>
            {canvasAsset ? (
              <PlaneSelector
                canvasAsset={canvasAsset}
                opportunityId={opportunityId}
                existingPlane={specPlane}
                signSpecId={spec.id}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Camera className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Upload a site photo first to define the placement plane.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setActiveTab("assets")}
                >
                  Go to Assets
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "generate" && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" /> Generate Mockups
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Mockup Instructions</Label>
              <Textarea
                placeholder="Describe how the sign should look, special requirements, placement notes..."
                className="resize-none mt-1"
                rows={4}
                value={localPrompt}
                onChange={(e) => {
                  setLocalPrompt(e.target.value);
                  setPromptDirty(true);
                }}
                data-testid={`input-spec-prompt-${spec.id}`}
              />
              {promptDirty && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    updateSpecMutation.mutate({ promptBox: localPrompt || null });
                    setPromptDirty(false);
                  }}
                  disabled={updateSpecMutation.isPending}
                  data-testid={`button-save-prompt-${spec.id}`}
                >
                  <Save className="h-3 w-3 mr-1" /> Save Instructions
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={useAI}
                onCheckedChange={setUseAI}
                data-testid={`switch-spec-ai-${spec.id}`}
              />
              <Label>AI Mockups</Label>
            </div>

            <div className="bg-muted/30 rounded-md p-3 border text-sm space-y-1">
              <p className="text-muted-foreground">
                <strong>Ready to generate:</strong>
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li className="flex items-center gap-1">
                  {canvasAsset ? (
                    <CheckCircle2 className="h-3 w-3 text-chart-2" />
                  ) : (
                    <XCircle className="h-3 w-3 text-muted-foreground/40" />
                  )}
                  Site photo {canvasAsset ? "uploaded" : "(optional)"}
                </li>
                <li className="flex items-center gap-1">
                  {specPlane ? (
                    <CheckCircle2 className="h-3 w-3 text-chart-2" />
                  ) : (
                    <XCircle className="h-3 w-3 text-muted-foreground/40" />
                  )}
                  Placement plane {specPlane ? "defined" : "(optional)"}
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-chart-2" />
                  Sign type: {signTypeLabels[spec.signType] ?? spec.signType}
                </li>
              </ul>
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid={`button-generate-spec-${spec.id}`}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Mockups...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />{" "}
                  {specOutputs.length > 0 ? "Re-Generate Mockups" : "Generate Mockups"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "results" && (
        <div>
          {specOutputs.length > 0 ? (
            <ResultsViewer
              outputs={specOutputs}
              canvasFilename={canvasAsset?.filename}
              isSuperAdmin={isSuperAdmin}
              opportunityId={opportunityId}
              opportunity={opportunity}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">
                  No results yet. Generate mockups first.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setActiveTab("generate")}
                >
                  Go to Generate
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SignSpecManager({
  opportunityId,
  opportunity,
  signSpecs,
  signTypes,
  allAssets,
  allOutputs,
  allPlanes,
  isSuperAdmin,
  selectedSpecId,
  onSelectSpec,
}: {
  opportunityId: string;
  opportunity: Opportunity;
  signSpecs: SignSpec[];
  signTypes: SignType[];
  allAssets: Asset[];
  allOutputs: Output[];
  allPlanes: Plane[];
  isSuperAdmin?: boolean;
  selectedSpecId: string | null;
  onSelectSpec: (id: string | null) => void;
}) {
  const { toast } = useToast();
  const [newSignType, setNewSignType] = useState<string>("");
  const signTypeLabels = Object.fromEntries(signTypes.map((st) => [st.name, st.label]));
  const activeSignTypes = signTypes.filter((st) => st.active !== false);

  const addSpecMutation = useMutation({
    mutationFn: async (signType: string) => {
      const selectedSt = signTypes.find((st) => st.name === signType);
      const res = await apiRequest("POST", `/api/opportunities/${opportunityId}/sign-specs`, {
        signType,
        locationType: selectedSt?.category || opportunity.locationType,
        budgetRange: opportunity.budgetRange,
        signDuration: opportunity.signDuration,
        targetAudience: opportunity.targetAudience,
        showSignCode: selectedSt?.showSignCode ?? opportunity.showSignCode,
        sortOrder: signSpecs.length,
      });
      return res.json();
    },
    onSuccess: (newSpec: any) => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      toast({ title: "Sign type added" });
      setNewSignType("");
      onSelectSpec(newSpec.id);
    },
  });

  const deleteSpecMutation = useMutation({
    mutationFn: async (specId: string) => {
      await apiRequest("DELETE", `/api/sign-specs/${specId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      onSelectSpec(null);
      toast({ title: "Sign type removed" });
    },
  });

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/opportunities/${opportunityId}/generate-all-specs`,
        { useAI: true }
      );
      return res.json();
    },
    onSuccess: async (data: any) => {
      await queryClient.refetchQueries({ queryKey: ["/api/opportunities", opportunityId] });
      if (data?.aiFailureReason) {
        toast({ title: "Some mockups may be incomplete", description: data.aiFailureReason });
      } else {
        toast({ title: `All sign types generated (${data?.totalSpecs || signSpecs.length})` });
      }
    },
    onError: (err) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const specsNeedingGeneration = signSpecs.filter((s) => {
    const specOutputs = allOutputs.filter((o) => o.signSpecId === s.id);
    if (specOutputs.length === 0) return true;
    return specOutputs.some((o) => !o.aiMockupFilename);
  });

  const selectedSpec = selectedSpecId ? signSpecs.find((s) => s.id === selectedSpecId) : null;

  if (selectedSpec) {
    return (
      <SignSpecDetail
        key={selectedSpec.id}
        spec={selectedSpec}
        opportunityId={opportunityId}
        opportunity={opportunity}
        signTypes={signTypes}
        allAssets={allAssets}
        allOutputs={allOutputs}
        allPlanes={allPlanes}
        isSuperAdmin={isSuperAdmin}
        onBack={() => onSelectSpec(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {signSpecs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">No sign types added yet</p>
          <p className="text-xs mb-4">Select a sign type below to start building your proposal.</p>
        </div>
      ) : (
        signSpecs.map((spec, index) => {
          const specPhoto = spec.canvasAssetId
            ? allAssets.find((a) => a.id === spec.canvasAssetId)
            : null;
          const specLogo = spec.logoAssetId
            ? allAssets.find((a) => a.id === spec.logoAssetId)
            : null;
          const specPlane = allPlanes.find((p) => p.signSpecId === spec.id);
          const specOutputs = allOutputs.filter((o) => o.signSpecId === spec.id);
          const hasResults = specOutputs.length > 0;

          const previousSpecsDone = signSpecs.slice(0, index).every((prevSpec) => {
            const prevOutputs = allOutputs.filter((o) => o.signSpecId === prevSpec.id);
            return prevOutputs.length > 0;
          });
          const isLocked = index > 0 && !previousSpecsDone;
          const isCurrentStep = !isLocked && (index === 0 || previousSpecsDone) && !hasResults;

          return (
            <Card
              key={spec.id}
              className={`${isLocked ? "opacity-50" : "hover-elevate cursor-pointer"} ${isCurrentStep ? "ring-2 ring-primary/40" : ""}`}
              data-testid={`card-sign-spec-${spec.id}`}
              onClick={() => !isLocked && onSelectSpec(spec.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: hasResults
                          ? "var(--chart-2)"
                          : isCurrentStep
                            ? "var(--primary)"
                            : "var(--muted)",
                        color: hasResults || isCurrentStep ? "white" : "var(--muted-foreground)",
                      }}
                    >
                      {hasResults ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {signTypeLabels[spec.signType] ?? spec.signType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {spec.locationType} · {BUDGET_LABELS[spec.budgetRange]} ·{" "}
                        {spec.signDuration}
                        {isLocked && " · Complete previous sign type first"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {specLogo && <ImageIcon className="h-3.5 w-3.5 text-chart-2" />}
                      {specPhoto && <Camera className="h-3.5 w-3.5 text-chart-2" />}
                      {specPlane && <MousePointer2 className="h-3.5 w-3.5 text-chart-2" />}
                    </div>
                    {!isLocked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSpecMutation.mutate(spec.id);
                        }}
                        disabled={deleteSpecMutation.isPending}
                        data-testid={`button-delete-spec-${spec.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {signSpecs.length >= 2 && specsNeedingGeneration.length > 0 && (
        <Button
          onClick={() => generateAllMutation.mutate()}
          disabled={generateAllMutation.isPending}
          className="w-full"
          size="lg"
          data-testid="button-generate-all-specs"
        >
          {generateAllMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating{" "}
              {specsNeedingGeneration.length} sign type
              {specsNeedingGeneration.length > 1 ? "s" : ""}...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" /> Generate All ({specsNeedingGeneration.length}{" "}
              remaining)
            </>
          )}
        </Button>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Select value={newSignType} onValueChange={setNewSignType}>
              <SelectTrigger className="flex-1" data-testid="select-new-sign-type">
                <SelectValue placeholder="Select a sign type to add..." />
              </SelectTrigger>
              <SelectContent>
                {activeSignTypes.map((st) => (
                  <SelectItem key={st.name} value={st.name}>
                    {st.label} ({st.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => newSignType && addSpecMutation.mutate(newSignType)}
              disabled={!newSignType || addSpecMutation.isPending}
              data-testid="button-add-sign-spec"
            >
              {addSpecMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function buildSimpleNote(output: Output, opportunity?: Opportunity): string {
  const parts: string[] = [];
  if (opportunity?.clientName) parts.push(`Client: ${opportunity.clientName}`);
  if (opportunity?.address) parts.push(`Location: ${opportunity.address}`);
  if (output.selectedProducts.length > 0)
    parts.push(`Products: ${output.selectedProducts.join(", ")}`);
  if (opportunity?.budgetRange)
    parts.push(`Budget: ${BUDGET_LABELS[opportunity.budgetRange] ?? opportunity.budgetRange}`);
  return parts.join(" · ");
}

function ProjectNotes({
  output,
  tier,
  opportunityId,
  opportunity,
}: {
  output: Output;
  tier: string;
  opportunityId?: string;
  opportunity?: Opportunity;
}) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(
    ENABLE_GBB_TIERS ? (output.rationaleText ?? "") : buildSimpleNote(output, opportunity)
  );
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const saveMutation = useMutation({
    mutationFn: async (text?: string) => {
      await apiRequest("PATCH", `/api/outputs/${output.id}`, {
        rationaleText: text ?? notesRef.current,
      });
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
    },
  });

  const handleManualSave = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setAutoSaveStatus("idle");
    saveMutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Notes saved" });
      },
    });
  };

  const handleChange = (value: string) => {
    setNotes(value);
    setIsDirty(true);
    setAutoSaveStatus("idle");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveStatus("saving");
      saveMutation.mutate(value, {
        onSuccess: () => {
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        },
        onError: () => {
          setAutoSaveStatus("idle");
          toast({
            title: "Auto-save failed",
            description: "Your notes were not saved. Try saving manually.",
            variant: "destructive",
          });
        },
      });
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
        apiRequest("PATCH", `/api/outputs/${output.id}`, {
          rationaleText: notesRef.current,
        }).catch(() => {});
      }
    };
  }, [output.id]);

  const polishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/outputs/${output.id}/polish-notes`, {
        notes,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.polishedText) {
        setNotes(data.polishedText);
        setIsDirty(true);
        toast({
          title: "Notes polished by AI",
          description: "Review the updated text and save when ready.",
        });
      }
    },
    onError: (err) => {
      toast({ title: "AI polish failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">
            Project Notes
            {ENABLE_GBB_TIERS && (
              <>
                {" — "}
                {tier === "GOOD"
                  ? "Good"
                  : tier === "BETTER"
                    ? "Better"
                    : tier === "BEST"
                      ? "Best"
                      : tier}
              </>
            )}
          </h4>
          {autoSaveStatus === "saving" && (
            <span
              className="text-xs text-muted-foreground flex items-center gap-1"
              data-testid={`text-autosave-saving-${tier}`}
            >
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {autoSaveStatus === "saved" && (
            <span
              className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"
              data-testid={`text-autosave-saved-${tier}`}
            >
              <CheckCircle2 className="h-3 w-3" /> Auto-saved
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Describe the project, special requirements, or any details you'd like included in the proposal..."
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          rows={4}
          className="resize-none text-sm"
          data-testid={`input-project-notes-${tier}`}
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleManualSave}
            disabled={saveMutation.isPending || !isDirty}
            data-testid={`button-save-notes-${tier}`}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-2 h-3 w-3" />
            )}
            Save Notes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => polishMutation.mutate()}
            disabled={polishMutation.isPending || !notes.trim()}
            data-testid={`button-polish-notes-${tier}`}
          >
            {polishMutation.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-3 w-3" />
            )}
            Polish with AI
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AccuracyChecklist({ output, tier }: { output: Output; tier: string }) {
  const [checks, setChecks] = useState({
    placement: false,
    perspective: false,
    scale: false,
    logoFidelity: false,
    shadows: false,
    noHallucinations: false,
  });
  const [notes, setNotes] = useState(output.accuracyNotes ?? "");
  const [isFirefly, setIsFirefly] = useState(false);

  const score = Object.values(checks).filter(Boolean).length;
  const scorePercent = Math.round((score / 6) * 100);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const field = isFirefly ? "accuracyScoreAI" : "accuracyScoreBaseline";
      await apiRequest("PATCH", `/api/outputs/${output.id}`, {
        [field]: scorePercent,
        accuracyNotes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
    },
  });

  const checkItems = [
    { key: "placement", label: "Placement on correct surface" },
    { key: "perspective", label: "Perspective matches wall plane" },
    { key: "scale", label: "Scale believable vs door/window ref" },
    { key: "logoFidelity", label: "Logo crisp / no distortion" },
    { key: "shadows", label: "Shadows/reflections consistent" },
    { key: "noHallucinations", label: "No hallucinated elements" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-semibold">
            Accuracy Checklist{ENABLE_GBB_TIERS ? ` - ${tier}` : ""}
          </h4>
          <Badge variant={scorePercent >= 80 ? "default" : "secondary"}>{scorePercent}%</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-xs">Scoring:</Label>
          <Button
            variant={!isFirefly ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFirefly(false)}
            className="text-xs"
          >
            Composite
          </Button>
          {output.aiMockupFilename && (
            <Button
              variant={isFirefly ? "default" : "outline"}
              size="sm"
              onClick={() => setIsFirefly(true)}
              className="text-xs"
            >
              AI Mockup
            </Button>
          )}
        </div>
        {checkItems.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={checks[item.key as keyof typeof checks]}
              onCheckedChange={(v) => setChecks({ ...checks, [item.key]: !!v })}
              data-testid={`check-${item.key}-${tier}`}
            />
            {item.label}
          </label>
        ))}
        <Textarea
          placeholder="Accuracy notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="resize-none text-sm"
          data-testid={`input-accuracy-notes-${tier}`}
        />
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid={`button-save-accuracy-${tier}`}
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Save Score
        </Button>
      </CardContent>
    </Card>
  );
}

function RetryImage({
  src,
  alt,
  className,
  "data-testid": testId,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement> & { "data-testid"?: string }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retries, setRetries] = useState(0);
  const MAX_RETRIES = 5;

  useEffect(() => {
    setCurrentSrc(src);
    setRetries(0);
  }, [src]);

  const handleError = () => {
    if (retries < MAX_RETRIES) {
      const delay = Math.min(1000 * 2 ** retries, 10000);
      setTimeout(() => {
        setRetries((r) => r + 1);
        setCurrentSrc(`${src}${src?.includes("?") ? "&" : "?"}_r=${retries + 1}`);
      }, delay);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      data-testid={testId}
      {...rest}
    />
  );
}

function ResultsViewer({
  outputs,
  canvasFilename,
  showInternalTools,
  isSuperAdmin,
  opportunityId,
  opportunity,
}: {
  outputs: Output[];
  canvasFilename?: string;
  showInternalTools?: boolean;
  isSuperAdmin?: boolean;
  opportunityId?: string;
  opportunity?: Opportunity;
}) {
  const [cropTarget, setCropTarget] = useState<{ url: string; filename: string } | null>(null);
  const [feedbackTargetId, setFeedbackTargetId] = useState<string | null>(null);
  const [feedbackPending, setFeedbackPending] = useState(false);

  if (outputs.length === 0) return null;

  const isTestAllMode =
    outputs.length > 3 || (outputs.length > 1 && outputs.every((o) => o.tier === "BETTER"));
  const isSingleMockup = outputs.length === 1 && !isTestAllMode;
  const tiers = ["GOOD", "BETTER", "BEST"] as const;

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const renderOutputCard = (output: Output, label: string, key: string) => {
    const rawMockupImage = output.aiMockupFilename || output.baselineImageFilename;
    const mockupImage = rawMockupImage?.replace(/\\/g, "/") ?? null;
    const tier = output.tier;
    const oppIdForUrl = opportunityId || output.opportunityId;
    const mockupSrc = buildMockupSrc(mockupImage, oppIdForUrl);

    return (
      <Card key={key}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold flex items-center gap-2">
              <Badge variant={tier === "BEST" ? "default" : "secondary"}>
                {isTestAllMode ? "TEST" : isSingleMockup || !ENABLE_GBB_TIERS ? "MOCKUP" : tier}
              </Badge>
              {label}
            </h3>
            {output.selectedProducts.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {output.selectedProducts.map((p, i) => (
                  <Badge
                    key={`${output.id}-product-${i}-${p}`}
                    variant="outline"
                    className="text-xs"
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canvasFilename ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Before
                </p>
                <div className="bg-muted/30 rounded-md border overflow-hidden">
                  <img
                    src={`/api/uploads/${canvasFilename}`}
                    alt="Before — original site photo"
                    className="w-full h-auto"
                  />
                  <ImageZoomDialog
                    src={`/api/uploads/${canvasFilename}`}
                    alt="Before — original site photo"
                    title="Original site photo"
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        aria-label="Zoom original site photo"
                      >
                        <ZoomIn className="h-3 w-3 mr-1" /> Zoom
                      </Button>
                    }
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> After
                </p>
                {mockupSrc ? (
                  <>
                    <div className="bg-muted/30 rounded-md border overflow-hidden">
                      <img src={mockupSrc} alt={`${label} mockup`} className="w-full h-auto" />
                      <ImageZoomDialog
                        src={mockupSrc}
                        alt={`${label} mockup`}
                        title={`${label} mockup`}
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            aria-label={`Zoom ${label} mockup`}
                          >
                            <ZoomIn className="h-3 w-3 mr-1" /> Zoom
                          </Button>
                        }
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-download-mockup-${key}`}
                        onClick={() =>
                          downloadImage(mockupSrc, `${label.replace(/\s+/g, "_")}_mockup.png`)
                        }
                      >
                        <Download className="mr-2 h-3 w-3" /> Save Image
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-crop-sign-${key}`}
                        onClick={() =>
                          setCropTarget({
                            url: mockupSrc,
                            filename: `${opportunityId ? opportunityId + "_" : ""}${tier}_${label.replace(/\s+/g, "_")}_sign_crop.png`,
                          })
                        }
                      >
                        <Crop className="mr-2 h-3 w-3" /> Crop Sign
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-flag-issue-${key}`}
                        onClick={() =>
                          setFeedbackTargetId((current) =>
                            current === output.id ? null : output.id
                          )
                        }
                        disabled={feedbackPending}
                      >
                        <Flag className="mr-2 h-3 w-3" /> Report Problem
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-48 bg-muted/30 rounded-md border border-dashed text-muted-foreground text-sm">
                    {output.rationaleText?.includes("FAILED")
                      ? "Generation failed"
                      : "Not generated"}
                  </div>
                )}
                {isSuperAdmin && output.accuracyScoreAI != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    AI Score: {output.accuracyScoreAI}%
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" /> AI Sign Mockup
              </p>
              {mockupSrc ? (
                <>
                  <div className="w-full max-w-2xl bg-muted/30 rounded-md border overflow-hidden mb-2">
                    <img src={mockupSrc} alt={`${label} mockup`} className="w-full h-auto" />
                    <ImageZoomDialog
                      src={mockupSrc}
                      alt={`${label} mockup`}
                      title={`${label} mockup`}
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          aria-label={`Zoom ${label} mockup`}
                        >
                          <ZoomIn className="h-3 w-3 mr-1" /> Zoom
                        </Button>
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-download-mockup-nocanvas-${key}`}
                      onClick={() =>
                        downloadImage(mockupSrc, `${label.replace(/\s+/g, "_")}_mockup.png`)
                      }
                    >
                      <Download className="mr-2 h-3 w-3" /> Save Image
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-crop-sign-nocanvas-${key}`}
                      onClick={() =>
                        setCropTarget({
                          url: mockupSrc,
                          filename: `${opportunityId ? opportunityId + "_" : ""}${tier}_${label.replace(/\s+/g, "_")}_sign_crop.png`,
                        })
                      }
                    >
                      <Crop className="mr-2 h-3 w-3" /> Crop Sign
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-flag-issue-nocanvas-${key}`}
                      onClick={() =>
                        setFeedbackTargetId((current) =>
                          current === output.id ? null : output.id
                        )
                      }
                      disabled={feedbackPending}
                    >
                      <Flag className="mr-2 h-3 w-3" /> Report Problem
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 bg-muted/30 rounded-md border border-dashed text-muted-foreground text-sm">
                  {output.rationaleText?.includes("FAILED") ? "Generation failed" : "Not generated"}
                </div>
              )}
            </div>
          )}

          {feedbackTargetId === output.id && (
            <MockupFeedbackPanel
              output={output}
              opportunityId={opportunityId || output.opportunityId}
              canRegenerate={!!output.signSpecId}
              onClose={() => setFeedbackTargetId(null)}
              onPendingChange={setFeedbackPending}
            />
          )}

          {!isTestAllMode && (
            <ProjectNotes
              output={output}
              tier={tier}
              opportunityId={opportunityId}
              opportunity={opportunity}
            />
          )}

          {isSuperAdmin && !isTestAllMode && <AccuracyChecklist output={output} tier={tier} />}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {isTestAllMode ? (
        <>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Test All Sign Types Mode - Showing {outputs.length} sign type mockups
            </p>
          </div>
          {outputs.map((output, idx) =>
            renderOutputCard(
              output,
              output.selectedProducts[0] || `Sign Type ${idx + 1}`,
              `test-${idx}`
            )
          )}
        </>
      ) : isSingleMockup || !ENABLE_GBB_TIERS ? (
        outputs.map((output, idx) => renderOutputCard(output, "Sign Mockup", `mockup-${idx}`))
      ) : (
        tiers.map((tier) => {
          const output = outputs.find((o) => o.tier === tier);
          if (!output) return null;
          return renderOutputCard(output, "Tier Results", tier);
        })
      )}

      <div className="bg-muted/30 rounded-md p-3 border">
        <p className="text-xs text-muted-foreground italic">{REQUIRED_FOOTER}</p>
      </div>

      {cropTarget && (
        <ImageCropTool
          imageUrl={cropTarget.url}
          downloadFilename={cropTarget.filename}
          onClose={() => setCropTarget(null)}
        />
      )}
    </div>
  );
}

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [signCodeOpen, setSignCodeOpen] = useState(false);

  const { data, isLoading } = useQuery<{
    opportunity: Opportunity;
    assets: Asset[];
    plane: Plane | null;
    planes: Plane[];
    outputs: Output[];
    signSpecs: SignSpec[];
  }>({
    queryKey: ["/api/opportunities", params.id],
  });

  const { data: signTypesData } = useQuery<SignType[]>({
    queryKey: ["/api/sign-types"],
  });
  const signTypeLabels = Object.fromEntries((signTypesData ?? []).map((st) => [st.name, st.label]));

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/opportunities/${params.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({ title: "Opportunity deleted" });
      navigate("/opportunities");
    },
    onError: (err) => {
      toast({
        title: "Failed to delete opportunity",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const signCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/opportunities/${params.id}/sign-code`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", params.id] });
      toast({ title: "Sign code lookup complete" });
    },
    onError: (err) => {
      toast({ title: "Sign code lookup failed", description: err.message, variant: "destructive" });
    },
  });

  const autoSignCodeTriggeredRef = useRef(false);
  useEffect(() => {
    const opp = data?.opportunity;
    const specs = data?.signSpecs ?? [];
    const needsSignCode = opp?.showSignCode || specs.some((s) => s.showSignCode);
    if (
      opp &&
      needsSignCode &&
      !opp.signCodeText &&
      opp.address &&
      !autoSignCodeTriggeredRef.current &&
      !signCodeMutation.isPending
    ) {
      autoSignCodeTriggeredRef.current = true;
      setSignCodeOpen(true);
      signCodeMutation.mutate();
    }
  }, [
    data?.opportunity?.showSignCode,
    data?.opportunity?.signCodeText,
    data?.opportunity?.address,
    data?.signSpecs?.length,
  ]);

  const [exportingSpecId, setExportingSpecId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  const exportMutation = useMutation({
    mutationFn: async (signSpecId?: string) => {
      const body = signSpecId ? { signSpecId } : undefined;
      const res = await apiRequest("POST", `/api/opportunities/${params.id}/export-pdf`, body);
      return res.json();
    },
    onSuccess: (data) => {
      const pdfSrc = buildMockupSrc(data.path, params.id) || `/api/files/${data.filename}`;
      window.open(pdfSrc, "_blank");
      toast({ title: "PDF exported" });
      setExportingSpecId(null);
      setShowExportMenu(false);
    },
    onError: (err: any) => {
      setExportingSpecId(null);
      toast({
        title: "PDF export failed",
        description: err?.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/opportunities/${params.id}/send-email-pdf`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send email");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Proposal emailed", description: `PDF sent to ${data.sentTo}` });
    },
    onError: (err: Error) => {
      toast({ title: "Email failed", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/opportunities/${params.id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/opportunities", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({ title: "Status updated" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-3 sm:p-6 text-center py-20">
        <h2 className="text-xl font-semibold mb-2">Opportunity not found</h2>
        <Link href="/opportunities">
          <Button variant="outline">Back to list</Button>
        </Link>
      </div>
    );
  }

  const { opportunity: opp, plane, planes = [], outputs, signSpecs = [] } = data;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 mt-0.5"
            onClick={() => navigate("/opportunities")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1
              className="text-lg sm:text-2xl font-bold tracking-tight truncate"
              data-testid="text-opp-title"
            >
              {opp.clientName}
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground mt-0.5">
              {opp.contactName && (
                <span className="flex items-center gap-1" data-testid="text-contact-name">
                  {opp.contactName}
                </span>
              )}
              {opp.contactName && <span className="hidden sm:inline">·</span>}
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />{" "}
                <span className="truncate">{opp.address}</span>
              </span>
              {(opp.phone || opp.email) && (
                <span className="flex items-center gap-3">
                  {opp.phone && (
                    <span className="flex items-center gap-1 truncate">
                      <Phone className="h-3 w-3 shrink-0" />{" "}
                      <span className="truncate">{opp.phone}</span>
                    </span>
                  )}
                  {opp.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" />{" "}
                      <span className="truncate">{opp.email}</span>
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/opportunities/${opp.id}/edit`}>
            <Button variant="outline" size="sm" data-testid="button-edit">
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          </Link>
          {outputs.length > 0 && signSpecs.length <= 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate(undefined)}
              disabled={exportMutation.isPending}
              data-testid="button-export-pdf"
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1" />
              )}
              Export PDF
            </Button>
          )}
          {outputs.length > 0 && signSpecs.length > 1 && (
            <div className="relative" data-testid="export-pdf-menu-container" ref={exportMenuRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu((v) => !v)}
                disabled={exportMutation.isPending}
                data-testid="button-export-pdf"
              >
                {exportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-1" />
                )}
                Export PDF
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              {showExportMenu && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-md min-w-[220px] py-1"
                  data-testid="export-pdf-dropdown"
                >
                  {signSpecs.map((spec) => (
                    <button
                      key={spec.id}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      disabled={exportMutation.isPending}
                      data-testid={`button-export-spec-${spec.id}`}
                      onClick={() => {
                        setExportingSpecId(spec.id);
                        exportMutation.mutate(spec.id);
                      }}
                    >
                      {exportMutation.isPending && exportingSpecId === spec.id ? (
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      ) : (
                        <FileText className="h-3 w-3 shrink-0" />
                      )}
                      {(spec as any).label || spec.signType}
                    </button>
                  ))}
                  <div className="border-t my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={exportMutation.isPending}
                    data-testid="button-export-full-proposal"
                    onClick={() => {
                      setExportingSpecId(null);
                      exportMutation.mutate(undefined);
                    }}
                  >
                    {exportMutation.isPending && exportingSpecId === null ? (
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    ) : (
                      <Layers className="h-3 w-3 shrink-0" />
                    )}
                    Full Proposal (all types)
                  </button>
                </div>
              )}
            </div>
          )}
          {outputs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendEmailMutation.mutate()}
              disabled={sendEmailMutation.isPending}
              data-testid="button-send-email"
            >
              {sendEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-1" />
              )}
              Send Email
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            data-testid="button-delete"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {opp.notes && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Internal Notes</p>
            <p className="text-sm">{opp.notes}</p>
          </CardContent>
        </Card>
      )}

      {(() => {
        const permitSpecs = signSpecs.filter((s) => s.showSignCode);
        const hasAnySignCode = permitSpecs.length > 0;
        if (!hasAnySignCode && !opp.showSignCode) return null;
        return (
          <Card data-testid="card-sign-code">
            <div
              className="px-4 py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/40 transition-colors rounded-t-lg select-none"
              onClick={() => setSignCodeOpen((o) => !o)}
              data-testid="button-toggle-sign-code"
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="font-bold text-sm">Local Sign Code Regulations</span>
                {signCodeMutation.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                )}
                {!signCodeMutation.isPending && opp.signCodeText && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
                  >
                    Available
                  </Badge>
                )}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    signCodeMutation.mutate();
                  }}
                  disabled={signCodeMutation.isPending}
                  data-testid="button-lookup-sign-code"
                >
                  {signCodeMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Looking up...
                    </>
                  ) : opp.signCodeText ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                    </>
                  ) : (
                    <>
                      <Shield className="h-3 w-3 mr-1" /> Look Up
                    </>
                  )}
                </Button>
                {signCodeOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
            </div>
            {signCodeOpen && (
              <CardContent className="space-y-4 pt-0 border-t">
                {permitSpecs.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-3">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-2">
                      Sign Permit Will Be Needed for These Sign Types:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {permitSpecs.map((s) => (
                        <Badge
                          key={s.id}
                          variant="outline"
                          className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                        >
                          {signTypeLabels[s.signType] ?? s.signType}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {opp.signCodeText ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    data-testid="text-sign-code"
                  >
                    <div className="bg-muted/30 border rounded-lg p-4 space-y-2">
                      {opp.signCodeText.split("\n").map((line, i) => {
                        const trimmed = line.trim();
                        const k = `signcode-line-${i}`;
                        if (!trimmed) return <div key={k} className="h-2" />;
                        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
                          return (
                            <p key={k} className="font-bold text-sm">
                              {trimmed.replace(/\*\*/g, "")}
                            </p>
                          );
                        }
                        if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
                          return (
                            <p key={k} className="font-bold text-sm border-b pb-1 mb-1">
                              {trimmed.replace(/^#+\s*/, "")}
                            </p>
                          );
                        }
                        if (
                          trimmed.startsWith("- ") ||
                          trimmed.startsWith("* ") ||
                          trimmed.startsWith("• ")
                        ) {
                          return (
                            <p key={k} className="text-sm pl-4">
                              {"• " + trimmed.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "")}
                            </p>
                          );
                        }
                        if (/^\d+\./.test(trimmed)) {
                          return (
                            <p key={k} className="text-sm pl-4">
                              {trimmed.replace(/\*\*/g, "")}
                            </p>
                          );
                        }
                        return (
                          <p key={k} className="text-sm">
                            {trimmed.replace(/\*\*/g, "")}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : signCodeMutation.isPending ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-40 animate-spin" />
                    <p className="text-sm">Looking up local sign code regulations…</p>
                    <p className="text-xs mt-1">
                      Researching municipal sign codes for this address.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      Click "Look Up" to get local signage regulations for this address.
                    </p>
                    <p className="text-xs mt-1">
                      Uses AI to research municipal sign codes based on the project address.
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })()}

      <Card data-testid="card-opportunity-status">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-lg font-semibold">Opportunity Status</p>
            <div className="flex items-center gap-2 flex-wrap">
              {(["OPEN", "WON", "LOST", "FOLLOW_UP"] as const).map((s) => {
                const colors = STATUS_COLORS[s];
                const isActive = opp.status === s;
                return (
                  <button
                    key={s}
                    data-testid={`button-status-${s.toLowerCase()}`}
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(s)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border-2 transition-all ${
                      isActive
                        ? `${colors.bg} ${colors.text} ${colors.border}`
                        : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {OPPORTUNITY_STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-semibold flex items-center gap-2"
            data-testid="text-sign-specs-heading"
          >
            <Layers className="h-5 w-5" /> Sign Types
          </h2>
        </div>

        <SignSpecManager
          opportunityId={params.id!}
          opportunity={opp}
          signSpecs={signSpecs}
          signTypes={signTypesData ?? []}
          allAssets={data?.assets ?? []}
          allOutputs={outputs}
          allPlanes={planes}
          isSuperAdmin={isSuperAdmin}
          selectedSpecId={selectedSpecId}
          onSelectSpec={setSelectedSpecId}
        />
      </div>

      {outputs.length > 0 && (
        <div className="space-y-4">
          <h2
            className="text-lg font-semibold flex items-center gap-2"
            data-testid="text-results-heading"
          >
            <Eye className="h-5 w-5" /> All Results
          </h2>
          {signSpecs.map((spec) => {
            const specOutputs = outputs.filter((o) => o.signSpecId === spec.id);
            if (specOutputs.length === 0) return null;
            const specCanvas = spec.canvasAssetId
              ? (data?.assets ?? []).find((a) => a.id === spec.canvasAssetId)
              : null;
            return (
              <div key={spec.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {signTypeLabels[spec.signType] ?? spec.signType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {spec.locationType} · {BUDGET_LABELS[spec.budgetRange]}
                  </span>
                </div>
                <ResultsViewer
                  outputs={specOutputs}
                  canvasFilename={specCanvas?.filename}
                  showInternalTools={isAdmin}
                  isSuperAdmin={isSuperAdmin}
                  opportunityId={params.id}
                  opportunity={opp}
                />
              </div>
            );
          })}
          {(() => {
            const unlinkedOutputs = outputs.filter((o) => !o.signSpecId);
            if (unlinkedOutputs.length === 0) return null;
            return (
              <ResultsViewer
                outputs={unlinkedOutputs}
                showInternalTools={isAdmin}
                isSuperAdmin={isSuperAdmin}
                opportunityId={params.id}
                opportunity={opp}
              />
            );
          })()}
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          data-testid="modal-delete"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3">
              <h2 className="text-lg font-semibold" data-testid="text-delete-title">
                Delete Opportunity
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground" data-testid="text-delete-warning">
                Are you sure you want to delete <strong>{opp.clientName}</strong>? This will
                permanently remove the opportunity, all uploaded files, mockups, and generated
                outputs. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
