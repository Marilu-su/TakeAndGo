import { apiRequest, ApiError } from './api';
export type Actor = {
  userId: string;
  role: 'CUSTOMER' | 'STORE_ADMIN' | 'STORE_EMPLOYEE' | 'ORGANIZATION_ADMIN';
  organizationId?: string;
  storeId?: string;
};
export async function sessionRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api/auth/token', { cache: 'no-store' });
  if (!response.ok) throw new ApiError('No se pudo obtener la sesión. Volvé a ingresar.', response.status);
  const { token } = await response.json() as { token?: string };
  if (!token) throw new ApiError('La sesión venció. Volvé a ingresar.', 401);
  return apiRequest<T>(path, { ...options, token });
}
export const getActor = () => sessionRequest<Actor>('/api/v1/me');
