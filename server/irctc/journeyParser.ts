import type { JourneyRequest, StationRequest } from './types.js';

const months: Record<string, number> = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };

export function parseJourneyRequest(task: string, now = new Date()): JourneyRequest | undefined {
  if (!/\b(irctc|train(?:s)?|railway)\b/i.test(task)) return undefined;
  const route = task.match(/(?:between|from)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\s+(?:for|on)\s+|$)/i) ?? task.match(/(?:trains?|train)\s+(.+?)\s+to\s+(.+?)(?:\s+(?:for|on)\s+|$)/i);
  if (!route) return undefined;
  const date = parseDate(task, now);
  if (!date) return undefined;
  return { origin: normalizeStation(route[1].trim(), 'origin'), destination: normalizeStation(route[2].trim(), 'destination'), journeyDate: date };
}

function normalizeStation(raw: string, kind: 'origin' | 'destination'): StationRequest {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (kind === 'origin' && (compact === 'ndls' || /^(new)?delhi$/.test(compact))) return { raw, canonical: 'New Delhi', aliases: ['New Delhi', 'NDLS'] };
  if (kind === 'destination' && (compact === 'svdk' || /katra|vaishnodevi/.test(compact))) return { raw, canonical: 'Shri Mata Vaishno Devi Katra', aliases: ['Shri Mata Vaishno Devi Katra', 'SVDK', 'Katra'] };
  return { raw, canonical: raw, aliases: [raw] };
}

function parseDate(task: string, now: Date): string | undefined {
  if (/\btomorrow\b/i.test(task)) return iso(addDays(now, 1));
  const nextDay = task.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (nextDay) {
    const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(nextDay[1].toLowerCase());
    const delta = ((day - now.getDay() + 7) % 7) || 7;
    return iso(addDays(now, delta));
  }
  const match = task.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)(?:\s+(\d{4}))?\b/i);
  if (!match) return undefined;
  const month = months[match[2].toLowerCase()]; const year = match[3] ? Number(match[3]) : now.getFullYear(); const day = Number(match[1]);
  const parsed = new Date(year, month, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) return undefined;
  return iso(parsed);
}

function addDays(date: Date, days: number): Date { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function iso(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
