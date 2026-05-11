import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

interface RequestBody {
  message?: string;
  city?: string;
  place?: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; mime_type?: string; data?: string };
  inline_data?: { mimeType?: string; mime_type?: string; data?: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  error?: { message?: string };
}

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_API_KEY not set' }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = (body.message ?? '').trim();
  const city = (body.city ?? '').trim();
  const place = (body.place ?? '').trim();

  if (!message && !city) {
    return NextResponse.json({ error: 'Missing message or city' }, { status: 400 });
  }

  const prompt = [
    "Create an illustration in the unmistakable style of Christoph Niemann's 'Sunday Sketches' and watercolor travel sketchbook work.",
    'STRICT STYLE RULES:',
    '— A loose, expressive watercolor / ink-wash painting of a real place (architecture, landscape, street, interior) rendered in GRAYSCALE only. Use white, paper-cream, soft gray washes and deep black ink. Absolutely no color, no hue, no tint.',
    '— Visible brush strokes, watery edges, paper texture, slight bleeds. Painterly, hand-made, NOT digital-clean, NOT photographic.',
    '— Composition shows a recognizable scene of the place, but stylised and slightly abstract, with simplified shapes and dramatic light/shadow.',
    '— On TOP of this painted scene, overlay a SINGLE flat solid-black silhouette character (a ghostly traveller). The silhouette must be drawn in PURE FLAT BLACK INK, no shading, like a sticker pasted on the watercolor — exactly the way Niemann inserts a black ink figure over a photo or sketch.',
    '— The black silhouette interacts cleverly with the painted scene (uses an element of the scene as a prop, leans on a building, walks along a line, sits on a roof, holds the moon, etc.). Witty visual metaphor tying the figure to the postcard message.',
    "— The silhouette is small-to-medium, NOT the whole canvas. The painted place dominates; the figure is the visual punchline.",
    '— Tall portrait aspect ratio (roughly 3:4). No text, no letters, no captions anywhere.',
    `Place to depict: ${city || 'an unspecified place'}${place ? `, specifically around ${place}` : ''}.`,
    `Postcard message that should inspire the visual metaphor of the black silhouette: "${message.slice(0, 600)}"`,
    'Final image must read as: watercolor travel sketch of a place + one flat black ink ghost-silhouette overlaid on top, fully grayscale.',
  ].join(' ');

  const model = process.env.LENS_GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    });

    const data = (await res.json()) as GeminiResponse;

    if (!res.ok) {
      const msg = data.error?.message || `Gemini error ${res.status}`;
      console.error('[generate-image] Gemini error:', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    let base64: string | undefined;
    let mime = 'image/png';
    for (const part of parts) {
      const inline = part.inlineData ?? part.inline_data;
      if (inline?.data) {
        base64 = inline.data;
        mime = inline.mimeType ?? inline.mime_type ?? mime;
        break;
      }
    }

    if (!base64) {
      console.error('[generate-image] No image in response:', JSON.stringify(data).slice(0, 500));
      return NextResponse.json({ error: 'No image returned by model' }, { status: 502 });
    }

    return NextResponse.json({ imageDataUrl: `data:${mime};base64,${base64}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
