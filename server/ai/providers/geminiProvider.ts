import { type AIProvider, type ProviderHealth, ProviderError, type ProviderErrorCode } from '../types.js';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly name = 'Google AI Studio';

  get model(): string {
    return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  }

  private getApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderError(
        'API_KEY_MISSING',
        'gemini',
        'Google AI Studio is unavailable. Please check your Gemini API key.'
      );
    }
    if (!/^[\x20-\x7E]+$/.test(apiKey)) {
      throw new ProviderError(
        'API_KEY_INVALID',
        'gemini',
        'Gemini API key contains non-ASCII characters.'
      );
    }
    return apiKey;
  }

  private classifyError(status: number, responseText: string): ProviderError {
    let message = responseText.slice(0, 300);
    let code: ProviderErrorCode = 'UNKNOWN';

    try {
      const parsed = JSON.parse(responseText) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
      if (parsed.error?.status === 'INVALID_ARGUMENT' || /API key not valid/i.test(message)) {
        code = 'API_KEY_INVALID';
      } else if (parsed.error?.status === 'PERMISSION_DENIED' || status === 401 || status === 403) {
        code = 'AUTHENTICATION_FAILED';
      } else if (parsed.error?.status === 'RESOURCE_EXHAUSTED' || status === 429) {
        code = 'RATE_LIMITED';
      } else if (status === 404 || /not found/i.test(message)) {
        code = 'MODEL_NOT_FOUND';
      } else if (status >= 500 && status < 600) {
        code = 'PROVIDER_UNAVAILABLE';
      }
    } catch {
      // Use status code heuristics if non-JSON
      if (status === 401 || status === 403) code = 'AUTHENTICATION_FAILED';
      else if (status === 429) code = 'RATE_LIMITED';
      else if (status === 404) code = 'MODEL_NOT_FOUND';
      else if (status >= 500) code = 'PROVIDER_UNAVAILABLE';
    }

    if (code === 'UNKNOWN') {
      if (status === 400) code = 'API_KEY_INVALID';
      else code = 'PROVIDER_UNAVAILABLE';
    }

    return new ProviderError(code, 'gemini', `Google AI Studio error (${code}): ${message}`);
  }

  async generatePlan(prompt: string, _task: string): Promise<string> {
    const apiKey = this.getApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw this.classifyError(response.status, text);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new ProviderError(
          'INVALID_RESPONSE',
          'gemini',
          'Google AI Studio returned an empty or invalid response.'
        );
      }

      return content;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderError('TIMEOUT', 'gemini', 'Google AI Studio request timed out after 25s.');
      }
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new ProviderError('NETWORK_ERROR', 'gemini', `Network error contacting Google AI Studio: ${error.message}`);
      }
      throw new ProviderError('UNKNOWN', 'gemini', error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return {
        id: 'gemini',
        name: this.name,
        model: this.model,
        configured: false,
        healthy: false,
        status: 'API key missing',
        errorCode: 'API_KEY_MISSING',
        error: 'GEMINI_API_KEY is not configured in backend environment.'
      };
    }

    if (!/^[\x20-\x7E]+$/.test(apiKey)) {
      return {
        id: 'gemini',
        name: this.name,
        model: this.model,
        configured: true,
        healthy: false,
        status: 'API key invalid',
        errorCode: 'API_KEY_INVALID',
        error: 'GEMINI_API_KEY contains unsafe characters.'
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 5 }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        const err = this.classifyError(response.status, text);
        return {
          id: 'gemini',
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
        id: 'gemini',
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
        message = 'Google AI Studio connectivity test timed out.';
      }
      return {
        id: 'gemini',
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
