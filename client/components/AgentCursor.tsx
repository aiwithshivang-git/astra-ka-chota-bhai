import type { Cursor } from '../types/agent';

export function AgentCursor({ cursor, scaleX, scaleY }: { cursor?: Cursor; scaleX: number; scaleY: number }) {
  if (!cursor) return null;
  const left = cursor.x * scaleX; const top = cursor.y * scaleY;
  const target = cursor.target;
  return <>
    {target && <div className="target-box" style={{ left: target.x * scaleX, top: target.y * scaleY, width: target.width * scaleX, height: target.height * scaleY }}><span>AI target</span></div>}
    <div className="agent-cursor" style={{ left, top }}><i /><b>AI</b><em /></div>
  </>;
}
