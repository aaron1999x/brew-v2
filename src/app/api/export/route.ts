import { NextResponse } from 'next/server';
import { buildExport, exportFileName } from '@/lib/export/buildExport';
import { createClient } from '@/lib/supabase/server';
import { reportUnexpected } from '@/lib/errors/report';

// Per-user data: never cached, never shared.
export const dynamic = 'force-dynamic';

/** GET /api/export: the signed-in user's data as a JSON download. Row-level security applies. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    const now = new Date();
    const body = await buildExport(
      supabase,
      { id: user.id, email: user.email, created_at: user.created_at },
      now,
    );
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFileName(now)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    reportUnexpected(error, { route: 'export' }, true);
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }
}
