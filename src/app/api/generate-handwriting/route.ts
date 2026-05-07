import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const text = incoming.get('text');
    const styleImages = incoming.getAll('style_images');

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text field is required.' }, { status: 400 });
    }
    if (styleImages.length === 0) {
      return NextResponse.json({ error: 'At least one style_images file is required.' }, { status: 400 });
    }

    // Forward the form data to the Python HWT service
    const outgoing = new FormData();
    outgoing.append('text', text);
    for (const img of styleImages) {
      outgoing.append('style_images', img);
    }

    const response = await fetch(`${HWT_SERVICE_URL}/generate-handwriting`, {
      method: 'POST',
      body: outgoing,
    });

    if (!response.ok) {
      let detail = 'HWT service error.';
      try {
        const body = await response.json();
        detail = body.detail ?? body.error ?? detail;
      } catch {
        detail = await response.text();
      }
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (error) {
    console.error('[generate-handwriting] proxy error:', error);

    const message =
      error instanceof TypeError && 'cause' in error
        ? 'Cannot reach the HWT Python service. Make sure it is running on port 8000.'
        : error instanceof Error
          ? error.message
          : 'Unexpected error.';

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
