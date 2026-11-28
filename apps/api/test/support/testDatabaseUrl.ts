type TestDatabaseEnv = {
  DATABASE_URL?: string;
  RUN_MVP09_POSTGRES?: string;
};

export function validateTestDatabaseUrl(env: TestDatabaseEnv): void {
  const value = env.DATABASE_URL;
  if (value === undefined) return;

  const url = URL.parse(value);
  if (!url || !value.startsWith('postgresql://') || /[\s\\?#]|%(?![0-9a-f]{2})/i.test(value) ||
      url.hostname !== '127.0.0.1' || !url.username || !url.password) {
    throw new Error('DATABASE_URL no corresponde a un perfil PostgreSQL de pruebas autorizado.');
  }

  // Perfil compartido por las pruebas locales y el servicio efímero de API CI.
  if (url.port === '5434' && url.pathname === '/takeandgo') return;

  // E.2 usa un puerto asignado al contenedor y comprueba su identidad antes de escribir.
  if (env.RUN_MVP09_POSTGRES === '1' && url.pathname === '/takeandgo_mvp09_e2' &&
      url.username === 'mvp09_e2_runner' && Number(url.port) > 1024 && url.port !== '5432') {
    return;
  }

  throw new Error('DATABASE_URL no corresponde a un perfil PostgreSQL de pruebas autorizado.');
}
