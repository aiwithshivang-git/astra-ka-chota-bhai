import type { ActionName, SemanticAction } from '../types.js';

const allowed = new Set<ActionName>(['click', 'type', 'select', 'select_station', 'select_date', 'extract_trains', 'scroll', 'navigate', 'back', 'forward', 'reload', 'wait', 'read', 'download', 'finish']);

export function normalizeAction(input: SemanticAction): SemanticAction {
  const action = String(input.action).toLowerCase() as ActionName;
  if (!allowed.has(action)) throw new Error(`Unknown action: ${String(input.action)}`);
  const delta = Number(input.deltaY);
  return {
    ...input,
    action,
    value: input.value === undefined ? undefined : String(input.value),
    url: input.url?.trim(),
    deltaY: action === 'scroll' ? (Number.isFinite(delta) ? Math.max(-2000, Math.min(2000, delta)) : 500) : undefined,
    target: input.target ? { ...input.target, position: input.target.position && Number.isFinite(Number(input.target.position)) ? Math.max(1, Math.floor(Number(input.target.position))) : undefined } : undefined
  };
}
