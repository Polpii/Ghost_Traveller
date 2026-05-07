import { NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

export async function GET() {
  try {
    // Ping /health — any HTTP response (even non-200) means the server is up
    await fetch(`${HWT_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    return NextResponse.json({ available: true });
  } catch {
    // Connection refused, timeout, network error → server is down
    return NextResponse.json({ available: false });
  }
}
