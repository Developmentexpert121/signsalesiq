import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { Loader2 } from "lucide-react";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null;

interface ImageCropToolProps {
  imageUrl: string;
  downloadFilename: string;
  onClose: () => void;
}

const HANDLE_SIZE = 10;
const MIN_CROP = 20;

let cropMaskCounter = 0;

export default function ImageCropTool({ imageUrl, downloadFilename, onClose }: ImageCropToolProps) {
  const [maskId] = useState(() => `cropMask-${++cropMaskCounter}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStart = useRef<{ mx: number; my: number; crop: CropRect }>({
    mx: 0,
    my: 0,
    crop: { x: 0, y: 0, width: 0, height: 0 },
  });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const naturalSize = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const initCrop = useCallback(() => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const dw = img.clientWidth;
    const dh = img.clientHeight;
    naturalSize.current = { width: img.naturalWidth, height: img.naturalHeight };
    setDisplaySize({ width: dw, height: dh });
    const pad = Math.min(dw, dh) * 0.15;
    setCrop({ x: pad, y: pad, width: dw - pad * 2, height: dh - pad * 2 });
  }, []);

  useEffect(() => {
    if (imgLoaded) initCrop();
  }, [imgLoaded, initCrop]);

  useEffect(() => {
    const handleResize = () => {
      if (!imgLoaded || !imgRef.current) return;
      const img = imgRef.current;
      const oldDw = displaySize.width;
      const oldDh = displaySize.height;
      const newDw = img.clientWidth;
      const newDh = img.clientHeight;
      if (oldDw > 0 && oldDh > 0 && newDw > 0 && newDh > 0) {
        const sx = newDw / oldDw;
        const sy = newDh / oldDh;
        setCrop((prev) => ({
          x: prev.x * sx,
          y: prev.y * sy,
          width: prev.width * sx,
          height: prev.height * sy,
        }));
      }
      setDisplaySize({ width: newDw, height: newDh });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imgLoaded, displaySize]);

  const clampCrop = (c: CropRect): CropRect => {
    const { width: dw, height: dh } = displaySize;
    let { x, y, width, height } = c;
    width = Math.max(MIN_CROP, Math.min(width, dw));
    height = Math.max(MIN_CROP, Math.min(height, dh));
    x = Math.max(0, Math.min(x, dw - width));
    y = Math.max(0, Math.min(y, dh - height));
    return { x, y, width, height };
  };

  const getRelativePos = (e: { clientX: number; clientY: number }) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const hitTest = (mx: number, my: number): DragMode => {
    const { x, y, width, height } = crop;
    const hs = HANDLE_SIZE;
    const corners: { mode: DragMode; cx: number; cy: number }[] = [
      { mode: "nw", cx: x, cy: y },
      { mode: "ne", cx: x + width, cy: y },
      { mode: "sw", cx: x, cy: y + height },
      { mode: "se", cx: x + width, cy: y + height },
    ];
    for (const c of corners) {
      if (Math.abs(mx - c.cx) <= hs && Math.abs(my - c.cy) <= hs) return c.mode;
    }
    const edges: { mode: DragMode; test: boolean }[] = [
      { mode: "n", test: Math.abs(my - y) <= hs && mx > x + hs && mx < x + width - hs },
      { mode: "s", test: Math.abs(my - (y + height)) <= hs && mx > x + hs && mx < x + width - hs },
      { mode: "w", test: Math.abs(mx - x) <= hs && my > y + hs && my < y + height - hs },
      { mode: "e", test: Math.abs(mx - (x + width)) <= hs && my > y + hs && my < y + height - hs },
    ];
    for (const edge of edges) {
      if (edge.test) return edge.mode;
    }
    if (mx >= x && mx <= x + width && my >= y && my <= y + height) return "move";
    return null;
  };

  const getCursor = (mode: DragMode): string => {
    const map: Record<string, string> = {
      nw: "nwse-resize",
      se: "nwse-resize",
      ne: "nesw-resize",
      sw: "nesw-resize",
      n: "ns-resize",
      s: "ns-resize",
      e: "ew-resize",
      w: "ew-resize",
      move: "grab",
    };
    return mode ? map[mode] || "crosshair" : "crosshair";
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const pos = getRelativePos(e);
    const mode = hitTest(pos.x, pos.y);
    if (!mode) return;
    setDragMode(mode);
    dragStart.current = { mx: pos.x, my: pos.y, crop: { ...crop } };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (!dragMode) return;
    const onMove = (e: PointerEvent) => {
      const pos = getRelativePos(e);
      const { mx: sx, my: sy, crop: sc } = dragStart.current;
      const dx = pos.x - sx;
      const dy = pos.y - sy;
      let newCrop: CropRect;

      if (dragMode === "move") {
        newCrop = { ...sc, x: sc.x + dx, y: sc.y + dy };
      } else {
        let { x, y, width, height } = sc;
        if (dragMode.includes("e")) {
          width = sc.width + dx;
        }
        if (dragMode.includes("w")) {
          x = sc.x + dx;
          width = sc.width - dx;
        }
        if (dragMode.includes("s")) {
          height = sc.height + dy;
        }
        if (dragMode.includes("n")) {
          y = sc.y + dy;
          height = sc.height - dy;
        }
        newCrop = { x, y, width, height };
      }
      setCrop(clampCrop(newCrop));
    };
    const onUp = () => setDragMode(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragMode, displaySize]);

  const [hoverCursor, setHoverCursor] = useState("crosshair");
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragMode) return;
    const pos = getRelativePos(e);
    setHoverCursor(getCursor(hitTest(pos.x, pos.y)));
  };

  const handleDownload = () => {
    if (!imgRef.current || !naturalSize.current.width) return;
    const { width: dw, height: dh } = displaySize;
    const scaleX = naturalSize.current.width / dw;
    const scaleY = naturalSize.current.height / dh;
    const canvas = document.createElement("canvas");
    const cw = Math.round(crop.width * scaleX);
    const ch = Math.round(crop.height * scaleY);
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      imgRef.current,
      Math.round(crop.x * scaleX),
      Math.round(crop.y * scaleY),
      cw,
      ch,
      0,
      0,
      cw,
      ch
    );
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const renderHandles = () => {
    const { x, y, width, height } = crop;
    const hs = HANDLE_SIZE;
    const positions = [
      { left: x - hs / 2, top: y - hs / 2 },
      { left: x + width - hs / 2, top: y - hs / 2 },
      { left: x - hs / 2, top: y + height - hs / 2 },
      { left: x + width - hs / 2, top: y + height - hs / 2 },
      { left: x + width / 2 - hs / 2, top: y - hs / 2 },
      { left: x + width / 2 - hs / 2, top: y + height - hs / 2 },
      { left: x - hs / 2, top: y + height / 2 - hs / 2 },
      { left: x + width - hs / 2, top: y + height / 2 - hs / 2 },
    ];
    const handleNames = ["tl", "tr", "bl", "br", "tm", "bm", "lm", "rm"];
    return positions.map((pos, i) => (
      <div
        key={`handle-${handleNames[i] ?? i}`}
        className="absolute bg-white border-2 border-blue-500 rounded-sm pointer-events-none"
        style={{ left: pos.left, top: pos.top, width: hs, height: hs }}
      />
    ));
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      data-testid="crop-overlay"
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        className="relative flex flex-col items-center max-w-[90vw] max-h-[90vh]"
      >
        <div className="flex items-center gap-2 mb-3">
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={!imgLoaded}
            data-testid="button-download-cropped"
          >
            <Download className="mr-2 h-3 w-3" /> Download Cropped
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-crop"
            className="bg-white/10 hover:bg-white/20 text-white border-white/30"
          >
            <X className="mr-2 h-3 w-3" /> Cancel
          </Button>
        </div>

        {!imgLoaded && !imgError && (
          <div className="flex items-center gap-2 text-white py-12">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading image…</span>
          </div>
        )}

        {imgError && (
          <div className="text-red-400 text-sm py-12">Failed to load image. Please try again.</div>
        )}

        <div
          className="relative select-none touch-none"
          style={{
            cursor: dragMode ? getCursor(dragMode) : hoverCursor,
            display: imgLoaded ? undefined : "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            crossOrigin="anonymous"
            alt="Crop preview"
            className="max-w-[85vw] max-h-[80vh] rounded-md"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            draggable={false}
          />
          {imgLoaded && displaySize.width > 0 && (
            <>
              <svg
                className="absolute inset-0 pointer-events-none"
                width={displaySize.width}
                height={displaySize.height}
                style={{ top: 0, left: 0 }}
              >
                <defs>
                  <mask id={maskId}>
                    <rect
                      x={0}
                      y={0}
                      width={displaySize.width}
                      height={displaySize.height}
                      fill="white"
                    />
                    <rect
                      x={crop.x}
                      y={crop.y}
                      width={crop.width}
                      height={crop.height}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  x={0}
                  y={0}
                  width={displaySize.width}
                  height={displaySize.height}
                  fill="rgba(0,0,0,0.55)"
                  mask={`url(#${maskId})`}
                />
              </svg>
              <div
                className="absolute border-2 border-blue-500 pointer-events-none"
                style={{ left: crop.x, top: crop.y, width: crop.width, height: crop.height }}
              />
              {renderHandles()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
