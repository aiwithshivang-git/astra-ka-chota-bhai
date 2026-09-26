import type { TrainSearchResult } from '../types/agent';

const dateLabel = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T00:00:00`));
export function TrainResultsPanel({ result }: { result?: TrainSearchResult }) {
  if (!result) return null;
  return <section className="train-results-panel"><div className="train-results-head"><div><span>🚆 Train search complete</span><p>{result.route.from.name} → {result.route.to.name} · {dateLabel(result.journeyDate)}</p></div><b>{result.trains.length} found</b></div>
    <div className="train-results-list">{result.trains.length ? result.trains.map((train) => <article key={train.number} className="train-row"><div className="train-name"><b>{train.number}</b><span>{train.name}</span></div><div className="train-times"><span>{train.departure} → {train.arrival}</span><small>{train.duration}</small></div><div className="class-statuses">{train.classes.map((item, index) => <span key={`${train.number}-${item.className}-${index}`} className={item.status}><b>{item.className}</b> {item.availability}</span>)}</div></article>) : <p className="no-trains">No train results were displayed for the requested journey.</p>}</div>
    <p className="result-source">Read from the live IRCTC browser page · Search only, no booking action was taken.</p>
  </section>;
}
