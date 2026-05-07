import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import OpenAI from 'openai';
import { clamp, DEFAULT_HANDWRITING_PROFILE } from '@/lib/postcard/layout';
import type { HandwritingProfile } from '@/lib/postcard/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface VisionVertex {
  x?: number;
  y?: number;
}

interface VisionBoundingBox {
  vertices?: VisionVertex[];
}

interface VisionSymbol {
  text?: string;
  boundingBox?: VisionBoundingBox;
}

interface VisionWord {
  symbols?: VisionSymbol[];
  boundingBox?: VisionBoundingBox;
}

interface VisionParagraph {
  words?: VisionWord[];
}

interface VisionBlock {
  paragraphs?: VisionParagraph[];
}

interface VisionPage {
  confidence?: number;
  blocks?: VisionBlock[];
}

interface VisionFullText {
  text?: string;
  pages?: VisionPage[];
}

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: VisionFullText;
    textAnnotations?: Array<{ locale?: string }>;
    error?: { code: number; message: string };
  }>;
}

interface BoxMetrics {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  angle: number;
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function edgeLength(a: VisionVertex, b: VisionVertex) {
  const dx = (b.x ?? 0) - (a.x ?? 0);
  const dy = (b.y ?? 0) - (a.y ?? 0);
  return Math.hypot(dx, dy);
}

function getBoxMetrics(box?: VisionBoundingBox): BoxMetrics | null {
  const vertices = box?.vertices ?? [];
  if (vertices.length < 4) return null;

  const [topLeft, topRight, bottomRight, bottomLeft] = vertices;
  const xs = vertices.map((vertex) => vertex.x ?? 0);
  const ys = vertices.map((vertex) => vertex.y ?? 0);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const width = (edgeLength(topLeft, topRight) + edgeLength(bottomLeft, bottomRight)) / 2;
  const height = (edgeLength(topLeft, bottomLeft) + edgeLength(topRight, bottomRight)) / 2;

  if (width <= 1 || height <= 1) return null;

  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    angle: Math.atan2((topRight.y ?? 0) - (topLeft.y ?? 0), (topRight.x ?? 0) - (topLeft.x ?? 0)),
  };
}

function flattenWords(fullText?: VisionFullText) {
  const words: VisionWord[] = [];

  for (const page of fullText?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          if (word.symbols?.length) {
            words.push(word);
          }
        }
      }
    }
  }

  return words;
}

function flattenSymbols(fullText?: VisionFullText) {
  const symbols: VisionSymbol[] = [];

  for (const word of flattenWords(fullText)) {
    for (const symbol of word.symbols ?? []) {
      if (symbol.text?.trim()) {
        symbols.push(symbol);
      }
    }
  }

  return symbols;
}

function groupWordsIntoLines(wordBoxes: BoxMetrics[]) {
  if (wordBoxes.length === 0) return [];

  const tolerance = Math.max(10, median(wordBoxes.map((box) => box.height)) * 0.75);
  const sortedWords = [...wordBoxes].sort((a, b) => a.centerY - b.centerY || a.left - b.left);
  const lines: Array<{ centerY: number; boxes: BoxMetrics[] }> = [];

  for (const word of sortedWords) {
    const line = lines.find((entry) => Math.abs(entry.centerY - word.centerY) <= tolerance);

    if (line) {
      line.boxes.push(word);
      line.centerY = average(line.boxes.map((box) => box.centerY));
      continue;
    }

    lines.push({ centerY: word.centerY, boxes: [word] });
  }

  return lines
    .map((line) => ({
      ...line,
      boxes: [...line.boxes].sort((a, b) => a.left - b.left),
    }))
    .sort((a, b) => a.centerY - b.centerY);
}

async function sampleInkColor(rawBuffer: Buffer) {
  const { default: sharp } = await import('sharp');
  const { data } = await sharp(rawBuffer)
    .resize(280, 280, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const samples: Array<[number, number, number, number]> = [];

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const alpha = data[index + 3];

    if (alpha < 8) continue;

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luminance < 170) {
      samples.push([r, g, b, luminance]);
    }
  }

  if (samples.length === 0) {
    return {
      inkColor: DEFAULT_HANDWRITING_PROFILE.inkColor,
      darkness: 85,
    };
  }

  samples.sort((a, b) => a[3] - b[3]);
  const selected = samples.slice(0, Math.min(500, samples.length));
  const red = Math.round(average(selected.map((sample) => sample[0])));
  const green = Math.round(average(selected.map((sample) => sample[1])));
  const blue = Math.round(average(selected.map((sample) => sample[2])));
  const darkness = average(selected.map((sample) => sample[3]));

  return {
    inkColor: `#${[red, green, blue]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')}`,
    darkness,
  };
}

