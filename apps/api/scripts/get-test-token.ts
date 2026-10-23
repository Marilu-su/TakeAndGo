import 'dotenv/config';

const USAGE = `Uso (desde apps/api):
    npx tsx scripts/get-test-token.ts <email> <contraseña>            inicia sesión
    npx tsx scripts/get-test-token.ts <email> <contraseña> <nombre>   crea la cuenta e inicia sesión`;

async function main() {
    const [email, password, name] = process.argv.slice(2);
    const authUrl = process.env.NEON_AUTH_URL?.replace(/\/$/, '');

    if (!email || !password) {
        console.error(USAGE);
        process.exitCode = 1;
        return;
    }

    if (!authUrl) {
        console.error('Falta la variable NEON_AUTH_URL en el archivo .env');
        process.exitCode = 1;
        return;
    }

    const headers = { 'content-type': 'application/json', origin: 'http://localhost:3000' };

    if (name) {
        const signUp = await fetch(`${authUrl}/sign-up/email`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password, name }),
        });

        if (!signUp.ok) {
        console.error(`No se pudo crear la cuenta (${signUp.status}): ${await signUp.text()}`);
        process.exitCode = 1;
        return;
        }
    }

    const signIn = await fetch(`${authUrl}/sign-in/email`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password }),
    });

    if (!signIn.ok) {
        console.error(`No se pudo iniciar sesión (${signIn.status}): ${await signIn.text()}`);
        process.exitCode = 1;
        return;
    }

    const cookies = signIn.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ');

    const tokenResponse = await fetch(`${authUrl}/token`, { headers: { cookie: cookies } });
    const { token } = (await tokenResponse.json()) as { token?: string };

    if (!token) {
        console.error('No se pudo obtener el token.');
        process.exitCode = 1;
        return;
    }

    console.log(token);
}

main().catch((error: unknown) => {
    console.error('Error:', error);
    process.exitCode = 1;
});