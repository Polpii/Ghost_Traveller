import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const text = incoming.get('text');
    const packId = incoming.get('pack_id');
    const engine = incoming.get('engine');

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text field is required.' }, { status: 400 });
    }
    if (!packId || typeof packId !== 'string') {
      return NextResponse.json({ error: 'pack_id field is required.' }, { status: 400 });
    }

    const outgoing = new FormData();
    outgoing.append('text', text);
    outgoing.append('pack_id', packId);
    if (engine && typeof engine === 'string') {
      outgoing.append('engine', engine);
    }

    const res = await fetch(`${HWT_SERVICE_URL}/generate-from-style`, {
      method: 'POST',
      body: outgoing,
    });

    if (!res.ok) {
      let detail = 'Generation failed.';
      try {
        const body = await res.json();
        detail = body.detail ?? body.error ?? detail;
      } catch {
        detail = await res.text();
      }
      return NextResponse.json({ error: detail }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') ?? '';

    // Glyph engine may return JSON when it can't produce image
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    }

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  } catch {
    return NextResponse.json({ error: 'Cannot reach HWT service.' }, { status: 502 });
  }
}
