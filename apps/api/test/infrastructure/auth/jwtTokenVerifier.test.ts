import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';

import { JwtTokenVerifier } from '../../../src/infrastructure/auth/jwtTokenVerifier';
import { extractBearerToken } from '../../../src/shared/http/bearerToken';

const ISSUER = 'https://auth.takeandgo.test';
const KEY_ID = 'clave-de-prueba';

async function setup() {
    const { publicKey, privateKey } = await generateKeyPair('EdDSA');
    const otherPair = await generateKeyPair('EdDSA');

    const publicJwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'EdDSA' };
    const verifier = new JwtTokenVerifier(createLocalJWKSet({ keys: [publicJwk] }), ISSUER, ISSUER);

    function sign(
        claims: Record<string, unknown>,
        options: { key?: KeyLike; issuer?: string; expiresIn?: string } = {},
    ) {
        return new SignJWT(claims)
        .setProtectedHeader({ alg: 'EdDSA', kid: KEY_ID })
        .setIssuedAt()
        .setIssuer(options.issuer ?? ISSUER)
        .setAudience(ISSUER)
        .setExpirationTime(options.expiresIn ?? '15m')
        .sign(options.key ?? privateKey);
    }

    return { verifier, sign, otherPrivateKey: otherPair.privateKey };
}

// Verificación del token

test('un token válido devuelve el id y el email del usuario', async () => {
    const { verifier, sign } = await setup();
    const token = await sign({ sub: 'user-1', email: 'cliente@takeandgo.test' });

    const identity = await verifier.verify(token);

    assert.deepEqual(identity, { authUserId: 'user-1', email: 'cliente@takeandgo.test' });
});

test('un token vencido se rechaza', async () => {
    const { verifier, sign } = await setup();
    const token = await sign({ sub: 'user-1' }, { expiresIn: '-1m' });

    assert.equal(await verifier.verify(token), null);
});

test('un token firmado con otra clave se rechaza', async () => {
    const { verifier, sign, otherPrivateKey } = await setup();
    const token = await sign({ sub: 'user-1' }, { key: otherPrivateKey });

    assert.equal(await verifier.verify(token), null);
});

test('un token de otro emisor se rechaza', async () => {
    const { verifier, sign } = await setup();
    const token = await sign({ sub: 'user-1' }, { issuer: 'https://otro-proyecto.test' });

    assert.equal(await verifier.verify(token), null);
});

test('un token sin id de usuario se rechaza', async () => {
    const { verifier, sign } = await setup();
    const token = await sign({ email: 'cliente@takeandgo.test' });

    assert.equal(await verifier.verify(token), null);
});

test('un texto que no es un token se rechaza', async () => {
    const { verifier } = await setup();

    assert.equal(await verifier.verify('esto-no-es-un-jwt'), null);
});

// Lectura del header Authorization

test('extrae el token de un header Bearer', () => {
    assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
    assert.equal(extractBearerToken('bearer abc.def.ghi'), 'abc.def.ghi');
});

test('ignora headers ausentes o con otro formato', () => {
    for (const header of [undefined, '', 'Basic dXNlcjpwYXNz', 'Bearer ', 'abc.def.ghi']) {
        assert.equal(extractBearerToken(header), null);
    }
});