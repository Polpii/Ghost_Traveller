import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ packId: string }> },
) {
  const { packId } = await params;
  try {
    const res = await fetch(`${HWT_SERVICE_URL}/style-packs/${packId}/preview`);
    if (!res.ok) {
      let detail = 'Preview failed.';
      try {
        const body = await res.json();
        detail = body.detail ?? body.error ?? detail;
      } catch {
        detail = await res.text();
      }
      return NextResponse.json({ error: detail }, { status: res.status });
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
