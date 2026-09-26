import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Ensure .env is loaded if not already initialized
if (!process.env.OPENROUTER_API_KEY) {
  dotenv.config();
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
  } catch {
    // Ignore fallback directory resolution errors
  }
}

const responseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable()
      })
    })
  ).min(1)
});

/**
 * Perform safe diagnostic logging without leaking the actual key.
 */
export function logOpenRouterDiagnostics(): void {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  console.log('[OpenRouter] configured:', Boolean(apiKey));
  console.log('[OpenRouter] key length:', apiKey?.length ?? 0);
  console.log(
    '[OpenRouter] contains non-ASCII:',
    apiKey ? /[^\x00-\x7F]/.test(apiKey) : false
  );
}

/**
 * Validate and retrieve the API key.
 * Throws clean, classified errors if missing or containing invalid characters.
 */
export function getValidatedApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('[OpenRouter] API key missing');
  }
  if (!/^[\x20-\x7E]+$/.test(apiKey)) {
    throw new Error('[OpenRouter] API key invalid: contains non-ASCII or unsafe HTTP header characters');
  }
  return apiKey;
}

/**
 * Classify HTTP response errors into explicit, actionable categories.
 */
export function formatOpenRouterError(status: number, detailText: string): Error {
  let cleanDetail = detailText.slice(0, 300);
  try {
    const parsed = JSON.parse(detailText);
    if (parsed.error?.message) {
      cleanDetail = String(parsed.error.message);
    }
  } catch {
    // Keep raw snippet if not JSON
  }

  if (status === 401) {
    return new Error(`[OpenRouter] Authentication failed (401): ${cleanDetail || 'Invalid API key or unauthorized'}`);
  }
  if (status === 402) {
    return new Error(`[OpenRouter] Insufficient credits (402): ${cleanDetail || 'Account or key limit reached'}`);
  }
  if (status === 429) {
    return new Error(`[OpenRouter] Rate limited (429): ${cleanDetail || 'Too many requests'}`);
  }
  if (status === 400 || status === 404) {
    return new Error(`[OpenRouter] Invalid model or request (${status}): ${cleanDetail || 'Check requested model name'}`);
  }
  if (status >= 500 && status < 600) {
    return new Error(`[OpenRouter] Server error (${status}): ${cleanDetail || 'OpenRouter service is temporarily unavailable'}`);
  }
  return new Error(`[OpenRouter] HTTP error (${status}): ${cleanDetail || 'Unexpected response'}`);
}

/**
 * Safe startup connectivity test that does NOT expose the API key or crash the server.
 */
export async function testOpenRouterConnectivity(): Promise<{ ok: boolean; model: string; error?: string }> {
  const model = process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash';
  let apiKey: string;
  try {
    apiKey = getValidatedApiKey();
  } catch (err) {
    return { ok: false, model, error: err instanceof Error ? err.message : String(err) };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      const classified = formatOpenRouterError(response.status, text);
      return { ok: false, model, error: classified.message };
    }

    return { ok: true, model };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { ok: false, model, error: '[OpenRouter] Timeout: connectivity test timed out' };
      }
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return { ok: false, model, error: `[OpenRouter] Network error: ${error.message}` };
      }
    }
    return { ok: false, model, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Execute an LLM query against OpenRouter with strict validation and error classification.
 */
export async function askOpenRouter(prompt: string): Promise<string> {
  const apiKey = getValidatedApiKey();
  const model = process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  let requestBody: string;
  try {
    requestBody = JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
  } catch (serializationErr) {
    clearTimeout(timer);
    throw new Error(`[OpenRouter] Request serialization error: ${serializationErr instanceof Error ? serializationErr.message : String(serializationErr)}`);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: requestBody,
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw formatOpenRouterError(response.status, detail);
    }

    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch {
      throw new Error('[OpenRouter] Response format error: received invalid JSON from upstream');
    }

    const parsed = responseSchema.safeParse(rawJson);
    if (!parsed.success || !parsed.data.choices[0]?.message?.content) {
      throw new Error('[OpenRouter] Response validation error: received invalid completion structure');
    }

    return parsed.data.choices[0].message.content;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('[OpenRouter] Timeout: request took longer than 25s');
      }
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`[OpenRouter] Network error: ${error.message}`);
      }
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
