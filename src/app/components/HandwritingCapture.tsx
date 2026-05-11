'use client';

import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

export type HandwritingEngine = 'hwt' | 'diffusionpen' | 'cursive';

interface Props {
  onCapture: (file: File | null) => void;
  prompt?: string;
  engine: HandwritingEngine;
  onEngineChange: (e: HandwritingEngine) => void;
  /** Full-screen mode: top bar + canvas filling remaining viewport */
  fullScreen?: boolean;
  onSend?: () => void;
  sendDisabled?: boolean;
  onBack?: () => void;
}

const ALL_ENGINES: { id: HandwritingEngine; label: string; desc: string }[] = [
  { id: 'cursive', label: 'Cursive Ink', desc: 'Attached, readable, realistic' },
  { id: 'hwt', label: 'HWT', desc: 'Handwriting Transformer (fast)' },
  { id: 'diffusionpen', label: 'DiffusionPen', desc: 'Few-shot diffusion (closer style)' },
];

const C = {
  bg: '#EAD9BC',
  paper: '#F4ECD8',
  ink: '#3A1A06',
  sepia: '#5C2E0A',
  gold: '#9B6E3A',
  rule: 'rgba(155, 110, 58, 0.4)',
  ruleSoft: 'rgba(155, 110, 58, 0.22)',
};
const FONT_SERIF = "var(--font-serif), 'Cormorant Garamond', Georgia, serif";
const FONT_HAND = "var(--font-hand), 'Klee One', cursive";

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, base64] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export default function HandwritingCapture({
  onCapture,
  prompt,
  engine,
  onEngineChange,
  fullScreen = false,
  onSend,
  sendDisabled,
  onBack,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // useRef for drawing state to avoid stale-closure / async-setState issues
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const isMobile = useIsMobile();
  const canvasHeight = isMobile ? 200 : 160;
  const [hasContent, setHasContent] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [hwtAvailable, setHwtAvailable] = useState(false);

  // Ping the Python service once on mount to decide which engines to show
  useEffect(() => {
    fetch('/api/hwt-status')
      .then((r) => r.json())
      .then((d: { available: boolean }) => setHwtAvailable(d.available))
      .catch(() => setHwtAvailable(false));
  }, []);



  // Initialize the canvas: backing store sized to CSS box × DPR, line styles set
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    // Only re-init if size actually changed (avoid wiping mid-stroke)
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      // Preserve existing strokes across resize by snapshotting the canvas first
      let snapshot: HTMLImageElement | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        try {
          const url = canvas.toDataURL('image/png');
          snapshot = new Image();
          snapshot.src = url;
        } catch {
          snapshot = null;
        }
      }
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      // Restore previous drawing scaled to the new logical box
      if (snapshot) {
        const restore = () => {
          try {
            ctx.drawImage(snapshot!, 0, 0, w, h);
          } catch {
            // ignore
          }
        };
        if (snapshot.complete && snapshot.naturalWidth > 0) restore();
        else snapshot.onload = restore;
      }
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 0.7; // thinner ink
  };

  useEffect(() => {
    initCanvas();
    const ro = new ResizeObserver(() => initCanvas());
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedPreview]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (uploadedPreview) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    initCanvas();
    isDrawingRef.current = true;
    lastPosRef.current = getPos(e);

    // Draw a single dot so a tap leaves a mark
    const ctx = canvas.getContext('2d');
    if (ctx && lastPosRef.current) {
      ctx.beginPath();
      ctx.arc(lastPosRef.current.x, lastPosRef.current.y, 0.7, 0, Math.PI * 2);
      ctx.fillStyle = '#111111';
      ctx.fill();
    }
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    if (lastPosRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPosRef.current = pos;
    if (!hasContent) setHasContent(true);
  };

  const endDraw = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current = null;
    if (e) {
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onCapture(dataUrlToFile(dataUrl, 'handwriting.png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
    }
    setHasContent(false);
    setUploadedPreview(null);
    onCapture(null);
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setUploadedPreview(url);
      setHasContent(true);
      onCapture(file);
    };
    reader.readAsDataURL(file);
  };

  // ── Shared sub-elements ─────────────────────────────────────────────────────
  // Always show all engines; disable those that need the HWT service when it's down
  const engineSelector = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor="engine" style={{ fontFamily: FONT_SERIF, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, whiteSpace: 'nowrap' }}>
        Engine
      </label>
      <select
        id="engine"
        value={engine}
        onChange={(e) => onEngineChange(e.target.value as HandwritingEngine)}
        style={{ borderRadius: 4, border: `1px solid ${C.rule}`, backgroundColor: C.paper, padding: '6px 10px', fontSize: 13, fontFamily: FONT_HAND, color: C.ink, outline: 'none', maxWidth: '60vw' }}
      >
        {ALL_ENGINES.map((e) => {
          const disabled = !hwtAvailable && e.id !== 'cursive';
          return (
            <option key={e.id} value={e.id} disabled={disabled}>
              {e.label}{disabled ? ' (offline)' : ''}
            </option>
          );
        })}
      </select>
    </div>
  );

  const uploadBtn = (
    <button type="button" onClick={() => fileInputRef.current?.click()}
      style={{ backgroundColor: 'transparent', color: C.sepia, fontFamily: FONT_SERIF, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '7px 16px', borderRadius: 4, border: `1px solid ${C.rule}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      Upload an image
    </button>
  );

  const clearBtn = hasContent ? (
    <button type="button" onClick={clear}
      style={{ backgroundColor: 'transparent', color: C.sepia, fontFamily: FONT_SERIF, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '7px 16px', borderRadius: 4, border: `1px solid ${C.rule}`, cursor: 'pointer' }}>
      Clear
    </button>
  ) : null;

  const fileInput = (
    <input ref={fileInputRef} type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
  );

  const canvasArea = (fill: boolean) => (
    <div style={{ position: 'relative', ...(fill ? { flex: 1 } : { height: canvasHeight }), width: '100%', borderRadius: fill ? 0 : 12, border: fill ? 'none' : '2px dashed #d6d3d1', backgroundColor: '#ffffff', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        onPointerCancel={endDraw}
        style={{ display: 'block', width: '100%', height: '100%', cursor: uploadedPreview ? 'default' : 'crosshair', touchAction: 'none', userSelect: 'none' }}
      />
      {uploadedPreview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={uploadedPreview} alt="Your handwriting"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#ffffff', pointerEvents: 'none' }} />
      )}
      {!hasContent && !uploadedPreview && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.gold, pointerEvents: 'none', userSelect: 'none', textAlign: 'center', padding: '0 16px', gap: 6 }}>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', opacity: 0.7 }}>
            Write one sentence by hand
          </div>
          {prompt && (
            <div style={{ fontFamily: FONT_HAND, fontSize: 16, color: C.sepia, opacity: 0.55 }}>
              {prompt}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Full-screen mode ─────────────────────────────────────────────────────────
  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: C.bg,
          // Use dynamic viewport units when supported to avoid mobile browser-chrome bugs
          height: '100dvh',
          width: '100vw',
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            rowGap: 8,
            padding: '10px 14px',
            borderBottom: `1px solid ${C.ruleSoft}`,
            backgroundColor: C.bg,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          {onBack && (
            <button type="button" onClick={onBack}
              style={{ backgroundColor: 'transparent', color: C.gold, fontFamily: FONT_SERIF, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px 10px', border: 'none', cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          {engineSelector}
          {uploadBtn}
          {clearBtn}
          {onSend && (
            <button type="button" onClick={onSend} disabled={sendDisabled}
              style={{ backgroundColor: sendDisabled ? 'rgba(58,26,6,0.35)' : C.ink, color: '#F5E8D0', fontFamily: FONT_SERIF, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '9px 22px', borderRadius: 4, border: 'none', cursor: sendDisabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              Send
            </button>
          )}
          {fileInput}
        </div>
        {/* Canvas fills remaining space */}
        {canvasArea(true)}
      </div>
    );
  }

  // ── Normal (embedded) mode ───────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 640 }}>
      {prompt && (
        <p style={{ fontSize: 13, color: C.sepia, textAlign: 'center', margin: 0, fontFamily: FONT_SERIF }}>
          <span style={{ letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 10, color: C.gold }}>Prompted sentence</span>{' '}
          <span style={{ fontFamily: FONT_HAND, fontSize: 16 }}>{prompt}</span>
        </p>
      )}
      {engineSelector}
      {canvasArea(false)}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        {uploadBtn}
        {clearBtn}
        {fileInput}
      </div>
    </div>
  );
}
