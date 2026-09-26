import { useEffect, useState } from 'react';
import { ActivityPanel } from './components/ActivityPanel';
import { AgentRadar } from './components/AgentRadar';
import { BrowserViewport } from './components/BrowserViewport';
import { BrainSelector } from './components/BrainSelector';
import { DisplayModeSelector } from './components/DisplayModeSelector';
import { MobileDeviceFrame } from './components/MobileDeviceFrame';
import { TrainResultsPanel } from './components/TrainResultsPanel';
import { useBrowserSocket } from './hooks/useBrowserSocket';
import type { DisplayMode } from './types/agent';
import './style.css';

const example = 'Go to YouTube, search for "CarryMinati", open the first actual video result, and start playing it.';

export default function App() {
  const socket = useBrowserSocket();
  const [task, setTask] = useState(example);
  const [address, setAddress] = useState('');
  const [focus, setFocus] = useState(false);
  const [activeBrain, setActiveBrain] = useState<string | null>(null);
  const busy = socket.status === 'running' || socket.status === 'planning';
  const mode = socket.displayMode;

  useEffect(() => {
    setAddress(socket.url);
  }, [socket.url]);

  // Keyboard shortcut handler: F toggles Record Mode, ESC exits
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if (event.key === 'Escape') {
        setFocus(false);
      } else if (
        (event.key === 'f' || event.key === 'F') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isInputFocused
      ) {
        event.preventDefault();
        setFocus((prev) => !prev);
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !busy) {
        event.preventDefault();
        void run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, task]);

  const call = async (path: string, body?: object) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = (await response.json()) as { error?: string; warning?: string; plan?: typeof socket.plan };
    if (!response.ok) throw new Error(data.error ?? 'Request failed');
    return data;
  };

  const handleModeChange = async (newMode: DisplayMode) => {
    if (newMode === mode || busy) return;
    try {
      socket.setError(undefined);
      socket.setDisplayMode(newMode);
      await call('/api/browser/mode', { mode: newMode });
    } catch (err) {
      socket.setError(err instanceof Error ? err.message : 'Failed to switch display mode');
    }
  };

  const run = async () => {
    try {
      socket.setError(undefined);
      socket.setStatus('planning');
      socket.setRadarStatus('PLANNING');
      socket.setActivities([]);
      socket.setTrainResults(undefined);
      const data = await call('/api/task', { task });
      if (data.plan) socket.setPlan(data.plan);
      if (data.warning) socket.setError(`AI brain used deterministic fallback: ${data.warning}`);
    } catch (error) {
      socket.setStatus('failed');
      socket.setRadarStatus('ERROR');
      socket.setError(error instanceof Error ? error.message : 'Unable to start task');
    }
  };

  const navigate = async () => {
    try {
      socket.setError(undefined);
      await call('/api/navigate', { url: address });
    } catch (error) {
      socket.setError(error instanceof Error ? error.message : 'Navigation failed');
    }
  };

  const browser = async (command: string) => {
    try {
      await call(`/api/browser/${command}`);
    } catch (error) {
      socket.setError(error instanceof Error ? error.message : 'Browser action failed');
    }
  };

  return (
    <main className={focus ? 'app focus' : 'app'}>
      {/* Floating Record Mode HUD Banner */}
      {focus && (
        <div className="record-mode-hud">
          <div className="rec-indicator">
            <span className="rec-dot" />
            <b>RECORD MODE</b>
            <span className="rec-mode-badge">{mode.toUpperCase()}</span>
          </div>
          <div className="rec-actions">
            <DisplayModeSelector
              mode={mode}
              onModeChange={(m) => void handleModeChange(m)}
              disabled={busy}
            />
            <button
              type="button"
              className="exit-record-btn"
              onClick={() => setFocus(false)}
              title="Exit Record Mode (ESC)"
            >
              Exit <kbd>ESC</kbd>
            </button>
          </div>
        </div>
      )}

      {!focus && (
        <header>
          <div className="brand">
            <span className="bot-logo" role="img" aria-label="A goofy rocket robot">
              <i />
              <b>•ᴗ•</b>
              <em>✦</em>
            </span>
            <div>
              <h1>
                Astra ka <em>Chota Bhai</em>
              </h1>
              <p>See. Think. Act. Verify. (with extra masala)</p>
            </div>
          </div>
          <div className="header-right">
            <DisplayModeSelector
              mode={mode}
              onModeChange={(m) => void handleModeChange(m)}
              disabled={busy}
            />
            <BrainSelector
              disabled={busy}
              onProviderChange={(_id, name, model) => setActiveBrain(`${name} — ${model}`)}
            />
            {activeBrain && (
              <span className="active-brain-label" title="Currently selected AI brain">
                {activeBrain}
              </span>
            )}
            <div className={`connection ${busy ? 'working' : socket.status}`}>
              <i />
              {busy ? 'Agent working' : socket.status === 'completed' ? 'Verified' : 'Controlled browser'}
            </div>
          </div>
        </header>
      )}

      {!focus && (
        <section className="task-bar">
          <div className="prompt-mark">✦</div>
          <input
            value={task}
            onChange={(event) => setTask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) void run();
            }}
            aria-label="Browser agent task"
          />
          <kbd>Ctrl ↵</kbd>
          <button className="run" onClick={() => void run()} disabled={busy || !task.trim()}>
            {busy ? (
              <>
                <span className="spinner" /> Running
              </>
            ) : (
              <>
                Run task <span>↗</span>
              </>
            )}
          </button>
        </section>
      )}

      {/* Main Browser Container */}
      <section className={`browser-shell ${mode}-mode ${focus ? 'in-focus' : ''}`}>
        {/* Desktop Viewport Shell */}
        {mode === 'desktop' ? (
          <>
            <div className="toolbar">
              <div className="nav-actions">
                <button onClick={() => void browser('back')} aria-label="Back" disabled={busy}>
                  ←
                </button>
                <button onClick={() => void browser('forward')} aria-label="Forward" disabled={busy}>
                  →
                </button>
                <button onClick={() => void browser('reload')} aria-label="Reload" disabled={busy}>
                  ↻
                </button>
              </div>

              <form
                className="address"
                onSubmit={(event) => {
                  event.preventDefault();
                  void navigate();
                }}
              >
                <span>⌁</span>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  aria-label="Address bar"
                  disabled={busy}
                />
              </form>

              <button
                className="focus-button"
                onClick={() => setFocus((value) => !value)}
                aria-label={focus ? 'Exit Record Mode (ESC)' : 'Enter Record Mode (F)'}
                title={focus ? 'Exit Record Mode (ESC)' : 'Enter Record Mode (Press F)'}
              >
                {focus ? '⊡' : '⛶ Record (F)'}
              </button>
            </div>

            <BrowserViewport
              frame={socket.frame}
              cursor={socket.cursor}
              error={socket.error}
              mode="desktop"
            />
          </>
        ) : (
          /* Mobile Viewport Shell: rendered inside polished smartphone-style frame */
          <div className="mobile-shell-stage">
            {!focus && (
              <div className="mobile-stage-topbar">
                <span className="mobile-stage-label">
                  📱 Mobile Agent Viewport <b>390 × 844</b>
                </span>
                <button
                  type="button"
                  className="mobile-record-toggle-btn"
                  onClick={() => setFocus(true)}
                  title="Focus / Record Mode for Reels (Press F)"
                >
                  ⛶ Record Mode (F)
                </button>
              </div>
            )}

            <MobileDeviceFrame
              frame={socket.frame}
              cursor={socket.cursor}
              error={socket.error}
              address={address}
              onAddressChange={setAddress}
              onNavigate={() => void navigate()}
              onBrowserCommand={(cmd) => void browser(cmd)}
              busy={busy}
              isRecordMode={focus}
            />
          </div>
        )}

        {/* Real-time Agent Radar HUD (always visible, floating unobtrusively) */}
        <AgentRadar
          fps={socket.fps}
          streamSpeed={socket.streamSpeed}
          load={socket.telemetry.cpu}
          status={socket.radarStatus}
        />

        {/* Agent Activity Timeline Panel */}
        <ActivityPanel activities={socket.activities} plan={socket.plan} />
      </section>

      {!focus && <TrainResultsPanel result={socket.trainResults} />}
      {!focus && (
        <footer>
          <span>One Chromium session</span>
          <i />
          <span>Playwright controlled</span>
          <i />
          <span>Browser state is verified before completion</span>
          <i />
          <span>Press <kbd>F</kbd> for Record Mode</span>
        </footer>
      )}
    </main>
  );
}
