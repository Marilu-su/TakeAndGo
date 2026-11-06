import { getAuth } from '@/lib/auth/server';
import type { NextRequest } from 'next/server';
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) return Response.json({ message: 'La autenticación aún no está configurada.' }, { status: 503 });
  const handlers = getAuth().handler();
  return request.method === 'GET' ? handlers.GET(request, context) : handlers.POST(request, context);
}
export { handle as GET, handle as POST };
