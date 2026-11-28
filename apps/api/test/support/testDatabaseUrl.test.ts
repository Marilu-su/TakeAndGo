import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTestDatabaseUrl } from './testDatabaseUrl';

test('permite pruebas puras sin DATABASE_URL', () => {
  assert.doesNotThrow(() => validateTestDatabaseUrl({}));
});

test('rechaza configuraciones explícitas fuera del perfil sin exponer credenciales', () => {
  const rejected = [
    '',
    'no-es-url-con-secreto-ficticio',
    'postgresql://usuario-ficticio:secreto-ficticio@db.example.invalid:5434/takeandgo',
    'postgresql://usuario-ficticio:secreto-ficticio@localhost:5434/takeandgo',
    'postgresql://usuario-ficticio:secreto-ficticio@127.0.0.1:5432/takeandgo',
    'postgresql://usuario-ficticio:secreto-ficticio@127.0.0.1:5434/otra_base',
    'postgresql://usuario-ficticio:secreto-ficticio@127.0.0.1:5434/takeandgo?host=db.example.invalid',
    'postgresql://usuario-ficticio:secreto-ficticio%@127.0.0.1:5434/takeandgo',
    'https://usuario-ficticio:secreto-ficticio@127.0.0.1:5434/takeandgo',
  ];

  for (const DATABASE_URL of rejected) {
    assert.throws(() => validateTestDatabaseUrl({ DATABASE_URL }), {
      message: 'DATABASE_URL no corresponde a un perfil PostgreSQL de pruebas autorizado.',
    });
  }
});

test('acepta el perfil local de pruebas y el servicio efímero de API CI', () => {
  for (const credentials of ['runner:ficticio', 'postgres:postgres']) {
    const DATABASE_URL = `postgresql://${credentials}@127.0.0.1:5434/takeandgo`;
    assert.doesNotThrow(() => validateTestDatabaseUrl({ DATABASE_URL }));
  }
});

test('E.2 requiere activación, rol y puerto descartable', () => {
  const DATABASE_URL = 'postgresql://mvp09_e2_runner:ficticio@127.0.0.1:52748/takeandgo_mvp09_e2';
  assert.throws(() => validateTestDatabaseUrl({ DATABASE_URL }));
  assert.throws(() => validateTestDatabaseUrl({
    DATABASE_URL: DATABASE_URL.replace('mvp09_e2_runner', 'otro'),
    RUN_MVP09_POSTGRES: '1',
  }));
  assert.throws(() => validateTestDatabaseUrl({
    DATABASE_URL: DATABASE_URL.replace('52748', '5432'),
    RUN_MVP09_POSTGRES: '1',
  }));
  assert.doesNotThrow(() => validateTestDatabaseUrl({ DATABASE_URL, RUN_MVP09_POSTGRES: '1' }));
});
