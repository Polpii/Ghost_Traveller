import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

/** POST — create a training job (upload PDF + start pipeline) */
export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const outgoing = new FormData();
    outgoing.append('pdf', incoming.get('pdf') as Blob);
    if (incoming.get('name')) outgoing.append('name', String(incoming.get('name')));
    if (incoming.get('epochs')) outgoing.append('epochs', String(incoming.get('epochs')));

    const res = await fetch(`${HWT_SERVICE_URL}/training/jobs`, {
      method: 'POST',
      body: outgoing,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[training/jobs] POST proxy error:', error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}

/** GET — list all training jobs */
export async function GET() {
  try {
    const res = await fetch(`${HWT_SERVICE_URL}/training/jobs`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[training/jobs] GET proxy error:', error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}
