import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Ruler, MousePointer2, RotateCcw, Trash2 } from "lucide-react";

function MeasurementCanvas({ imageSrc }: { imageSrc: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const [refMode, setRefMode] = useState(false);
  const [refLine, setRefLine] = useState<{ x: number; y: number }[]>([]);
  const [refLengthInches, setRefLengthInches] = useState<number>(0);
  const [refUnit, setRefUnit] = useState<"inches" | "feet">("inches");
  const [refInputVal, setRefInputVal] = useState<string>("");
  const [draggingRefIdx, setDraggingRefIdx] = useState<number | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    setPoints([]);
    setRefLine([]);
    setRefLengthInches(0);
    setRefInputVal("");
    setRefMode(false);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [imageSrc]);

  const getBaseScale = useCallback(() => {
    if (!imgRef.current) return 1;
    const containerW = containerRef.current?.clientWidth ?? 800;
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
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
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

  const isZoomed = zoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="space-y-1">
          {refMode ? (
            <>
              <p className="text-sm text-amber-600 font-medium">Reference Measurement Mode</p>
              <p className="text-xs text-muted-foreground">
                {refLine.length < 2
                  ? `Click 2 points to draw a reference line on something with a known size (door, window, storefront width). (${refLine.length}/2 points)`
                  : "Reference line set. Enter the real-world measurement below."}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Click 4 points clockwise to define the area you want to measure.
                {points.length < 4 && ` (${points.length}/4 points placed)`}
              </p>
              <p className="text-xs text-muted-foreground">
                Drag points to adjust. Scroll to zoom. Alt+drag to pan.
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
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
          {isZoomed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              data-testid="button-reset-view"
            >
              Reset View
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
        </div>
      </div>

      {zoom !== 1 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {Math.round(zoom * 100)}%
          </Badge>
        </div>
      )}

      <div ref={containerRef} className="border rounded-md overflow-hidden bg-muted/30">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair w-full"
          style={{
            cursor:
              draggingIdx !== null || draggingRefIdx !== null
                ? "grabbing"
                : isPanning
                  ? "grabbing"
                  : undefined,
          }}
          data-testid="canvas-measurement"
        />
      </div>

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
              Add Reference Measurement (for estimating area size)
            </Label>
          </div>

          {refMode && (
            <div className="space-y-3 pl-6">
              <p className="text-xs text-muted-foreground">
                Draw a line across a known feature (storefront width, door height, window, etc.) and
                enter its real-world size. The system will calculate the approximate dimensions.
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

              {estimatedDimensions && (
                <div
                  className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-3"
                  data-testid="text-estimated-dimensions"
                >
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Estimated Area
                  </p>
                  <p className="text-lg font-bold text-green-900 dark:text-green-100">
                    {formatDimension(estimatedDimensions.widthInches)} ×{" "}
                    {formatDimension(estimatedDimensions.heightInches)}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    ≈ {estimatedDimensions.sqFt.toFixed(1)} sq ft (
                    {Math.round(estimatedDimensions.widthInches)}" ×{" "}
                    {Math.round(estimatedDimensions.heightInches)}")
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReferenceMeasurementsPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setImageSrc(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          Reference Measurements
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload a site photo to get rough measurements of any area. Draw 4 points to define the
          area, then add a reference measurement for real-world size estimates.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Ruler className="h-4 w-4" /> Quick Measurement Tool
          </h3>
          <p className="text-sm italic text-muted-foreground mt-1">
            For best results, use a straight-on, level photo. Photos taken at an angle can affect
            dimension estimates — but they'll still work great for generating mockups! These
            measurements are estimates only.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!imageSrc ? (
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-upload"
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Click to upload a site photo</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or WebP</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file-upload"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <MousePointer2 className="h-4 w-4" />
                  {fileName}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-change-photo"
                  >
                    <RotateCcw className="h-3 w-3 mr-2" /> Change Photo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    data-testid="button-remove-photo"
                  >
                    <Trash2 className="h-3 w-3 mr-2" /> Remove
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="input-file-upload"
                />
              </div>
              <MeasurementCanvas imageSrc={imageSrc} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
