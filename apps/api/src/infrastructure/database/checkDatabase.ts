import { getPrisma } from './prisma';

const TIMEOUT_MS = 3000;

export async function checkDatabaseConnection(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;

    try {
        const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
            () => reject(new Error('Tiempo de espera agotado')),
            TIMEOUT_MS,
        );
    });

    await Promise.race([getPrisma().$queryRaw`SELECT 1`, timeout]);

    return true;
    } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`No se pudo verificar la base de datos: ${message}`);

    return false;
    } finally {
        clearTimeout(timer);
    }
}