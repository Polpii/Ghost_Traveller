import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${HWT_SERVICE_URL}/style-packs`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Cannot reach HWT service.' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const pdf = incoming.get('pdf');
    const name = incoming.get('name');

    if (!pdf) {
      return NextResponse.json({ error: 'pdf field is required.' }, { status: 400 });
    }

    const outgoing = new FormData();
    outgoing.append('pdf', pdf);
    if (name && typeof name === 'string') {
      outgoing.append('name', name);
    }

    const res = await fetch(`${HWT_SERVICE_URL}/style-packs`, {
      method: 'POST',
      body: outgoing,
    });

    if (!res.ok) {
      let detail = 'Style extraction failed.';
      try {
        const body = await res.json();
        detail = body.detail ?? body.error ?? detail;
      } catch {
        detail = await res.text();
      }
      return NextResponse.json({ error: detail }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Cannot reach HWT service.' }, { status: 502 });
  }
}
