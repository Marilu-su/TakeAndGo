
const API_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestOptions = Omit<RequestInit, "signal"> & {
  token?: string;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new ApiError(
      "La variable NEXT_PUBLIC_API_URL no está configurada"
    );
  }

  const { token, headers: inputHeaders, ...requestOptions } = options;
  const headers = new Headers(inputHeaders);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    typeof requestOptions.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    API_TIMEOUT_MS
  );

  const url = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

  try {
    const response = await fetch(url, {
      ...requestOptions,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(
        `El backend respondió con código ${response.status}`,
        response.status
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("El backend no respondió a tiempo");
    }

    if (error instanceof TypeError) {
      throw new ApiError("No se pudo conectar con el backend");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
