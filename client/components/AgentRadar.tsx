import { useState } from 'react';
import type { AgentRadarStatus } from '../types/agent';

interface AgentRadarProps {
  fps: number;
  streamSpeed: string;
  load: number;
  status: AgentRadarStatus;
}

const statusColors: Record<AgentRadarStatus, string> = {
  IDLE: '#8ba2be',
  PLANNING: '#a78bfa',
  OBSERVING: '#38bdf8',
  ACTING: '#60a5fa',
  VERIFYING: '#facc15',
  RECOVERING: '#fb923c',
  COMPLETED: '#4ade80',
  ERROR: '#f87171'
};

export function AgentRadar({ fps, streamSpeed, load, status }: AgentRadarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const activeColor = statusColors[status] || '#4ade80';

  return (
    <aside className={`agent-radar-hud ${collapsed ? 'collapsed' : ''}`} aria-label="Agent Radar Developer Telemetry">
      <div className="radar-hud-header">
        <div className="radar-hud-title" onClick={() => setCollapsed(!collapsed)}>
          <span className="radar-dot" style={{ backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}` }} />
          <strong>AGENT RADAR</strong>
        </div>
        <button
          type="button"
          className="radar-hud-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand Agent Radar' : 'Minimize Agent Radar'}
          title={collapsed ? 'Expand Agent Radar' : 'Minimize Agent Radar'}
        >
          {collapsed ? '+' : '–'}
        </button>
      </div>

      {!collapsed && (
        <div className="radar-hud-body">
          <div className="radar-metric">
            <span className="metric-label">FPS</span>
            <span className="metric-value">{fps > 0 ? fps.toFixed(1) : '0.0'}</span>
          </div>
          <div className="radar-metric">
            <span className="metric-label">STREAM</span>
            <span className="metric-value">{streamSpeed}</span>
          </div>
          <div className="radar-metric">
            <span className="metric-label">LOAD</span>
            <span className="metric-value">{Math.round(load)}%</span>
          </div>
          <div className="radar-metric status-metric">
            <span className="metric-label">STATUS</span>
            <span className="metric-value status-badge" style={{ color: activeColor, borderColor: `${activeColor}40` }}>
              {status}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
