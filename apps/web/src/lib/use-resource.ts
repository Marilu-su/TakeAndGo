'use client';
import { useCallback, useEffect, useState } from 'react';
import { sessionRequest } from './session';
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    let active = true;
    if (!path) return;
    const load = async () => {
      setLoading(true); setError(''); setData(undefined);
      try { const result = await sessionRequest<T>(path); if (active) setData(result); }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los datos.'); }
      finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [path, revision]);
  return { data, error, loading, reload };
}
