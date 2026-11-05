import { createNeonAuth } from '@neondatabase/auth/next/server';
export function getAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32) throw new Error('Configurá NEON_AUTH_BASE_URL y NEON_AUTH_COOKIE_SECRET (mínimo 32 caracteres).');
  return createNeonAuth({ baseUrl, cookies: { secret } });
}
