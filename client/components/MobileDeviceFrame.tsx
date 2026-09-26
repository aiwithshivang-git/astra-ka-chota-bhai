import { useEffect, useState } from 'react';
import type { Cursor, Frame } from '../types/agent';
import { BrowserViewport } from './BrowserViewport';

interface MobileDeviceFrameProps {
  frame?: Frame;
  cursor?: Cursor;
  error?: string;
  address: string;
  onAddressChange: (value: string) => void;
  onNavigate: () => void;
  onBrowserCommand: (command: string) => void;
  busy: boolean;
  isRecordMode: boolean;
}

export function MobileDeviceFrame({
  frame,
  cursor,
  error,
  address,
  onAddressChange,
  onNavigate,
  onBrowserCommand,
  busy,
  isRecordMode
}: MobileDeviceFrameProps) {
  const [dimensions, setDimensions] = useState({ width: 390, height: 844 });

  useEffect(() => {
    const calculateDimensions = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      
      // Calculate available height based on presentation mode
      // In Record Mode: full vertical height minus minimal margins
      // In Normal Mode: space within the browser container
      const verticalMargin = isRecordMode ? 60 : 210;
      const maxAvailableHeight = Math.max(450, vh - verticalMargin);
      
      // Target sensible upper bound for standard monitors and 4K
      const maxScreenHeight = isRecordMode ? 900 : 720;
      const targetHeight = Math.min(maxAvailableHeight, maxScreenHeight);
      
      // Fixed 390 / 844 mobile aspect ratio (never stretch)
      const ratio = 390 / 844;
      let targetWidth = targetHeight * ratio;

      // Ensure it fits horizontally on smaller screens
      const maxAvailableWidth = Math.max(300, vw - (isRecordMode ? 40 : 120));
      if (targetWidth > maxAvailableWidth) {
        targetWidth = maxAvailableWidth;
      }
      const finalHeight = targetWidth / ratio;

      setDimensions({
        width: Math.round(targetWidth),
        height: Math.round(finalHeight)
      });
    };

    calculateDimensions();
    window.addEventListener('resize', calculateDimensions);
    return () => window.removeEventListener('resize', calculateDimensions);
  }, [isRecordMode]);

  return (
    <div
      className={`mobile-device-wrapper ${isRecordMode ? 'record-mode' : ''}`}
      style={{
        width: `${dimensions.width + 24}px`, // Bezel padding
        height: `${dimensions.height + 68}px` // Bezel + hardware elements
      }}
    >
      {/* Outer smartphone chassis */}
      <div className="mobile-chassis">
        {/* Subtle hardware side buttons */}
        <div className="chassis-button button-volume-up" />
        <div className="chassis-button button-volume-down" />
        <div className="chassis-button button-power" />

        {/* Inner screen glass container */}
        <div className="mobile-screen-bezel">
          {/* Dynamic Island / Minimal speaker element */}
          <div className="mobile-island">
            <div className="island-lens" />
            <div className="island-speaker" />
          </div>

          {/* Compact Mobile Browser Bar */}
          <div className="mobile-browser-toolbar">
            <div className="mobile-nav-buttons">
              <button
                type="button"
                onClick={() => onBrowserCommand('back')}
                disabled={busy}
                aria-label="Back"
                title="Back"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => onBrowserCommand('forward')}
                disabled={busy}
                aria-label="Forward"
                title="Forward"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => onBrowserCommand('reload')}
                disabled={busy}
                aria-label="Reload"
                title="Reload"
              >
                ↻
              </button>
            </div>

            <form
              className="mobile-address-bar"
              onSubmit={(e) => {
                e.preventDefault();
                onNavigate();
              }}
            >
              <span className="mobile-lock-icon" title="Secure connection">🔒</span>
              <input
                type="text"
                value={address}
                onChange={(e) => onAddressChange(e.target.value)}
                disabled={busy}
                placeholder="https://…"
                aria-label="Mobile browser address bar"
              />
            </form>
          </div>

          {/* Browser live viewport (exact 390x844 Playwright stream) */}
          <div
            className="mobile-viewport-container"
            style={{
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`
            }}
          >
            <BrowserViewport
              frame={frame}
              cursor={cursor}
              error={error}
              mode="mobile"
              className="mobile-screen-inner"
            />
          </div>

          {/* Bottom home indicator pill */}
          <div className="mobile-home-indicator">
            <div className="home-bar" />
          </div>
        </div>
      </div>
    </div>
  );
}
