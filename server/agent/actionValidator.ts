import type { SemanticAction } from '../types.js';

export function validateAction(action: SemanticAction, task: string): void {
  if (action.action === 'navigate' && !action.url) throw new Error('Navigate action requires a URL');
  if (action.action === 'type' && (!action.target || action.value === undefined)) throw new Error('Type action requires target and value');
  if ((action.action === 'select_station' || action.action === 'select_date') && (!action.target || action.value === undefined)) throw new Error(`${action.action} requires target and value`);
  if (action.action === 'click' && !action.target) throw new Error('Click action requires a target');
  if (/\b(do not|don’t|don't)\s+(click\s+)?(submit|send|final submission)\b/i.test(task) && action.action === 'click' && /submit|send|final/i.test(action.target?.description ?? action.target?.text ?? '')) {
    throw new Error('Hard user constraint: form submission is prohibited');
  }
  if (/\b(irctc|train(?:s)?|railway)\b/i.test(task) && /book now|booking|continue|payment|passenger|login|sign in|otp|password/i.test(`${action.target?.description ?? ''} ${action.target?.text ?? ''}`)) {
    throw new Error('Hard IRCTC safety constraint: search-only workflow cannot login, book, or make a payment');
  }
}
