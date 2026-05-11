'use client';

import { useEffect, useRef } from 'react';

export interface GhostCardData {
  city: string;
  place: string;
  message: string;
  date?: string;
  /** Optional PNG (data URL or blob URL) of the handwriting-rendered message */
  handwritingImageUrl?: string | null;
  /** Optional grayscale illustration (data URL) shown on the left side of the postcard */
  sceneImageUrl?: string | null;
}

interface Props {
  data: GhostCardData;
  className?: string;
}

// ── Deterministic pseudo-random from seed ────────────────────────────────────
function seededRand(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Approximate coordinates ─────────────────────────────────────────────────
function fakeCoords(city: string): string {
  const known: Record<string, string> = {
    tibilis: '41.6936° N, 44.8019° E',
    tbilisi: '41.6936° N, 44.8019° E',
    london: '51.5074° N, 0.1278° W',
    paris: '48.8566° N, 2.3522° E',
    tokyo: '35.6762° N, 139.6503° E',
    rome: '41.9028° N, 12.4964° E',
    berlin: '52.5200° N, 13.4050° E',
    lisbon: '38.7167° N, 9.1399° W',
    istanbul: '41.0082° N, 28.9784° E',
    bangkok: '13.7563° N, 100.5018° E',
  };
  const cityKey = city.split(',')[0].trim().toLowerCase();
  if (known[cityKey]) return known[cityKey];

  const rand = seededRand(hashString(cityKey));
  const lat = rand() * 80 - 40;
  const lon = rand() * 360 - 180;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`;
}

// ── Signal field on the left panel ──────────────────────────────────────────
function drawSignalField(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  citySeed: string,
) {
  const rand = seededRand(hashString(citySeed));
  ctx.save();
  ctx.strokeStyle = '#0a0a0a';
  ctx.fillStyle = '#0a0a0a';

  const lineCount = 13;
  const lineSpacing = h / (lineCount + 1);

  for (let l = 0; l < lineCount; l++) {
    const ly = y + lineSpacing * (l + 1);

    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x + 8, ly);
    ctx.lineTo(x + w - 8, ly);
    ctx.stroke();

    const dotCount = Math.floor(rand() * 9) + 5;
    for (let d = 0; d < dotCount; d++) {
      const dx = x + 10 + rand() * (w - 20);
      const dy = ly + (rand() - 0.5) * lineSpacing * 0.7;
      const r = rand() * 2.8 + 1;
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const dashCount = Math.floor(rand() * 5) + 2;
    for (let d = 0; d < dashCount; d++) {
      const dx = x + 10 + rand() * (w - 20);
      const dw = rand() * 22 + 6;
      const offY = ly + (rand() - 0.5) * lineSpacing * 0.4;
      ctx.lineWidth = rand() * 2.5 + 1;
      ctx.beginPath();
      ctx.moveTo(dx, offY);
      ctx.lineTo(dx + dw, offY);
      ctx.stroke();
    }

    if (rand() > 0.5) {
      const sx = x + 12 + rand() * (w - 24);
      const sh = (rand() * 0.6 + 0.3) * lineSpacing;
      ctx.lineWidth = rand() * 1.8 + 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, ly - sh);
      ctx.lineTo(sx, ly + sh * 0.4);
      ctx.stroke();
    }

    if (rand() > 0.7) {
      const ox = x + 14 + rand() * (w - 28);
      const ow = rand() * 18 + 10;
      const oh = rand() * 7 + 4;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(ox, ly, ow / 2, oh / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (rand() > 0.85) {
      const gx = x + 18 + rand() * (w - 36);
      const gy = ly - rand() * 8;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.bezierCurveTo(gx + 6, gy - 8, gx + 14, gy - 4, gx + 12, gy + 4);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ── Postmark with wavy cancel lines on the LEFT ─────────────────────────────
function drawPostmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  city: string,
  dateStr: string,
) {
  ctx.save();
  ctx.strokeStyle = '#0a0a0a';
  ctx.fillStyle = '#0a0a0a';

  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.3;
  for (let i = -1; i <= 1; i++) {
    const baseY = cy + i * 9;
    ctx.beginPath();
    ctx.moveTo(cx - r - 38, baseY);
    for (let t = 0; t <= 38; t += 2) {
      const xx = cx - r - 38 + t;
      const yy = baseY + Math.sin(t * 0.55) * 2.4;
      ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }

  const cityUpper = city.toUpperCase().split(',')[0].trim();
  const arcR = r * 0.86;
  ctx.font = `bold ${Math.round(r * 0.26)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const arcStart = -Math.PI * 0.78;
  const arcEnd = -Math.PI * 0.22;
  const chars = cityUpper.split('');
  const totalArc = arcEnd - arcStart;
  chars.forEach((ch, i) => {
    const angle = arcStart + (totalArc / Math.max(chars.length - 1, 1)) * i;
    ctx.save();
    ctx.translate(cx + arcR * Math.cos(angle), cy + arcR * Math.sin(angle));
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });

  const country = (city.split(',')[1] ?? '').trim().toUpperCase();
  if (country) {
    const arcStart2 = Math.PI * 0.22;
    const arcEnd2 = Math.PI * 0.78;
    const chars2 = country.split('');
    const totalArc2 = arcEnd2 - arcStart2;
    chars2.forEach((ch, i) => {
      const angle = arcStart2 + (totalArc2 / Math.max(chars2.length - 1, 1)) * i;
      ctx.save();
      ctx.translate(cx + arcR * Math.cos(angle), cy + arcR * Math.sin(angle));
      ctx.rotate(angle - Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  }

  ctx.font = `bold ${Math.round(r * 0.21)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(dateStr, cx, cy - 5);
  ctx.fillText('19-7N', cx, cy + 9);

  ctx.restore();
}

// ── "FUTURE / MESSAGE IN TRANSIT" box ───────────────────────────────────────
function drawTransitBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.strokeStyle = '#0a0a0a';
  ctx.fillStyle = '#0a0a0a';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h * 0.32;
  const sr = h * 0.16;
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * sr, cy + Math.sin(a) * sr);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, sr * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(h * 0.16)}px sans-serif`;
  ctx.fillText('FUTURE', cx, y + h * 0.58);
  ctx.font = `bold ${Math.round(h * 0.12)}px sans-serif`;
  ctx.fillText('MESSAGE IN', cx, y + h * 0.76);
  ctx.fillText('TRANSIT', cx, y + h * 0.9);

  ctx.restore();
}

// ── Wrap text helper ────────────────────────────────────────────────────────
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const paragraphs = text.split('\n');
  let curY = y;
  for (const para of paragraphs) {
    if (para.trim() === '') {
      curY += lineHeight * 0.55;
      continue;
    }
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, curY);
        curY += lineHeight;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, curY);
      curY += lineHeight;
    }
    curY += lineHeight * 0.45;
  }
  return curY;
}

// ── Main canvas renderer ────────────────────────────────────────────────────
export default function GhostPostcard({ data, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const CARD_W = 1200;
  const CARD_H = 800;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Common static layout (everything except message body) ──
    const drawStatic = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      const midX = Math.round(CARD_W * 0.46);
      const padding = 28;

      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, CARD_W - 20, CARD_H - 20);

      const sceneX = 10;
      const sceneY = 10;
      const sceneW = midX - 10;
      const sceneH = CARD_H - 20;
      if (data.sceneImageUrl) {
        ctx.save();
        ctx.fillStyle = '#f5f1e8';
        ctx.fillRect(sceneX, sceneY, sceneW, sceneH);
        ctx.restore();
        const sImg = new Image();
        sImg.crossOrigin = 'anonymous';
        sImg.onload = () => {
          // Cover: fill the whole area, cropping overflow on one axis
          const scale = Math.max(sceneW / sImg.width, sceneH / sImg.height);
          const dw = sImg.width * scale;
          const dh = sImg.height * scale;
          const dx = sceneX + (sceneW - dw) / 2;
          const dy = sceneY + (sceneH - dh) / 2;
          ctx.save();
          // Clip to the left panel so nothing bleeds across the divider
          ctx.beginPath();
          ctx.rect(sceneX, sceneY, sceneW, sceneH);
          ctx.clip();
          ctx.drawImage(sImg, dx, dy, dw, dh);
          ctx.restore();
        };
        sImg.onerror = () => {
          drawSignalField(ctx, sceneX + 18, sceneY + 70, sceneW - 36, sceneH - 160, data.city);
        };
        sImg.src = data.sceneImageUrl;
      } else {
        drawSignalField(ctx, sceneX + 18, sceneY + 70, sceneW - 36, sceneH - 160, data.city);
      }

      ctx.fillStyle = '#0a0a0a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // Coordinates label on the right (below the message area, just right of the divider)
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('COORDINATES:', midX + 30, CARD_H - 56);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(fakeCoords(data.city), midX + 30, CARD_H - 36);

      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(midX, 28);
      ctx.lineTo(midX, CARD_H - 28);
      ctx.stroke();

      const pmCx = midX + 110;
      const pmCy = 100;
      const pmR = 60;
      const dateStr =
        data.date ?? new Date().toLocaleDateString('en-GB').replace(/\//g, '-').slice(0, 8);
      drawPostmark(ctx, pmCx, pmCy, pmR, data.city, dateStr);

      drawTransitBox(ctx, CARD_W - 168, 32, 132, 116);

      const textX = midX + 30;
      const rightW = CARD_W - textX - padding;

      ctx.fillStyle = '#0a0a0a';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('GREETINGS FROM', textX, 220);

      const parts = data.city
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      let cityFontSize = 70;
      ctx.font = `900 ${cityFontSize}px sans-serif`;
      const checkText = parts.length > 1 ? parts[0] + ',' : parts[0];
      while (ctx.measureText(checkText).width > rightW - 8 && cityFontSize > 28) {
        cityFontSize -= 2;
        ctx.font = `900 ${cityFontSize}px sans-serif`;
      }
      let cy = 220 + cityFontSize + 8;
      if (parts.length > 1) {
        ctx.fillText(parts[0] + ',', textX, cy);
        cy += cityFontSize + 4;
        let ctyFs = cityFontSize;
        ctx.font = `900 ${ctyFs}px sans-serif`;
        while (ctx.measureText(parts[1]).width > rightW - 8 && ctyFs > 28) {
          ctyFs -= 2;
          ctx.font = `900 ${ctyFs}px sans-serif`;
        }
        ctx.fillText(parts[1], textX, cy);
      } else {
        ctx.fillText(parts[0], textX, cy);
      }
      cy += 22;

      // Bottom-right asterisk
      const bx = CARD_W - 78;
      const by = CARD_H - 70;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0a0a0a';
      ctx.fillText('−·   ·−·−   ·−   ·−   ·−·−   −', bx - 28, by);

      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(bx, by + 22);
        ctx.lineTo(bx + Math.cos(a) * 10, by + 22 + Math.sin(a) * 10);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.fillStyle = '#0a0a0a';
      ctx.arc(bx, by + 22, 1.8, 0, Math.PI * 2);
      ctx.fill();

      return { textX, rightW, messageStartY: cy + 22 };
    };

    const { textX, rightW, messageStartY } = drawStatic();

    // ── Message body: handwriting image OR handwriting font fallback ──
    const renderMessage = () => {
      if (data.handwritingImageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const maxW = rightW - 8;
          const maxH = CARD_H - messageStartY - 90;
          const scale = Math.min(maxW / img.width, maxH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          ctx.drawImage(img, textX, messageStartY, drawW, drawH);
        };
        img.onerror = () => {
          drawHandwritingFallback(ctx, data.message, textX, messageStartY, rightW - 8);
        };
        img.src = data.handwritingImageUrl;
      } else {
        drawHandwritingFallback(ctx, data.message, textX, messageStartY, rightW - 8);
      }
    };

    // Wait for the Caveat font to be loaded before rendering the message
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(renderMessage).catch(renderMessage);
    } else {
      renderMessage();
    }
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={CARD_W}
      height={CARD_H}
      className={`rounded shadow-lg bg-white ${className ?? ''}`}
      style={{ imageRendering: 'crisp-edges', maxWidth: '100%', maxHeight: '78vh', width: 'auto', height: 'auto' }}
    />
  );
}

