import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AvatarCropDialogProps {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropped: (blob: Blob) => Promise<void> | void;
}

export function AvatarCropDialog({ file, open, onOpenChange, onCropped }: AvatarCropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const exportCrop = async () => {
    const img = imgRef.current;
    const frame = frameRef.current;
    if (!img || !frame || !img.naturalWidth) return;
    setBusy(true);
    try {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not crop image");

      const frameBox = frame.getBoundingClientRect();
      const imgBox = img.getBoundingClientRect();
      const scaleX = img.naturalWidth / imgBox.width;
      const scaleY = img.naturalHeight / imgBox.height;
      const sx = (frameBox.left - imgBox.left) * scaleX;
      const sy = (frameBox.top - imgBox.top) * scaleY;
      const sw = frameBox.width * scaleX;
      const sh = frameBox.height * scaleY;

      ctx.fillStyle = "#f4f1ea";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not encode photo"))),
          "image/jpeg",
          0.9,
        );
      });
      await onCropped(blob);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const landscape = natural.w >= natural.h;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Crop profile photo</DialogTitle>
          <DialogDescription>Drag to reposition. Use the slider to zoom in.</DialogDescription>
        </DialogHeader>
        <div
          ref={frameRef}
          className="relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-2xl border-2 border-primary bg-muted"
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt="Crop preview"
              className="absolute left-1/2 top-1/2 cursor-grab select-none object-contain active:cursor-grabbing"
              style={{
                width: landscape ? "100%" : "auto",
                height: landscape ? "auto" : "100%",
                maxWidth: "none",
                maxHeight: "none",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                transformOrigin: "center center",
              }}
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth || 1, h: el.naturalHeight || 1 });
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          )}
        </div>
        <label className="mt-1 flex items-center gap-3 text-xs font-medium text-muted-foreground">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 flex-1 accent-primary"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button className="rounded-full" onClick={() => void exportCrop()} disabled={busy || !src}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save photo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
