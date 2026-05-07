import type { HandwritingProfile } from './types';

export const POSTCARD_CANVAS = {
  width: 1360,
  height: 906,
};

export const POSTCARD_TEXT_FRAME = {
  left: 60,
  top: 118,
  width: 732,
  height: 660,
  lineHeight: 74,
  fontSize: 54,
  maxLines: 8,
};

export const POSTCARD_FONT_STACK =
  "'MyHandwriting', 'Caveat', 'Segoe Print', 'Bradley Hand', 'Snell Roundhand', cursive";

export const DEFAULT_HANDWRITING_PROFILE: HandwritingProfile = {
  inkColor: '#23160f',
  lineAngle: -0.006,
  slant: -0.075,
  wordSpacing: 0.34,
  lineHeightMultiplier: 1.34,
  baselineJitter: 2.8,
  pressure: 0.92,
  scaleX: 0.96,
  scaleY: 1.04,
  guideLineAlpha: 0.18,
};

export function normalizeReplyText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function wrapHandwrittenText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  scaleX = 1,
) {
  const normalized = normalizeReplyText(text);
  const paragraphs = normalized ? normalized.split('\n') : [''];
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      if (lines.length < maxLines) lines.push('');
      continue;
    }

    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = ctx.measureText(candidate).width * scaleX;

      if (width <= maxWidth || !currentLine) {
        currentLine = candidate;
        continue;
      }

      lines.push(currentLine);
      currentLine = word;

      if (lines.length >= maxLines) {
        return lines.slice(0, maxLines);
      }
    }

    if (currentLine) {
      lines.push(currentLine);
      if (lines.length >= maxLines) {
        return lines.slice(0, maxLines);
      }
    }
  }

  return lines.slice(0, maxLines);
}
