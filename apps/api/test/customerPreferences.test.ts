import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPrisma } from '../src/infrastructure/database/prisma';
import { createPrismaCustomerPreferences } from '../src/modules/customer/infrastructure/customerModule';
import { DomainError } from '../src/shared/domain/DomainError';

test('preferencias: traduce cliente ausente y P2025 a error de dominio', async () => {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:1/unused';
  const customer = getPrisma().customer;
  const find = customer.findUnique;
  const update = customer.update;
  Object.assign(customer, { findUnique: async () => null,
    update: async () => { throw Object.assign(new Error('Registro ausente'), { code: 'P2025' }); },
  });
  try {
    const preferences = createPrismaCustomerPreferences();
    for (const operation of [
      () => preferences.get('ausente'),
      () => preferences.save('ausente', { dietaryRestrictions: [], allergies: [] }),
    ]) {
      await assert.rejects(operation, error => error instanceof DomainError && error.code === 'CUSTOMER_NOT_FOUND');
    }
  } finally {
    Object.assign(customer, { findUnique: find, update });
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
