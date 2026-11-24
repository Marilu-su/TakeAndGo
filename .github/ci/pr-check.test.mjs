import assert from 'node:assert/strict';
import test from 'node:test';
import { gateFailures, selectSuites } from './pr-check.mjs';

const selections = [
  ['API', ['apps/api/src/app.ts'], { api: true, web: false }],
  ['frontend', ['apps/web/src/app/page.tsx'], { api: false, web: true }],
  ['mixto', ['apps/api/package.json', 'apps/web/package-lock.json'], { api: true, web: true }],
  ['documental', ['docs/architecture/T08.md', 'CONTRIBUTING.md', 'apps/web/README.md'], { api: false, web: false }],
  ['runtime compartido', ['.node-version'], { api: true, web: true }],
  ['atributos del repo', ['.gitattributes'], { api: true, web: true }],
  ['orquestador', ['.github/workflows/pr-ci.yml'], { api: true, web: true }],
  ['lógica compartida', ['.github/ci/pr-check.mjs'], { api: true, web: true }],
  ['workflow API', ['.github/workflows/api-ci.yml'], { api: true, web: false }],
  ['workflow web', ['.github/workflows/web-ci.yml'], { api: false, web: true }],
  ['deploy web', ['.github/workflows/deploy-web.yml'], { api: false, web: true }],
  ['ruta desconocida', ['config/toolchain.json'], { api: true, web: true }],
];

for (const [label, paths, expected] of selections) {
  test(`Selecciona suites para PR ${label}`, () => {
    assert.deepEqual(selectSuites(paths), expected);
  });
}

const passing = {
  changes: 'success',
  apiSelected: 'true',
  apiResult: 'success',
  webSelected: 'false',
  webResult: 'skipped',
};

test('Acepta API aplicable exitosa y web no aplicable omitida', () => {
  assert.deepEqual(gateFailures(passing), []);
});

test('Acepta web aplicable exitosa y API no aplicable omitida', () => {
  assert.deepEqual(gateFailures({ ...passing, apiSelected: 'false', apiResult: 'skipped', webSelected: 'true', webResult: 'success' }), []);
});

test('Acepta un PR mixto con ambas suites exitosas', () => {
  assert.deepEqual(gateFailures({ ...passing, webSelected: 'true', webResult: 'success' }), []);
});

test('Acepta PR documental con selección exitosa y ambas suites omitidas', () => {
  assert.deepEqual(gateFailures({ ...passing, apiSelected: 'false', apiResult: 'skipped' }), []);
});

for (const result of ['failure', 'cancelled', 'skipped', '']) {
  test(`Rechaza suite API aplicable con resultado ${result || 'ausente'}`, () => {
    assert.equal(gateFailures({ ...passing, apiResult: result }).length, 1);
  });
  test(`Rechaza selección con resultado ${result || 'ausente'}`, () => {
    assert.equal(gateFailures({ ...passing, changes: result }).length, 1);
  });
}

test('Rechaza el fallo de web en un PR mixto aunque API pase', () => {
  assert.equal(gateFailures({ ...passing, webSelected: 'true', webResult: 'failure' }).length, 1);
});

test('Rechaza selección ausente o inválida', () => {
  assert.equal(gateFailures({ ...passing, apiSelected: '', webSelected: 'yes' }).length, 2);
});

test('Rechaza un resultado inesperado para una suite no aplicable', () => {
  assert.equal(gateFailures({ ...passing, webResult: 'success' }).length, 1);
});
