import { NextResponse } from 'next/server';

// This endpoint is no longer used — the postcard is rendered client-side via CSS/canvas.
export async function POST() {
  return NextResponse.json({ error: 'Endpoint deprecated.' }, { status: 410 });
}
