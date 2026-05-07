import { NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

/** GET — proxy GPU status from the Python backend */
export async function GET() {
  try {
    const res = await fetch(`${HWT_SERVICE_URL}/training/gpu-status`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[training/gpu-status] GET proxy error:', error);
    return NextResponse.json(
      { gpu_available: false, device: 'unreachable' },
      { status: 502 },
    );
  }
}
