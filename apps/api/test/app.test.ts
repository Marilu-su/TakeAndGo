import express from 'express';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app, { createApp } from '../src/app';
import errorHandler from '../src/middlewares/errorHandler';

test('GET /health responde 200 y estado ok', async () => {
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.service, 'take-and-go-api');
  assert.ok(response.body.timestamp);
});

test('una ruta inexistente responde 404', async () => {
  const response = await request(app).get('/no-existe');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: 'Ruta no encontrada',
  });
});

test('el middleware de errores responde 500', async () => {
  const testApp = express();

  testApp.get('/forzar-error', () => {
    throw new Error('Error de prueba');
  });

  testApp.use(errorHandler);

  const response = await request(testApp).get('/forzar-error');

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    error: 'Error interno del servidor',
  });

  test('GET /health informa la base de datos como ok cuando responde', async () => {
  const testApp = createApp({ checkDatabase: async () => true });

  const response = await request(testApp).get('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'ok');
});

test('GET /health informa la base de datos con error cuando no responde', async () => {
  const testApp = createApp({ checkDatabase: async () => false });

  const response = await request(testApp).get('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'error');
});

});