async function buildHandwritingProfile(rawBuffer: Buffer, fullText?: VisionFullText) {
  const wordBoxes = flattenWords(fullText)
    .map((word) => getBoxMetrics(word.boundingBox))
    .filter((box): box is BoxMetrics => box !== null);
  const symbolBoxes = flattenSymbols(fullText)
    .map((symbol) => getBoxMetrics(symbol.boundingBox))
    .filter((box): box is BoxMetrics => box !== null);

  const { inkColor, darkness } = await sampleInkColor(rawBuffer);

  if (wordBoxes.length === 0 || symbolBoxes.length === 0) {
    return {
      ...DEFAULT_HANDWRITING_PROFILE,
      inkColor,
    } satisfies HandwritingProfile;
  }

  const lines = groupWordsIntoLines(wordBoxes);
  const symbolHeights = symbolBoxes.map((box) => box.height);
  const symbolRatios = symbolBoxes.map((box) => box.width / box.height);
  const lineAngles = lines.map((line) => average(line.boxes.map((box) => box.angle)));
  const lineCenters = lines.map((line) => line.centerY);
  const lineGaps = lineCenters.slice(1).map((center, index) => center - lineCenters[index]);

  const wordGaps: number[] = [];
  for (const line of lines) {
    for (let index = 1; index < line.boxes.length; index += 1) {
      const previous = line.boxes[index - 1];
      const current = line.boxes[index];
      const gap = current.left - previous.right;
      if (gap > 0) {
        wordGaps.push(gap);
      }
    }
  }

  const avgHeight = median(symbolHeights);
  const avgRatio = median(symbolRatios);
  const avgLineGap = median(lineGaps);
  const gapRatio = avgHeight > 0 && avgLineGap > 0 ? avgLineGap / avgHeight : 1.34;
  const wordGapRatio =
    avgHeight > 0 && wordGaps.length > 0 ? median(wordGaps) / avgHeight : DEFAULT_HANDWRITING_PROFILE.wordSpacing;
  const lineAngle = clamp(average(lineAngles) || average(symbolBoxes.map((box) => box.angle)), -0.08, 0.08);
  const baselineJitter =
    clamp((standardDeviation(lineAngles) * 120) + (standardDeviation(lineGaps) / Math.max(avgHeight, 1)), 1.2, 5.5);
  const scaleX = clamp(0.88 + avgRatio * 0.24, 0.84, 1.12);
  const scaleY = clamp(1.12 - (avgRatio - 0.52) * 0.38, 0.92, 1.16);
  const slant = clamp((0.62 - avgRatio) * 0.22, -0.02, 0.12);
  const pressure = clamp(1.02 - darkness / 255, 0.68, 0.98);
  const guideLineAlpha = clamp(0.12 + baselineJitter * 0.015, 0.1, 0.24);

  return {
    inkColor,
    lineAngle,
    slant,
    wordSpacing: clamp(wordGapRatio * 0.9, 0.22, 0.62),
    lineHeightMultiplier: clamp(gapRatio * 0.92, 1.16, 1.72),
    baselineJitter,
    pressure,
    scaleX,
    scaleY,
    guideLineAlpha,
  } satisfies HandwritingProfile;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image');

    if (!(file instanceof File) || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Image file required.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be smaller than 10 MB.' }, { status: 400 });
    }

    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsJson && !credentialsPath) {
      return NextResponse.json(
        { error: 'Google credentials are not configured.' },
        { status: 500 },
      );
    }

    const auth = new GoogleAuth({
      ...(credentialsJson
        ? { credentials: JSON.parse(credentialsJson) }
        : { keyFile: credentialsPath! }),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const token = (await (await auth.getClient()).getAccessToken()).token;
    if (!token) {
      throw new Error('Failed to obtain a Google access token.');
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const visionResponse = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: rawBuffer.toString('base64') },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            imageContext: { languageHints: ['fr', 'en', 'es', 'it', 'de', 'pt', 'nl'] },
          },
        ],
      }),
    });

    if (!visionResponse.ok) {
      throw new Error(`Google Vision ${visionResponse.status}: ${await visionResponse.text()}`);
    }

    const visionData = (await visionResponse.json()) as VisionResponse;
    const payload = visionData.responses[0];

    if (payload?.error) {
      throw new Error(`Vision error ${payload.error.code}: ${payload.error.message}`);
    }

    const ocrText = payload?.fullTextAnnotation?.text?.trim() ?? '';
    if (!ocrText) {
      return NextResponse.json(
        {
          error:
            'No text was detected in the image. Make sure the photo is sharp, well lit, and readable.',
        },
        { status: 422 },
      );
    }

    const language = payload?.textAnnotations?.[0]?.locale ?? 'en';
    const confidence = payload?.fullTextAnnotation?.pages?.[0]?.confidence;
    const handwritingProfile = await buildHandwritingProfile(rawBuffer, payload?.fullTextAnnotation);

    const chat = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are Ghost Traveller, a mysterious and poetic wanderer who replies to handwritten postcards from around the world. ' +
            'Your replies should feel warm, intimate, evocative, and naturally suited to the back of a postcard. ' +
            'Write 4 to 6 short sentences that sound authentic and human. ' +
            'Always answer in the same language as the original message.',
        },
        {
          role: 'user',
          content: `Reply to this postcard:\n"${ocrText}"`,
        },
      ],
      max_tokens: 400,
      temperature: 0.88,
    });

    const replyText = chat.choices[0].message.content?.trim() ?? '';

    return NextResponse.json({
      ocrText,
      language,
      confidence,
      replyText,
      handwritingProfile,
    });
  } catch (error) {
    console.error('[analyze] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error.' },
      { status: 500 },
    );
  }
}
