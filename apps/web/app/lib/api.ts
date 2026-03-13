const API_BASE = "http://localhost:3001";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;

  const headers: HeadersInit = {
    ...(body !== undefined &&
      !(body instanceof FormData) && {
        "Content-Type": "application/json",
      }),
    ...customHeaders,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...rest,
    headers,
    body:
      body instanceof FormData
        ? (body as BodyInit)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw new Error(
      (error as { message?: string }).message || `API error: ${response.status}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function apiWithKey<T = unknown>(
  apiKey: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return api<T>(path, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
