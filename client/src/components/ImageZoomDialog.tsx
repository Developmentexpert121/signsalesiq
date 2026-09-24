import { useRef, useState } from "react";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface ImageZoomDialogProps {
  src: string;
  alt: string;
  title?: string;
  trigger: React.ReactNode;
}

export default function ImageZoomDialog({ src, alt, title, trigger }: ImageZoomDialogProps) {
  const [open, setOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[95vw] h-[90vh] max-w-6xl p-0" onKeyDown={handleKeyDown}>
        <DialogTitle className="sr-only">{title || alt || "Image"}</DialogTitle>
        <div
          className="h-full w-full flex items-center justify-center overflow-auto bg-muted/30 focus:outline-none"
          tabIndex={0}
        >
          <div
            ref={containerRef}
            className="relative inline-block"
            style={{ maxWidth: "100%", maxHeight: "100%" }}
          >
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              draggable={false}
              className="block max-w-full max-h-[85vh] select-none"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
