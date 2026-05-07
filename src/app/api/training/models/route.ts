import { NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

/** GET — list all ready fine-tuned models */
export async function GET() {
  try {
    const res = await fetch(`${HWT_SERVICE_URL}/training/models`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[training/models] proxy error:', error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}
