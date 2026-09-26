import { useEffect, useRef, useState, useCallback } from 'react';

export type AIProviderId = 'gemini' | 'openrouter';

export interface ProviderHealth {
  id: AIProviderId;
  name: string;
  model: string;
  configured: boolean;
  healthy: boolean;
  status: string;
  error?: string;
}

interface BrainState {
  activeProvider: AIProviderId;
  automaticFallback: boolean;
  providers: ProviderHealth[];
}

interface BrainSelectorProps {
  /** Called when the user successfully changes the active provider */
  onProviderChange?: (id: AIProviderId, name: string, model: string) => void;
  disabled?: boolean;
}

const PROVIDER_ICONS: Record<AIProviderId, string> = {
  gemini: '✦',
  openrouter: '⟁'
};

const PROVIDER_COLORS: Record<AIProviderId, string> = {
  gemini: '#5865f2',
  openrouter: '#e668a2'
};

export function BrainSelector({ onProviderChange, disabled }: BrainSelectorProps) {
  const [open, setOpen] = useState(false);
  const [brain, setBrain] = useState<BrainState | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/brain/providers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BrainState;
      setBrain(data);
      setError(null);
    } catch {
      setError('Could not load brain info');
    }
  }, []);

  useEffect(() => {
    void load();
    // Poll every 15s to keep health fresh
    const id = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = async (id: AIProviderId) => {
    if (id === brain?.activeProvider) return;
    setError(null);
    try {
      const res = await fetch('/api/brain/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; name?: string; model?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Switch failed');
      await load();
      if (data.name && data.model) onProviderChange?.(id, data.name, data.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch provider');
    }
  };

  const toggleFallback = async () => {
    if (!brain) return;
    const res = await fetch('/api/brain/fallback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !brain.automaticFallback })
    });
    if (res.ok) await load();
  };

  const testProvider = async (id: AIProviderId) => {
    setTesting(id);
    try {
      const res = await fetch(`/api/brain/test/${id}`);
      const data = (await res.json()) as ProviderHealth;
      setBrain((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          providers: prev.providers.map((p) => (p.id === id ? data : p))
        };
      });
    } catch {
      /* ignore */
    } finally {
      setTesting(null);
    }
  };

  const active = brain?.providers.find((p) => p.id === brain.activeProvider);
  const iconColor = active ? PROVIDER_COLORS[active.id] : '#8892b0';

  return (
    <div className="brain-selector" ref={ref}>
      <button
        className={`brain-toggle ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Select AI brain provider"
        id="brain-selector-btn"
      >
        <span className="brain-icon" style={{ color: iconColor }}>🧠</span>
        <span className="brain-label">
          {active ? active.name : 'AI Brain'}
        </span>
        {active && (
          <span className={`brain-dot ${active.healthy ? 'healthy' : 'unhealthy'}`} title={active.status} />
        )}
        <span className="brain-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="brain-panel" role="dialog" aria-label="AI Brain selection panel">
          <div className="brain-panel-header">
            <span>🧠 AGENT BRAIN</span>
          </div>

          {error && <div className="brain-error">{error}</div>}

          <div className="brain-providers">
            {(brain?.providers ?? []).map((provider) => {
              const isActive = provider.id === brain?.activeProvider;
              const isTesting = testing === provider.id;
              return (
                <div
                  key={provider.id}
                  className={`brain-provider-card ${isActive ? 'active' : ''} ${provider.healthy ? 'healthy' : 'unhealthy'}`}
                  onClick={() => !disabled && void select(provider.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && !disabled && void select(provider.id)}
                  id={`brain-provider-${provider.id}`}
                >
                  <div className="bpc-left">
                    <span className="bpc-icon" style={{ color: PROVIDER_COLORS[provider.id] }}>
                      {PROVIDER_ICONS[provider.id]}
                    </span>
                    <div className="bpc-info">
                      <div className="bpc-name">{provider.name}</div>
                      <div className="bpc-model">{provider.model}</div>
                    </div>
                  </div>
                  <div className="bpc-right">
                    <span className={`bpc-badge ${provider.healthy ? 'green' : provider.configured ? 'yellow' : 'red'}`}>
                      {provider.status}
                    </span>
                    <button
                      className="bpc-test"
                      onClick={(e) => { e.stopPropagation(); void testProvider(provider.id); }}
                      disabled={isTesting}
                      title={`Test ${provider.name} connectivity`}
                      id={`brain-test-${provider.id}`}
                    >
                      {isTesting ? <span className="spinner-sm" /> : '⟳'}
                    </button>
                    {isActive && <span className="bpc-active-marker">◉ Active</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="brain-panel-footer">
            <label className="brain-fallback-toggle" htmlFor="brain-fallback-checkbox">
              <input
                id="brain-fallback-checkbox"
                type="checkbox"
                checked={brain?.automaticFallback ?? false}
                onChange={() => void toggleFallback()}
              />
              <span>Allow automatic AI fallback</span>
            </label>
            <span className="brain-footer-note">
              {brain?.automaticFallback
                ? 'If active brain fails, system will try another provider'
                : 'No silent fallback — failures will be reported clearly'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
