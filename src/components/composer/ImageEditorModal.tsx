"use client";

import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
Check,
Crop,
Eraser,
FlipHorizontal,
FlipVertical,
Maximize,
Paintbrush,
Redo2,
RotateCw,
Scissors,
Sliders,
Undo2,
Wand2,
ZoomIn,
ZoomOut
} from "lucide-react";
import React,{ useEffect,useRef,useState } from "react";
import { toast } from "sonner";
import { preloadImage,removeSolidBackground } from "./canvas-renderer";

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  onSave: (newImageSrc: string) => void;
  brandColors?: { primary: string[]; secondary: string[] };
}

type EditorTool = "brush" | "eraser" | "magic-wand" | "crop" | "adjust";

export function ImageEditorModal({
  isOpen,
  onClose,
  imageSrc,
  onSave,
  brandColors,
}: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Herramienta activa
  const [activeTool, setActiveTool] = useState<EditorTool>("eraser");

  // Ajustes de Pincel y Borrador
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [brushSize, setBrushSize] = useState<number>(20);
  const [brushColor, setBrushColor] = useState<string>("#ffffff");
  const [brushOpacity, setBrushOpacity] = useState<number>(1);
  const [wandTolerance, setWandTolerance] = useState<number>(40);

  // Ajustes de Color de Imagen
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturate, setSaturate] = useState<number>(100);
  const [hueRotate, setHueRotate] = useState<number>(0);
  const [blur, setBlur] = useState<number>(0);

  // Zoom
  const [zoom, setZoom] = useState<number>(1);

  // Estado de dibujo y recorte
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastCoords, setLastCoords] = useState<{ x: number; y: number } | null>(null);

  // Recorte (Crop)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Historial Undo / Redo
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Paleta rápida de colores
  const palette = [
    "#ffffff",
    "#000000",
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#ec4899",
    "#8b5cf6",
    ...(brandColors?.primary || []),
    ...(brandColors?.secondary || []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  // Inicializar canvas con la imagen cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    let isMounted = true;
    preloadImage(imageSrc)
      .then((img) => {
        if (!isMounted || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 800;
        setCanvasSize({ width: canvas.width, height: canvas.height });
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialData]);
        setHistoryIndex(0);
        setCropRect(null);
        setZoom(1);

        // Reset filtros
        setBrightness(100);
        setContrast(100);
        setSaturate(100);
        setHueRotate(0);
        setBlur(0);
      })
      .catch((err) => {
        console.error("Error al cargar imagen en el editor:", err);
        toast.error("No se pudo cargar la imagen para editar");
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, imageSrc]);

  // Guardar estado actual en el historial
  function pushToHistory() {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const currentData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const newHist = history.slice(0, historyIndex + 1);
    setHistory([...newHist, currentData]);
    setHistoryIndex(newHist.length);
  }

  function handleUndo() {
    if (historyIndex > 0 && canvasRef.current) {
      const prevData = history[historyIndex - 1];
      const canvas = canvasRef.current;
      canvas.width = prevData.width;
      canvas.height = prevData.height;
      setCanvasSize({ width: canvas.width, height: canvas.height });
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.putImageData(prevData, 0, 0);
        setHistoryIndex(historyIndex - 1);
      }
    }
  }

  function handleRedo() {
    if (historyIndex < history.length - 1 && canvasRef.current) {
      const nextData = history[historyIndex + 1];
      const canvas = canvasRef.current;
      canvas.width = nextData.width;
      canvas.height = nextData.height;
      setCanvasSize({ width: canvas.width, height: canvas.height });
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.putImageData(nextData, 0, 0);
        setHistoryIndex(historyIndex + 1);
      }
    }
  }

  // Conversión de coordenadas de ratón a coordenadas del canvas
  function getCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  // Inicio de interacción en Canvas
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pt = getCanvasPoint(e);

    if (activeTool === "brush" || activeTool === "eraser") {
      setIsDrawing(true);
      setLastCoords(pt);
      drawStroke(pt.x, pt.y, pt.x, pt.y);
    } else if (activeTool === "magic-wand") {
      applyMagicWand(Math.round(pt.x), Math.round(pt.y));
    } else if (activeTool === "crop") {
      setCropStart(pt);
      setCropRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const pt = getCanvasPoint(e);

    if (isDrawing && (activeTool === "brush" || activeTool === "eraser") && lastCoords) {
      drawStroke(lastCoords.x, lastCoords.y, pt.x, pt.y);
      setLastCoords(pt);
    } else if (cropStart && activeTool === "crop") {
      const x = Math.min(cropStart.x, pt.x);
      const y = Math.min(cropStart.y, pt.y);
      const w = Math.abs(pt.x - cropStart.x);
      const h = Math.abs(pt.y - cropStart.y);
      setCropRect({ x, y, w, h });
    }
  }

  function handleMouseUp() {
    if (isDrawing) {
      setIsDrawing(false);
      setLastCoords(null);
      pushToHistory();
    }
    if (cropStart) {
      setCropStart(null);
    }
  }

  // Trazado de Pincel / Borrador
  function drawStroke(x1: number, y1: number, x2: number, y2: number) {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;

    if (activeTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = `rgba(0,0,0,${brushOpacity})`;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = brushOpacity;
      ctx.strokeStyle = brushColor;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  // Borrador Mágico (Flood Fill Alpha por tolerancia de color)
  function applyMagicWand(startX: number, startY: number) {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const startIndex = (startY * w + startX) * 4;
    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];
    const targetA = data[startIndex + 3];

    if (targetA === 0) return; // Ya es transparente

    const visited = new Uint8Array(w * h);
    const queue: number[] = [startX + startY * w];
    visited[startX + startY * w] = 1;

    const tol = wandTolerance;

    while (queue.length > 0) {
      const idx = queue.pop()!;
      const cx = idx % w;
      const cy = Math.floor(idx / w);
      const pixelPos = (cy * w + cx) * 4;

      // Hacer transparente
      data[pixelPos + 3] = 0;

      // Vecinos en cruz (4-conectividad)
      const neighbors = [
        cx > 0 ? cx - 1 + cy * w : -1,
        cx < w - 1 ? cx + 1 + cy * w : -1,
        cy > 0 ? cx + (cy - 1) * w : -1,
        cy < h - 1 ? cx + (cy + 1) * w : -1,
      ];

      for (const n of neighbors) {
        if (n !== -1 && !visited[n]) {
          const np = n * 4;
          const nr = data[np];
          const ng = data[np + 1];
          const nb = data[np + 2];
          const na = data[np + 3];

          if (na > 0) {
            const dist = Math.sqrt(
              Math.pow(nr - targetR, 2) +
                Math.pow(ng - targetG, 2) +
                Math.pow(nb - targetB, 2)
            );

            if (dist <= tol) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    pushToHistory();
    toast.success("Área de color eliminada a transparente");
  }

  // Ejecutar Recorte
  function handleConfirmCrop() {
    if (!cropRect || !canvasRef.current) return;
    const { x, y, w, h } = cropRect;
    if (w < 10 || h < 10) {
      toast.error("El área de recorte es demasiado pequeña");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const croppedData = ctx.getImageData(x, y, w, h);

    canvas.width = w;
    canvas.height = h;
    setCanvasSize({ width: canvas.width, height: canvas.height });
    ctx.putImageData(croppedData, 0, 0);

    setCropRect(null);
    pushToHistory();
    toast.success("Imagen recortada con éxito");
  }

  // Auto Recortar Fondo Sólido
  async function handleAutoRemoveSolidBg() {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const cutUrl = await removeSolidBackground(dataUrl, wandTolerance);
      const img = await preloadImage(cutUrl);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      pushToHistory();
      toast.success("Fondo sólido eliminado a transparente");
    } catch (err: any) {
      toast.error("Error al remover fondo", { description: err.message });
    }
  }

  // Aplicar Filtros de Color directamente al Canvas
  function handleBakeAdjustments() {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Crear canvas temporal para aplicar el filtro
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hueRotate}deg) blur(${blur}px)`;
    tempCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);

    // Reset sliders
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setHueRotate(0);
    setBlur(0);

    pushToHistory();
    toast.success("Ajustes de color aplicados permanentemente");
  }

  // Voltear Horizontal (Flip X)
  function handleFlipHorizontal() {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.translate(canvas.width, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    pushToHistory();
    toast.info("Imagen volteada horizontalmente");
  }

  // Voltear Vertical (Flip Y)
  function handleFlipVertical() {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.translate(0, canvas.height);
    tempCtx.scale(1, -1);
    tempCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    pushToHistory();
    toast.info("Imagen volteada verticalmente");
  }

  // Rotar 90°
  function handleRotate90() {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.height;
    tempCanvas.height = canvas.width;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((90 * Math.PI) / 180);
    tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    setCanvasSize({ width: canvas.width, height: canvas.height });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);

    pushToHistory();
    toast.info("Imagen rotada 90°");
  }

  // Guardar y aplicar al compositor
  function handleSave() {
    if (!canvasRef.current) return;
    const finalDataUrl = canvasRef.current.toDataURL("image/png");
    onSave(finalDataUrl);
    toast.success("Capa actualizada con los cambios de edición");
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl">
        {/* Cabecera del Editor */}
        <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600">
              <Paintbrush className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                Estudio de Retoque & Edición de Imagen
              </DialogTitle>
              <DialogDescription className="text-[11px] text-zinc-400">
                Pinta, borra imperfecciones, recorta o ajusta el color de la capa con precisión pixel-perfect.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              className="h-8 px-2.5 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300 gap-1 text-xs"
              title="Deshacer (Undo)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              className="h-8 px-2.5 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300 gap-1 text-xs"
              title="Rehacer (Redo)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </Button>

            <div className="w-[1px] h-5 bg-zinc-800 mx-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1.5 shadow-lg"
            >
              <Check className="w-3.5 h-3.5" />
              Guardar en Capa
            </Button>
          </div>
        </div>

        {/* Toolbar de Herramientas y Área de Canvas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Panel Lateral Izquierdo: Herramientas (180px) */}
          <div className="w-64 bg-zinc-900/60 border-r border-zinc-800 p-3 space-y-4 overflow-y-auto text-xs">
            {/* Selector de Herramienta Principal */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Herramienta
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTool("eraser")}
                  className={`h-9 text-xs justify-start gap-2 ${
                    activeTool === "eraser"
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Eraser className="w-4 h-4 text-cyan-400" />
                  Borrador
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTool("brush")}
                  className={`h-9 text-xs justify-start gap-2 ${
                    activeTool === "brush"
                      ? "bg-amber-500/20 border-amber-500 text-amber-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Paintbrush className="w-4 h-4 text-amber-400" />
                  Pincel
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTool("magic-wand")}
                  className={`h-9 text-xs justify-start gap-2 ${
                    activeTool === "magic-wand"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Clic sobre un color para borrar toda el área conectada"
                >
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  Varita Mágica
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTool("crop")}
                  className={`h-9 text-xs justify-start gap-2 ${
                    activeTool === "crop"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Crop className="w-4 h-4 text-emerald-400" />
                  Recortar
                </Button>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTool("adjust")}
                className={`w-full h-8 text-xs justify-start gap-2 mt-1 ${
                  activeTool === "adjust"
                    ? "bg-blue-500/20 border-blue-500 text-blue-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                Ajustes de Color & Filtros
              </Button>
            </div>

            {/* OPCIONES DE BORRADOR O PINCEL */}
            {(activeTool === "brush" || activeTool === "eraser") && (
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Tamaño del trazo:</span>
                  <span className="font-mono text-zinc-300 text-[11px]">{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="120"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full h-1 accent-cyan-400 cursor-pointer"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Opacidad:</span>
                  <span className="font-mono text-zinc-300 text-[11px]">{Math.round(brushOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={brushOpacity}
                  onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                  className="w-full h-1 accent-cyan-400 cursor-pointer"
                />

                {activeTool === "brush" && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">Color de Pintura:</span>
                      <input
                        type="color"
                        value={brushColor}
                        onChange={(e) => setBrushColor(e.target.value)}
                        className="w-5 h-5 rounded border border-zinc-700 bg-transparent cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      {palette.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => setBrushColor(c)}
                          className="w-4 h-4 rounded-full border border-zinc-700 hover:scale-125 transition-transform"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OPCIONES DE VARITA MÁGICA */}
            {activeTool === "magic-wand" && (
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Tolerancia de Color:</span>
                  <span className="font-mono text-zinc-300 text-[11px]">{wandTolerance}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  value={wandTolerance}
                  onChange={(e) => setWandTolerance(parseInt(e.target.value))}
                  className="w-full h-1 accent-purple-400 cursor-pointer"
                />
                <p className="text-[10px] text-zinc-500">
                  Haz clic en cualquier píxel o fondo de la imagen para borrar todas las áreas contiguas del mismo color.
                </p>

                <Button
                  size="sm"
                  onClick={handleAutoRemoveSolidBg}
                  className="w-full h-8 bg-purple-950/60 border border-purple-700/60 hover:bg-purple-900/60 text-purple-300 text-[11px] gap-1"
                >
                  <Scissors className="w-3 h-3" />
                  Auto-Recortar Todo el Fondo
                </Button>
              </div>
            )}

            {/* OPCIONES DE RECORTE */}
            {activeTool === "crop" && (
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                <p className="text-[10px] text-zinc-400">
                  Arrastra un recuadro sobre la imagen para seleccionar el área a conservar.
                </p>
                {cropRect && (
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {Math.round(cropRect.w)}×{Math.round(cropRect.h)}px
                  </div>
                )}
                <Button
                  size="sm"
                  disabled={!cropRect}
                  onClick={handleConfirmCrop}
                  className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] gap-1 font-semibold"
                >
                  <Check className="w-3.5 h-3.5" />
                  Confirmar Recorte
                </Button>
              </div>
            )}

            {/* AJUSTES DE COLOR */}
            {activeTool === "adjust" && (
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5">
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Brillo:</span>
                    <span className="font-mono">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full h-1 accent-blue-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Contraste:</span>
                    <span className="font-mono">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    className="w-full h-1 accent-blue-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Saturación:</span>
                    <span className="font-mono">{saturate}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={saturate}
                    onChange={(e) => setSaturate(parseInt(e.target.value))}
                    className="w-full h-1 accent-blue-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Tono (Hue Shift):</span>
                    <span className="font-mono">{hueRotate}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={hueRotate}
                    onChange={(e) => setHueRotate(parseInt(e.target.value))}
                    className="w-full h-1 accent-blue-400 cursor-pointer"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleBakeAdjustments}
                  className="w-full h-8 bg-blue-600 hover:bg-blue-500 text-white text-[11px] gap-1 font-semibold mt-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Aplicar Filtros
                </Button>
              </div>
            )}

            {/* TRANSFORMACIONES */}
            <div className="pt-2 border-t border-zinc-800 space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Transformación
              </Label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={handleFlipHorizontal}
                  className="p-1.5 rounded bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex flex-col items-center gap-1 text-[10px]"
                  title="Espejo Horizontal"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  Flip H
                </button>
                <button
                  type="button"
                  onClick={handleFlipVertical}
                  className="p-1.5 rounded bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex flex-col items-center gap-1 text-[10px]"
                  title="Espejo Vertical"
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                  Flip V
                </button>
                <button
                  type="button"
                  onClick={handleRotate90}
                  className="p-1.5 rounded bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex flex-col items-center gap-1 text-[10px]"
                  title="Rotar 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  90°
                </button>
              </div>
            </div>
          </div>

          {/* Área Central: Viewport de Dibujo & Retoque */}
          <div
            ref={containerRef}
            className="flex-1 bg-zinc-950 relative flex items-center justify-center p-6 overflow-hidden select-none"
          >
            {/* Controles de Zoom */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-zinc-800 text-xs shadow-lg">
              <button
                onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
                className="p-1 text-zinc-400 hover:text-white rounded"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-zinc-300 px-1">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                className="p-1 text-zinc-400 hover:text-white rounded"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-1 text-zinc-400 hover:text-white rounded ml-1 pl-1 border-l border-zinc-800"
                title="Ajustar 100%"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Contenedor del Canvas con Cuadrícula de Transparencia */}
            <div
              className="relative shadow-2xl rounded border border-zinc-800"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                backgroundImage:
                  "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                backgroundColor: "#09090b",
                cursor:
                  activeTool === "eraser"
                    ? "crosshair"
                    : activeTool === "brush"
                    ? "crosshair"
                    : activeTool === "magic-wand"
                    ? "pointer"
                    : activeTool === "crop"
                    ? "crosshair"
                    : "default",
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  filter:
                    activeTool === "adjust"
                      ? `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hueRotate}deg) blur(${blur}px)`
                      : "none",
                  maxWidth: "75vw",
                  maxHeight: "72vh",
                  display: "block",
                }}
              />

              {/* Guía visual de Recorte (Crop Rectangle) */}
              {cropRect && canvasSize.width > 0 && (
                <div
                  className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/10 pointer-events-none"
                  style={{
                    left: `${(cropRect.x / canvasSize.width) * 100}%`,
                    top: `${(cropRect.y / canvasSize.height) * 100}%`,
                    width: `${(cropRect.w / canvasSize.width) * 100}%`,
                    height: `${(cropRect.h / canvasSize.height) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
