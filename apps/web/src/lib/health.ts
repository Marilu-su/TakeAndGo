export type HealthResponse = {
    status: string;
    database?: string;
};

const TIMEOUT_MS = 5000;

export async function getHealth(): Promise<HealthResponse> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!baseUrl) {
        throw new Error("La variable NEXT_PUBLIC_API_URL no está configurada");
    }

    const url = `${baseUrl.replace(/\/$/, "")}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
    });

    if (!response.ok) {
        throw new Error(`El backend respondió con código ${response.status}`);
    }

    return (await response.json()) as HealthResponse;
    } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("El backend no respondió a tiempo");
    }
    if (error instanceof TypeError) {
        throw new Error("No se pudo conectar con el backend");
    }
    throw error;
    } finally {
        clearTimeout(timeout);
    }
}