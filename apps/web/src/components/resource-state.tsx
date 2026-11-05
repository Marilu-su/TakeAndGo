export function ResourceState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  return loading ? <p role="status">Cargando…</p> : error ? <div className="panel"><p role="alert" className="error">{error}</p><button onClick={retry}>Reintentar</button></div> : null;
}