// ── Thin-pen handwriting renderer ───────────────────────────────────────────
// Draws word-by-word with a tiny seeded Y-jitter and an ink-bleed shadow
// to mimic a 0.3–0.5 mm fineliner on paper.
function drawHandwritingFallback(
  ctx: CanvasRenderingContext2D,
  message: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  ctx.save();

  // Fine-pen ink: very dark warm black (like carbon-ink in a thin rollerball)
  ctx.fillStyle = '#0f0b07';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 0.88;

  // Subtle ink-bleed: real ink spreads 0.5–1 px into paper fibres
  ctx.shadowBlur = 0.7;
  ctx.shadowColor = 'rgba(10, 7, 3, 0.28)';

  // Dancing Script 400 = true attached cursive, like a fine rollerball
  ctx.font = '400 32px "Dancing Script", cursive';

  const lineHeight = 40;

  // Deterministic jitter — same message always renders identically
  let jseed = hashString(message);
  const jitter = () => {
    jseed = (jseed * 1664525 + 1013904223) & 0xffffffff;
    return ((jseed >>> 0) / 0xffffffff - 0.5) * 1.4; // ±0.7 px vertical
  };

  // Word-by-word rendering so each word can have an independent Y offset
  const drawWords = (line: string, baseY: number) => {
    const words = line.split(' ');
    const spaceW = ctx.measureText(' ').width;
    let cx = x;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      ctx.fillText(w, cx, baseY + jitter());
      cx += ctx.measureText(w).width + (i < words.length - 1 ? spaceW : 0);
    }
  };

  const paragraphs = message.split('\n');
  let curY = y + 22;

  for (const para of paragraphs) {
    if (para.trim() === '') {
      curY += lineHeight * 0.5;
      continue;
    }
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        drawWords(line, curY);
        curY += lineHeight;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      drawWords(line, curY);
      curY += lineHeight;
    }
    curY += lineHeight * 0.08;
  }

  ctx.restore();
}
