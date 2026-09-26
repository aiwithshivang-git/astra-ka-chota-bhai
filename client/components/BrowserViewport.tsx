import { useEffect, useRef, useState } from 'react';
import type { Cursor, DisplayMode, Frame } from '../types/agent';
import { AgentCursor } from './AgentCursor';

interface BrowserViewportProps {
  frame?: Frame;
  cursor?: Cursor;
  error?: string;
  mode?: DisplayMode;
  className?: string;
}

export function BrowserViewport({
  frame,
  cursor,
  error,
  mode = 'desktop',
  className = ''
}: BrowserViewportProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const defaultWidth = mode === 'mobile' ? 390 : 1440;
  const defaultHeight = mode === 'mobile' ? 844 : 900;
  const frameWidth = frame?.width || defaultWidth;
  const frameHeight = frame?.height || defaultHeight;

  const scaleX = box.width / frameWidth;
  const scaleY = box.height / frameHeight;

  return (
    <div className={`browser-screen ${mode} ${className}`.trim()} ref={ref}>
      {frame ? (
        <img
          src={`data:image/jpeg;base64,${frame.image}`}
          alt="Live Playwright browser session"
          draggable={false}
        />
      ) : (
        <div className="browser-loading">
          <div className="orb" />
          <p>Connecting browser session…</p>
        </div>
      )}
      <AgentCursor cursor={cursor} scaleX={scaleX} scaleY={scaleY} />
      {error && <div className="browser-error">{error}</div>}
    </div>
  );
}
