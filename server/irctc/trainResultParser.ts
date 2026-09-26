import type { Page } from 'playwright';
import type { AvailabilityStatus, TrainClassAvailability, TrainResult, TrainSearchResult } from '../types.js';
import type { JourneyRequest, TrainSearchStore } from './types.js';

export async function waitForTrainResults(page: Page, timeout = 30_000): Promise<void> {
  const cards = page.locator('app-train-listing, app-train-list, .train-list, .train-card, [class*="train-list"], [class*="train-card"], [class*="train-detail"]');
  const noResults = page.getByText(/no trains?(?: found| available)?|no direct trains?/i).first();
  await Promise.race([
    cards.filter({ hasText: /\b\d{5}\b/ }).first().waitFor({ state: 'visible', timeout }),
    noResults.waitFor({ state: 'visible', timeout })
  ]);
}

export async function parseTrainResults(page: Page, request: JourneyRequest, store: TrainSearchStore): Promise<TrainSearchResult> {
  await waitForTrainResults(page);
  const cards = page.locator('app-train-listing, app-train-list, .train-list > *, .train-card, [class*="train-card"], [class*="train-detail"]');
  const total = await cards.count(); const trains: TrainResult[] = [];
  for (let index = 0; index < Math.min(total, 80); index += 1) {
    const text = (await cards.nth(index).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!/\b\d{5}\b/.test(text)) continue;
    const train = parseCard(text); if (train && !trains.some((item) => item.number === train.number)) trains.push(train);
  }
  const bodyText = (await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')).replace(/\s+/g, ' ');
  if (!trains.length && !/no trains?(?: found| available)?|no direct trains?/i.test(bodyText)) throw new Error('RESULT_PARSE_FAILED: train result containers were visible but no train number could be read');
  return { route: { from: { name: store.from?.name ?? request.origin.canonical, code: store.from?.code }, to: { name: store.to?.name ?? request.destination.canonical, code: store.to?.code } }, journeyDate: store.date ?? request.journeyDate, trains, sourceUrl: page.url(), observedAt: Date.now() };
}

function parseCard(text: string): TrainResult | undefined {
  const number = text.match(/\b\d{5}\b/)?.[0]; if (!number) return undefined;
  const after = text.slice(text.indexOf(number) + number.length).trim();
  const name = after.match(/^(.{2,80}?)(?=\s+(?:\d{1,2}:\d{2}|[A-Z]{1,3}\b|Mon|Tue|Wed|Thu|Fri|Sat|Sun))/i)?.[1]?.trim() || 'Not shown';
  const times = [...text.matchAll(/\b\d{1,2}:\d{2}\b/g)].map((match) => match[0]);
  const duration = text.match(/\b\d+\s*(?:h|hr|hrs|hour)s?\s*\d*\s*(?:m|min|mins|minute)?\b/i)?.[0] ?? 'Not shown';
  const runningDays = text.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)){0,6}\b/i)?.[0] ?? 'Not shown';
  const classes = parseClasses(text);
  return { number, name, departure: times[0] ?? 'Not shown', arrival: times[1] ?? 'Not shown', duration, runningDays, classes: classes.length ? classes : [{ className: 'Not shown', availability: 'Not shown', status: 'unknown' }] };
}

function parseClasses(text: string): TrainClassAvailability[] {
  const matches = [...text.matchAll(/\b(1A|2A|3A|SL|CC|EC|2S|FC)\b\s*[:\-]?\s*(AVAILABLE\s*\d*|RAC\s*\d*|(?:GNWL|RLWL|PQWL|TQWL|WL)\s*\d*|REGRET|NOT\s+AVAILABLE|CLOSED|CURRENTLY\s+NOT\s+AVAILABLE)/gi)];
  return matches.map((match) => ({ className: match[1].toUpperCase(), availability: match[2].replace(/\s+/g, ' ').trim(), status: availabilityStatus(match[2]) }));
}

function availabilityStatus(value: string): AvailabilityStatus { if (/^available/i.test(value)) return 'available'; if (/^rac/i.test(value)) return 'rac'; if (/wl/i.test(value)) return 'waitlist'; if (/regret|not available|closed/i.test(value)) return 'unavailable'; return 'unknown'; }
