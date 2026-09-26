export type AIProviderId = 'gemini' | 'openrouter';

export type ProviderErrorCode =
  | 'API_KEY_MISSING'
  | 'API_KEY_INVALID'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_CREDITS'
  | 'MODEL_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNKNOWN';

export interface ProviderHealth {
  id: AIProviderId;
  name: string;
  model: string;
  configured: boolean;
  healthy: boolean;
  status: string;
  error?: string;
  errorCode?: ProviderErrorCode;
}

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    public readonly provider: AIProviderId,
    message: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly name: string;
  readonly model: string;
  generatePlan(prompt: string, task: string): Promise<string>;
  healthCheck(): Promise<ProviderHealth>;
}
