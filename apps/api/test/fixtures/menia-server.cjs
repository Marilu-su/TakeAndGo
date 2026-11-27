// Servidor exclusivo de pruebas. No se importa desde la aplicación ni usa la BD.
require('tsx/cjs');
const { createApp } = require('../../src/app.ts');
const { makeMeniaUseCases } = require('../../src/modules/menia/application/meniaUseCases.ts');
const { DeterministicMeniaResponder } = require('../../src/modules/menia/infrastructure/deterministicResponder.ts');
const app = createApp({
  resolveActor: async req => req.headers.authorization === 'Bearer menia-integration-token'
    ? { role: 'CUSTOMER', userId: 'integration-customer' } : null,
  meniaUseCases: makeMeniaUseCases({
    getStore: async id => ({ id, name: 'Buffet de integración', organizationId: 'integration-org', status: 'ACTIVE' }),
    listCustomerStores: async () => [{ id: 'integration-store' }],
    responder: new DeterministicMeniaResponder(),
  }),
});
const server = app.listen(0, '127.0.0.1', () => { process.send({ port: server.address().port }); });
process.on('disconnect', () => server.close());
