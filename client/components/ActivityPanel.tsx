import type { Activity, Plan } from '../types/agent';

const marks: Record<Activity['kind'], string> = { PLAN: '✦', OBSERVE: '◉', ACT: '→', VERIFY: '✓', RECOVER: '↻', COMPLETE: '✓', ERROR: '!' };
export function ActivityPanel({ activities, plan }: { activities: Activity[]; plan?: Plan }) {
  return <aside className="activity-panel"><div className="panel-title"><span>Agent activity</span><small>{plan?.source === 'fallback' ? 'deterministic fallback' : 'live session'}</small></div>
    <div className="stage-meter">{plan?.stages.map((stage) => <i key={stage.id} className={stage.status} title={stage.description} />)}</div>
    <div className="activity-list">{activities.length ? activities.slice().reverse().map((event) => <div className={`activity ${event.kind.toLowerCase()}`} key={event.id}><b>{marks[event.kind]} {event.kind}</b><span>{event.message}</span></div>) : <div className="activity empty"><b>READY</b><span>Browser session connecting…</span></div>}</div>
  </aside>;
}
