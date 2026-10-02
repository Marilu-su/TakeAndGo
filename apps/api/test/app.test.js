
const express = require('express');
const errorHandler = require('../src/middlewares/errorHandler');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');

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
        error: 'Ruta no encontrada'
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
        error: 'Error interno del servidor'
    });
});