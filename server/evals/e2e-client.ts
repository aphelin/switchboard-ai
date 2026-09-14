/** Shared helpers for the end-to-end scripts that run against a live API (test:auth, test:providers). */
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:3001';
/** Keeps the scripts under the API's per-second rate limit. */
const REQUEST_SPACING_MS = 250;

let failures = 0;

export const check = (condition: unknown, message: string): void => {
  if (condition) {
    console.log(`  ok   ${message}`);
  } else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
};

export const failureCount = (): number => failures;

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface HttpResult<T> {
  status: number;
  body: T;
}

/** A tiny HTTP client with its own cookie jar, standing in for one browser. */
export class Client {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly defaultHeaders: Record<string, string> = {}) {}

  async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<HttpResult<T>> {
    await sleep(REQUEST_SPACING_MS);
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Origin: CLIENT_ORIGIN,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(this.cookies.size > 0 && {
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        }),
        ...this.defaultHeaders,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // streaming or plain-text responses stay as text
    }
    return { status: response.status, body: parsed as T };
  }
}
