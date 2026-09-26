import { z } from 'zod';
import { type AIProvider, type ProviderHealth, ProviderError, type ProviderErrorCode } from '../types.js';

const responseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable()
      })
    })
  ).min(1)
});

export class OpenRouterProvider implements AIProvider {
  readonly id = 'openrouter' as const;
  readonly name = 'OpenRouter';

  get model(): string {
    return process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash';
  }

  private getApiKey(): string {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderError(
        'API_KEY_MISSING',
        'openrouter',
        'OpenRouter is unavailable. Please check your OpenRouter API key.'
      );
    }
    if (!/^[\x20-\x7E]+$/.test(apiKey)) {
      throw new ProviderError(
        'API_KEY_INVALID',
        'openrouter',
        'OpenRouter API key contains non-ASCII characters.'
      );
    }
    return apiKey;
  }

  private classifyError(status: number, responseText: string): ProviderError {
    let message = responseText.slice(0, 300);
    let code: ProviderErrorCode = 'UNKNOWN';

    try {
      const parsed = JSON.parse(responseText) as {
        error?: { code?: number | string; message?: string };
      };
      if (parsed.error?.message) {
        message = String(parsed.error.message);
      }
    } catch {
      // Keep raw snippet
    }

    if (status === 401) {
      code = 'AUTHENTICATION_FAILED';
    } else if (status === 402) {
      code = 'INSUFFICIENT_CREDITS';
    } else if (status === 429) {
      code = 'RATE_LIMITED';
    } else if (status === 400 || status === 404) {
      code = /model/i.test(message) ? 'MODEL_NOT_FOUND' : 'API_KEY_INVALID';
    } else if (status >= 500 && status < 600) {
      code = 'PROVIDER_UNAVAILABLE';
    }

    return new ProviderError(code, 'openrouter', `OpenRouter error (${code}): ${message}`);
  }

  async generatePlan(prompt: string, _task: string): Promise<string> {
    const apiKey = this.getApiKey();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    let requestBody: string;
    try {
      requestBody = JSON.stringify({
        model: this.model,
        temperature: 0.1,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      });
    } catch (err) {
      clearTimeout(timer);
      throw new ProviderError('INVALID_RESPONSE', 'openrouter', `Failed to serialize prompt: ${err}`);
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
        const text = await response.text();
        throw this.classifyError(response.status, text);
      }

      let rawJson: unknown;
      try {
        rawJson = await response.json();
      } catch {
        throw new ProviderError('INVALID_RESPONSE', 'openrouter', 'OpenRouter returned invalid JSON.');
      }

      const parsed = responseSchema.safeParse(rawJson);
      if (!parsed.success || !parsed.data.choices[0]?.message?.content) {
        throw new ProviderError(
          'INVALID_RESPONSE',
          'openrouter',
          'OpenRouter response format did not match expected structure.'
        );
      }

      return parsed.data.choices[0].message.content;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderError('TIMEOUT', 'openrouter', 'OpenRouter request timed out after 25s.');
      }
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new ProviderError('NETWORK_ERROR', 'openrouter', `Network error contacting OpenRouter: ${error.message}`);
      }
      throw new ProviderError('UNKNOWN', 'openrouter', error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return {
        id: 'openrouter',
        name: this.name,
        model: this.model,
        configured: false,
        healthy: false,
        status: 'API key missing',
        errorCode: 'API_KEY_MISSING',
        error: 'OPENROUTER_API_KEY is not configured in backend environment.'
      };
    }

    if (!/^[\x20-\x7E]+$/.test(apiKey)) {
      return {
        id: 'openrouter',
        name: this.name,
        model: this.model,
        configured: true,
        healthy: false,
        status: 'API key invalid',
        errorCode: 'API_KEY_INVALID',
        error: 'OPENROUTER_API_KEY contains unsafe characters.'
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        const err = this.classifyError(response.status, text);
        return {
          id: 'openrouter',
          name: this.name,
          model: this.model,
          configured: true,
          healthy: false,
          status: 'Error',
          errorCode: err.code,
          error: err.message
        };
      }

      return {
        id: 'openrouter',
        name: this.name,
        model: this.model,
        configured: true,
        healthy: true,
        status: 'Ready'
      };
    } catch (error) {
      let code: ProviderErrorCode = 'NETWORK_ERROR';
      let message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error && error.name === 'AbortError') {
        code = 'TIMEOUT';
        message = 'OpenRouter connectivity test timed out.';
      }
      return {
        id: 'openrouter',
        name: this.name,
        model: this.model,
        configured: true,
        healthy: false,
        status: 'Unreachable',
        errorCode: code,
        error: message
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
