import { NextRequest, NextResponse } from 'next/server';

const HWT_SERVICE_URL = process.env.HWT_SERVICE_URL ?? 'http://localhost:8000';

/** GET — get details for a specific training job */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  try {
    const res = await fetch(`${HWT_SERVICE_URL}/training/jobs/${jobId}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[training/jobs/${jobId}] GET proxy error:`, error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}

/** POST — pause or resume-training a job (action via query param) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const action = req.nextUrl.searchParams.get('action');

  if (action !== 'pause' && action !== 'resume-training') {
    return NextResponse.json(
      { error: 'Invalid action. Use ?action=pause or ?action=resume-training' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${HWT_SERVICE_URL}/training/jobs/${jobId}/${action}`, {
      method: 'POST',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[training/jobs/${jobId}/${action}] POST proxy error:`, error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}

/** DELETE — delete a training job */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  try {
    const res = await fetch(`${HWT_SERVICE_URL}/training/jobs/${jobId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[training/jobs/${jobId}] DELETE proxy error:`, error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}

/** PATCH — update job settings (e.g. epochs) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  try {
    const body = await req.formData();
    const res = await fetch(`${HWT_SERVICE_URL}/training/jobs/${jobId}`, {
      method: 'PATCH',
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[training/jobs/${jobId}] PATCH proxy error:`, error);
    return NextResponse.json(
      { error: 'Cannot reach the HWT Python service.' },
      { status: 502 },
    );
  }
}
