import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeListOrganizationStores } from '../../../../src/modules/organization/application/listOrganizationStores';
test('listado de buffets: restringe el scope a la organización del administrador', async () => {
  let calls = 0;
  const list = makeListOrganizationStores({ listByOrganization: async id => { calls++; assert.equal(id, 'org-1'); return []; } });
  await assert.rejects(list({ userId: 'u', role: 'STORE_ADMIN', organizationId: 'org-1' }, 'org-1'), /permisos/);
  await assert.rejects(list({ userId: 'u', role: 'ORGANIZATION_ADMIN', organizationId: 'org-2' }, 'org-1'), /permisos/);
  assert.equal(calls, 0);
  assert.deepEqual(await list({ userId: 'u', role: 'ORGANIZATION_ADMIN', organizationId: 'org-1' }, 'org-1'), []);
  assert.equal(calls, 1);
});
