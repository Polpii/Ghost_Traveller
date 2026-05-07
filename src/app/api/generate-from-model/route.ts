import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

/** POST — generate handwriting using a fine-tuned model */
export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const text = incoming.get('text');
    const jobId = incoming.get('job_id');

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text field is required.' }, { status: 400 });
    }
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'job_id field is required.' }, { status: 400 });
    }

    const outgoing = new FormData();
    outgoing.append('text', text);
    outgoing.append('job_id', jobId);

    const res = await fetch(`${HWT_SERVICE_URL}/generate-from-model`, {
      method: 'POST',
      body: outgoing,
    });

    if (!res.ok) {
      let detail = 'Fine-tuned generation error.';
      try {
        const body = await res.json();
        detail = body.detail ?? body.error ?? detail;
      } catch {
        detail = await res.text();
      }
      return NextResponse.json({ error: detail }, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (error) {
    console.error('[generate-from-model] proxy error:', error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}
