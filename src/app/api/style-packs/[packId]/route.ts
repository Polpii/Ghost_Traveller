import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ packId: string }> },
) {
  const { packId } = await params;
  try {
    const res = await fetch(`${HWT_SERVICE_URL}/style-packs/${packId}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Cannot reach HWT service.' }, { status: 502 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ packId: string }> },
) {
  const { packId } = await params;
  try {
    const res = await fetch(`${HWT_SERVICE_URL}/style-packs/${packId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Cannot reach HWT service.' }, { status: 502 });
  }
}
