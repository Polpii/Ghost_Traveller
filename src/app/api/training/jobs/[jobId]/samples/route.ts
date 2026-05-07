import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

/** GET — list sample images for a training job */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  try {
    const res = await fetch(
      `${HWT_SERVICE_URL}/training/jobs/${jobId}/samples`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[training/jobs/${jobId}/samples] proxy error:`, error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}
