'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clamp,
  DEFAULT_HANDWRITING_PROFILE,
  POSTCARD_CANVAS,
  POSTCARD_FONT_STACK,
  POSTCARD_TEXT_FRAME,
  normalizeReplyText,
  wrapHandwrittenText,
} from '@/lib/postcard/layout';
import type { HandwritingProfile } from '@/lib/postcard/types';

export interface PostcardRendererProps {
  replyText: string;
  inkColor?: string;
  handwritingProfile?: HandwritingProfile;
  hwtImageUrl?: string;
  preserveHwtImageColor?: boolean;
  glyphImageUrl?: string;
  animate?: boolean;
  glyphPlacements?: Array<{ char: string; x: number; y: number; w: number; h: number; line: number }>;
}

function seededNoise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453123;
  return value - Math.floor(value);
}

function wordSeed(lineIndex: number, wordIndex: number, word: string) {
  let hash = 17 + lineIndex * 97 + wordIndex * 131;
  for (const character of word) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1000003;
  }
  return hash;
}

function drawPaperBackground(ctx: CanvasRenderingContext2D) {
  const { width, height } = POSTCARD_CANVAS;
  const gradient = ctx.createLinearGradient(0, 0, width * 0.82, height);
  gradient.addColorStop(0, '#fbf4df');
  gradient.addColorStop(0.48, '#f4e7c9');
  gradient.addColorStop(1, '#ecd9b2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const noise = document.createElement('canvas');
  noise.width = 240;
  noise.height = 240;
  const noiseCtx = noise.getContext('2d');
  if (!noiseCtx) return;

  for (let i = 0; i < 5200; i += 1) {
    const x = Math.random() * noise.width;
    const y = Math.random() * noise.height;
    const alpha = Math.random() * 0.06;
    const tone = 140 + Math.floor(Math.random() * 55);
    noiseCtx.fillStyle = `rgba(${tone}, ${tone - 18}, ${tone - 42}, ${alpha.toFixed(3)})`;
    noiseCtx.fillRect(x, y, 1.3, 1.3);
  }

  const pattern = ctx.createPattern(noise, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawChrome(ctx: CanvasRenderingContext2D) {
  const { width, height } = POSTCARD_CANVAS;

  ctx.strokeStyle = '#c7a56c';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  const dividerX = 840;
  const dividerGradient = ctx.createLinearGradient(0, 0, 0, height);
  dividerGradient.addColorStop(0, 'transparent');
  dividerGradient.addColorStop(0.08, 'rgba(150, 108, 42, 0.9)');
  dividerGradient.addColorStop(0.92, 'rgba(150, 108, 42, 0.9)');
  dividerGradient.addColorStop(1, 'transparent');
  ctx.strokeStyle = dividerGradient;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dividerX, 0);
  ctx.lineTo(dividerX, height);
  ctx.stroke();

  ctx.save();
  ctx.font = 'italic 20px Georgia, serif';
  ctx.fillStyle = 'rgba(112, 72, 20, 0.6)';
  ctx.fillText('Ghost Traveller', POSTCARD_TEXT_FRAME.left, 52);
  ctx.restore();

  ctx.save();
  ctx.font = '16px Georgia, serif';
  ctx.fillStyle = '#9d7443';
  ctx.textAlign = 'center';
  ctx.fillText('POSTCARD', 1100, 66);
  ctx.restore();

  const rightX = 892;
  const rightW = 420;
  ctx.strokeStyle = '#c2a068';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rightX, 78);
  ctx.lineTo(rightX + rightW, 78);
  ctx.stroke();

  const stampX = rightX + rightW - 116;
  const stampY = 92;
  ctx.save();
  ctx.globalAlpha = 0.44;
  ctx.strokeStyle = '#9a7040';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(stampX, stampY, 112, 132);
  ctx.setLineDash([]);
  ctx.font = '12px Georgia, serif';
  ctx.fillStyle = '#9a7040';
  ctx.textAlign = 'center';
  ctx.fillText('STAMP', stampX + 56, stampY + 114);
  ctx.restore();

  const postmarkX = rightX + 128;
  const postmarkY = 182;
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = '#7a5020';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(postmarkX, postmarkY, 56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(postmarkX - 40, postmarkY - 14);
  ctx.lineTo(postmarkX + 40, postmarkY - 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(postmarkX - 40, postmarkY + 14);
  ctx.lineTo(postmarkX + 40, postmarkY + 14);
  ctx.stroke();
  ctx.font = 'bold 14px Georgia, serif';
  ctx.fillStyle = '#5a3010';
  ctx.textAlign = 'center';
  ctx.fillText('GHOST', postmarkX, postmarkY - 2);
  ctx.fillText('TRAVELLER', postmarkX, postmarkY + 18);
  ctx.restore();

  for (let i = 0; i < 4; i += 1) {
    const y = 596 + i * 60;
    const lineGradient = ctx.createLinearGradient(rightX, 0, rightX + rightW, 0);
    lineGradient.addColorStop(0, 'rgba(170, 128, 72, 0.55)');
    lineGradient.addColorStop(1, 'rgba(201, 168, 72, 0.22)');
    ctx.strokeStyle = lineGradient;
    ctx.beginPath();
    ctx.moveTo(rightX, y);
    ctx.lineTo(rightX + rightW, y);
    ctx.stroke();
  }
}

function mergeProfile(
  handwritingProfile?: HandwritingProfile,
  inkColor?: string,
): HandwritingProfile {
  return {
    ...DEFAULT_HANDWRITING_PROFILE,
    ...handwritingProfile,
    inkColor: inkColor ?? handwritingProfile?.inkColor ?? DEFAULT_HANDWRITING_PROFILE.inkColor,
  };
}

function drawGuides(
  ctx: CanvasRenderingContext2D,
  top: number,
  width: number,
  lineHeight: number,
  maxLines: number,
  guideLineAlpha: number,
) {
  ctx.save();
  ctx.strokeStyle = `rgba(164, 118, 62, ${guideLineAlpha.toFixed(3)})`;
  ctx.lineWidth = 1;

  for (let index = 0; index < maxLines; index += 1) {
    const y = top + index * lineHeight + 10;
    ctx.beginPath();
    ctx.moveTo(POSTCARD_TEXT_FRAME.left - 4, y);
    ctx.lineTo(POSTCARD_TEXT_FRAME.left + width + 6, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHandwrittenReply(
  ctx: CanvasRenderingContext2D,
  replyText: string,
  profile: HandwritingProfile,
) {
  const { left, top, width, fontSize, maxLines } = POSTCARD_TEXT_FRAME;
  const resolvedFontSize = Math.round(fontSize * clamp(profile.scaleY * 0.99, 0.92, 1.08));
  const lineHeight = resolvedFontSize * profile.lineHeightMultiplier;

  ctx.save();
  ctx.font = `${resolvedFontSize}px ${POSTCARD_FONT_STACK}`;
  ctx.fillStyle = profile.inkColor;
  ctx.textBaseline = 'alphabetic';

  const lines = wrapHandwrittenText(ctx, replyText, width, maxLines, profile.scaleX);
  drawGuides(ctx, top, width, lineHeight, maxLines, profile.guideLineAlpha);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line) continue;

    const words = line.split(/\s+/).filter(Boolean);
    const baseY =
      top +
      lineIndex * lineHeight +
      Math.sin((lineIndex + 1) * 0.9) * profile.baselineJitter * 0.35;
    let cursorX = left + (lineIndex % 2 === 0 ? 0 : 3);

    for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
      const word = words[wordIndex];
      const seed = wordSeed(lineIndex, wordIndex, word);
      const localScaleX = profile.scaleX * (0.97 + seededNoise(seed) * 0.08);
      const localScaleY = profile.scaleY * (0.98 + seededNoise(seed + 1) * 0.05);
      const localSlant = profile.slant + (seededNoise(seed + 2) - 0.5) * 0.02;
      const localAngle =
        profile.lineAngle + (seededNoise(seed + 3) - 0.5) * 0.014;
      const localY =
        baseY + (seededNoise(seed + 4) - 0.5) * profile.baselineJitter * 1.3;
      const measuredWidth =
        ctx.measureText(word).width * localScaleX + Math.abs(localSlant) * resolvedFontSize * 0.25;

      if (cursorX + measuredWidth > left + width) {
        break;
      }

      ctx.save();
      ctx.translate(cursorX, localY);
      ctx.rotate(localAngle);
      ctx.transform(localScaleX, 0, localSlant, localScaleY, 0, 0);
      ctx.globalAlpha = profile.pressure;
      ctx.fillText(word, 0, 0);
      ctx.globalAlpha = clamp(profile.pressure * 0.32, 0.18, 0.4);
      ctx.fillText(word, 0.6, 0.5);
      ctx.restore();

      const gap =
        resolvedFontSize *
        profile.wordSpacing *
        (0.92 + seededNoise(seed + 5) * 0.22);
      cursorX += measuredWidth + gap;
    }
  }

  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load HWT image'));
    img.src = src;
  });
}

function drawHWTHandwriting(
  ctx: CanvasRenderingContext2D,
  hwtImg: HTMLImageElement,
  profile: HandwritingProfile,
  preserveColor = false,
) {
  const { left, top, width, height } = POSTCARD_TEXT_FRAME;

  // Scale HWT output to fit the text frame while keeping aspect ratio
  const hwtAspect = hwtImg.width / hwtImg.height;
  const frameAspect = width / height;
  let drawW: number;
  let drawH: number;
  if (hwtAspect > frameAspect) {
    drawW = width;
    drawH = width / hwtAspect;
  } else {
    drawH = height;
    drawW = height * hwtAspect;
  }

  // Draw onto a temp canvas so we can recolour the grayscale output
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(drawW);
  tmp.height = Math.round(drawH);
  const tmpCtx = tmp.getContext('2d');
  if (!tmpCtx) return;

  tmpCtx.drawImage(hwtImg, 0, 0, tmp.width, tmp.height);
  const imgData = tmpCtx.getImageData(0, 0, tmp.width, tmp.height);
  const d = imgData.data;

  if (preserveColor) {
    for (let i = 0; i < d.length; i += 4) {
      const brightness = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      const saturation = (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 255;
      const alpha = Math.max(1 - brightness, saturation * 0.9);
      d[i + 3] = Math.round(clamp(alpha * 1.55, 0, 1) * 255 * profile.pressure);
    }
  } else {
    // Parse ink colour from profile
    const hex = profile.inkColor.replace('#', '');
    const inkR = parseInt(hex.substring(0, 2), 16);
    const inkG = parseInt(hex.substring(2, 4), 16);
    const inkB = parseInt(hex.substring(4, 6), 16);

    for (let i = 0; i < d.length; i += 4) {
      const brightness = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      const darkness = 1 - brightness;
      d[i] = inkR;
      d[i + 1] = inkG;
      d[i + 2] = inkB;
      d[i + 3] = Math.round(clamp(darkness * 1.6, 0, 1) * 255 * profile.pressure);
    }
  }

  tmpCtx.putImageData(imgData, 0, 0);
  ctx.drawImage(tmp, left, top);
}

function drawGlyphEngineHandwriting(
  ctx: CanvasRenderingContext2D,
  glyphImg: HTMLImageElement,
  profile: HandwritingProfile,
  revealFraction?: number,
  placements?: Array<{ char: string; x: number; y: number; w: number; h: number; line: number }>,
) {
  const { left, top, width, height } = POSTCARD_TEXT_FRAME;

  // Scale glyph engine output to fit the text frame while keeping aspect ratio
  const aspect = glyphImg.width / glyphImg.height;
  const frameAspect = width / height;
  let drawW: number;
  let drawH: number;
  if (aspect > frameAspect) {
    drawW = width;
    drawH = width / aspect;
  } else {
    drawH = height;
    drawW = height * aspect;
  }

  const scaleX = drawW / glyphImg.width;
  const scaleY = drawH / glyphImg.height;

  ctx.save();
  ctx.globalAlpha = profile.pressure;

  // Per-character reveal using glyph placements
  if (revealFraction !== undefined && revealFraction < 1 && placements && placements.length > 0) {
    // Sort placements by line, then x position for natural writing order
    const sorted = [...placements].sort((a, b) => {
      if (a.line !== b.line) return a.line - b.line;
      return a.x - b.x;
    });

    const revealCount = Math.floor(sorted.length * revealFraction);

    // Draw the image but clip to only revealed character regions
    for (let i = 0; i < revealCount; i++) {
      const p = sorted[i];
      // Map placement coordinates to draw coordinates
      const px = left + p.x * scaleX;
      const py = top + p.y * scaleY;
      const pw = p.w * scaleX;
      const ph = p.h * scaleY;

      // Add small padding around each glyph
      const pad = 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(px - pad, py - pad, pw + pad * 2, ph + pad * 2);
      ctx.clip();
      ctx.drawImage(glyphImg, left, top, Math.round(drawW), Math.round(drawH));
      ctx.restore();
    }

    // Partially reveal the next character (fade in)
    if (revealCount < sorted.length) {
      const partialFraction = (revealFraction * sorted.length) - revealCount;
      const p = sorted[revealCount];
      const px = left + p.x * scaleX;
      const py = top + p.y * scaleY;
      const pw = p.w * scaleX;
      const ph = p.h * scaleY;
      const pad = 2;

      ctx.save();
      ctx.globalAlpha = profile.pressure * partialFraction;
      ctx.beginPath();
      ctx.rect(px - pad, py - pad, pw + pad * 2, ph + pad * 2);
      ctx.clip();
      ctx.drawImage(glyphImg, left, top, Math.round(drawW), Math.round(drawH));
      ctx.restore();
    }
  } else if (revealFraction !== undefined && revealFraction < 1) {
    // Fallback: progressive left-to-right reveal if no placements
    const revealW = Math.round(drawW * revealFraction);
    ctx.beginPath();
    ctx.rect(left, top, revealW, Math.round(drawH));
    ctx.clip();
  }

  // Glyph engine output is RGBA with ink color already baked in.
  ctx.drawImage(glyphImg, left, top, Math.round(drawW), Math.round(drawH));
  ctx.restore();
}

function renderPostcard(
  replyText: string,
  handwritingProfile?: HandwritingProfile,
  inkColor?: string,
  hwtImg?: HTMLImageElement | null,
  glyphImg?: HTMLImageElement | null,
  preserveHwtImageColor = false,
  revealFraction?: number,
  placements?: Array<{ char: string; x: number; y: number; w: number; h: number; line: number }>,
) {
  const canvas = document.createElement('canvas');
  canvas.width = POSTCARD_CANVAS.width;
  canvas.height = POSTCARD_CANVAS.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context unavailable.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const profile = mergeProfile(handwritingProfile, inkColor);

  drawPaperBackground(ctx);
  drawChrome(ctx);

  if (glyphImg) {
    drawGlyphEngineHandwriting(ctx, glyphImg, profile, revealFraction, placements);
  } else if (hwtImg) {
    drawHWTHandwriting(ctx, hwtImg, profile, preserveHwtImageColor);
  } else {
    drawHandwrittenReply(ctx, normalizeReplyText(replyText), profile);
  }

  return canvas.toDataURL('image/png');
}

export default function PostcardRenderer({
  replyText,
  inkColor,
  handwritingProfile,
  hwtImageUrl,
  preserveHwtImageColor = false,
  glyphImageUrl,
  animate = false,
  glyphPlacements,
}: PostcardRendererProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [animating, setAnimating] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function build() {
      setRendering(true);
      setDataUrl(null);
      setAnimating(false);

      await document.fonts.ready;
      await document.fonts.load(`54px ${POSTCARD_FONT_STACK}`, 'Hello');

      let hwtImg: HTMLImageElement | null = null;
      if (hwtImageUrl) {
        try {
          hwtImg = await loadImage(hwtImageUrl);
        } catch {
          // fall back to font rendering
        }
      }

      let glyphImg: HTMLImageElement | null = null;
      if (glyphImageUrl) {
        try {
          glyphImg = await loadImage(glyphImageUrl);
        } catch {
          // fall back to font rendering
        }
      }

      if (cancelled) return;

      // Animation: progressive reveal for glyph engine output
      if (animate && glyphImg) {
        setAnimating(true);
        const duration = 2800; // ms
        const startTime = performance.now();

        const tick = (now: number) => {
          if (cancelled) return;
          const elapsed = now - startTime;
          const fraction = Math.min(1, elapsed / duration);
          // Ease-out for natural writing feel
          const eased = 1 - Math.pow(1 - fraction, 2.2);

          const url = renderPostcard(
            replyText, handwritingProfile, inkColor, hwtImg, glyphImg, preserveHwtImageColor, eased, glyphPlacements,
          );
          setDataUrl(url);

          if (fraction < 1) {
            animFrameRef.current = requestAnimationFrame(tick);
          } else {
            setAnimating(false);
            setRendering(false);
          }
        };

        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        const url = renderPostcard(replyText, handwritingProfile, inkColor, hwtImg, glyphImg, preserveHwtImageColor, undefined, glyphPlacements);
        if (cancelled) return;

        setDataUrl(url);
        setRendering(false);
      }
    }

    build().catch(() => {
      if (!cancelled) setRendering(false);
    });

    return () => {
      cancelled = true;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [replyText, inkColor, handwritingProfile, hwtImageUrl, preserveHwtImageColor, glyphImageUrl, animate, glyphPlacements]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="relative overflow-hidden rounded-sm border border-stone-200 bg-amber-50 shadow-xl"
        style={{ width: 680, height: 453 }}
      >
        {rendering && !animating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="text-sm font-sans text-stone-500">Matching the uploaded handwriting...</p>
          </div>
        )}
        {dataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="Ghost Traveller postcard"
            style={{ width: 680, height: 453, display: 'block' }}
          />
        )}
      </div>

      {dataUrl && (
        <div className="flex flex-wrap justify-center gap-3 font-sans">
          <a
            href={dataUrl}
            download="ghost-traveller-reply.png"
            className="rounded-full bg-stone-800 px-6 py-2.5 text-sm font-medium text-stone-50 shadow transition-colors hover:bg-stone-900"
          >
            Download PNG
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-full border border-stone-400 px-6 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
          >
            Print
          </button>
        </div>
      )}

      <p className="max-w-md text-center font-sans text-xs text-stone-400">
        The renderer now adapts ink color, line angle, spacing, pressure, and rhythm from the
        uploaded writing.
      </p>
    </div>
  );
}
