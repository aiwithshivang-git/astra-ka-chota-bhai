import type { DisplayMode } from '../types/agent';

interface DisplayModeSelectorProps {
  mode: DisplayMode;
  onModeChange: (mode: DisplayMode) => void;
  disabled?: boolean;
}

export function DisplayModeSelector({
  mode,
  onModeChange,
  disabled = false
}: DisplayModeSelectorProps) {
  return (
    <div className="display-mode-selector" role="group" aria-label="Browser Display Mode">
      <button
        type="button"
        className={`mode-btn ${mode === 'desktop' ? 'active' : ''}`}
        onClick={() => onModeChange('desktop')}
        disabled={disabled}
        title="Desktop Mode (1440×900 viewport)"
      >
        <span className="mode-icon">💻</span>
        <span className="mode-label">Desktop</span>
      </button>

      <button
        type="button"
        className={`mode-btn ${mode === 'mobile' ? 'active' : ''}`}
        onClick={() => onModeChange('mobile')}
        disabled={disabled}
        title="Mobile Agent Mode (390×844 viewport)"
      >
        <span className="mode-icon">📱</span>
        <span className="mode-label">Mobile</span>
        <span className="mobile-badge">390×844</span>
      </button>
    </div>
  );
}
