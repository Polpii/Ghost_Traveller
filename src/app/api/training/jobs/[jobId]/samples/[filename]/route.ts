import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

/** GET — serve a specific sample image from a training job */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; filename: string }> },
) {
  const { jobId, filename } = await params;
  try {
    const res = await fetch(
      `${HWT_SERVICE_URL}/training/jobs/${jobId}/samples/${encodeURIComponent(filename)}`,
      { cache: 'no-store' },
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Sample not found.' }, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (error) {
    console.error(`[training/samples/${filename}] proxy error:`, error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}
