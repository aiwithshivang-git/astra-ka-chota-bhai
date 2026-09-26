import { type AIProvider, type AIProviderId, type ProviderHealth, ProviderError } from './types.js';

export class AIProviderManager {
  private providers = new Map<AIProviderId, AIProvider>();
  private activeProviderId: AIProviderId;
  private automaticFallback = false;

  constructor() {
    const envProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
    if (envProvider === 'openrouter') {
      this.activeProviderId = 'openrouter';
    } else {
      this.activeProviderId = 'gemini';
    }
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getProvider(id: AIProviderId): AIProvider | undefined {
    return this.providers.get(id);
  }

  getActiveProviderId(): AIProviderId {
    return this.activeProviderId;
  }

  setActiveProvider(id: AIProviderId): void {
    if (!this.providers.has(id)) {
      throw new ProviderError(
        'UNKNOWN',
        id,
        `Cannot select unknown provider: "${id}". Allowed providers: ${Array.from(this.providers.keys()).join(', ')}`
      );
    }
    this.activeProviderId = id;
  }

  getAutomaticFallback(): boolean {
    return this.automaticFallback;
  }

  setAutomaticFallback(enabled: boolean): void {
    this.automaticFallback = Boolean(enabled);
  }

  getActiveProvider(): AIProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) {
      throw new ProviderError(
        'PROVIDER_UNAVAILABLE',
        this.activeProviderId,
        `Active provider "${this.activeProviderId}" is not registered.`
      );
    }
    return provider;
  }

  getFallbackProvider(excludeId: AIProviderId): AIProvider | undefined {
    if (!this.automaticFallback) return undefined;
    for (const [id, provider] of this.providers) {
      if (id !== excludeId) return provider;
    }
    return undefined;
  }

  async getProviderHealthList(): Promise<ProviderHealth[]> {
    const list: ProviderHealth[] = [];
    for (const provider of this.providers.values()) {
      list.push(await provider.healthCheck());
    }
    return list;
  }

  async healthCheck(id?: AIProviderId): Promise<ProviderHealth> {
    const target = id ? this.getProvider(id) : this.getActiveProvider();
    if (!target) {
      return {
        id: id || this.activeProviderId,
        name: id || this.activeProviderId,
        model: 'unknown',
        configured: false,
        healthy: false,
        status: 'Unregistered',
        error: `Provider "${id}" is not registered.`
      };
    }
    return target.healthCheck();
  }
}

// Export a singleton instance initialized and ready
export const aiProviderManager = new AIProviderManager();
