import type { Locator, Page } from 'playwright';
import type { BrowserSocket } from '../websocket/browserSocket.js';
import type { StationRequest, ResolvedStation } from './types.js';

const timeout = 10_000;

export class StationFieldResolver {
  constructor(private readonly socket: BrowserSocket) {}

  async select(page: Page, kind: 'from' | 'to', request: StationRequest): Promise<ResolvedStation> {
    const field = await this.findField(page, kind);
    await this.highlight(field, `${kind === 'from' ? 'From' : 'To'} Station`);
    await field.fill(request.canonical, { timeout });
    const selected = await this.selectSuggestion(page, request);
    const actual = await field.inputValue().catch(() => '');
    if (!this.matches(actual, request) && !this.matches(selected, request)) throw new Error(`${kind === 'from' ? 'STATION_NOT_FOUND' : 'DESTINATION_NOT_FOUND'}: selected station did not match ${request.canonical}`);
    const code = this.extractCode(`${actual} ${selected}`);
    return { name: request.canonical, code, selectedValue: actual || selected };
  }

  private async findField(page: Page, kind: 'from' | 'to'): Promise<Locator> {
    const label = kind === 'from' ? /from|source|origin/i : /to|destination/i;
    const labelled = page.getByLabel(label).first(); if (await labelled.count() && await labelled.isVisible().catch(() => false)) return labelled;
    const placeholders = page.getByPlaceholder(label).first(); if (await placeholders.count() && await placeholders.isVisible().catch(() => false)) return placeholders;
    const candidates = kind === 'from'
      ? ['input[placeholder*="From" i]', 'input[aria-label*="From" i]', 'input[name*="from" i]', 'input[formcontrolname*="from" i]']
      : ['input[placeholder*="To" i]', 'input[aria-label*="To" i]', 'input[name*="to" i]', 'input[formcontrolname*="to" i]'];
    for (const selector of candidates) { const locator = page.locator(selector).first(); if (await locator.count() && await locator.isVisible().catch(() => false)) return locator; }
    throw new Error(`${kind === 'from' ? 'STATION_NOT_FOUND' : 'DESTINATION_NOT_FOUND'}: ${kind} station field was not found`);
  }

  private async selectSuggestion(page: Page, request: StationRequest): Promise<string> {
    const options = page.locator('[role="option"], [role="listbox"] li, .ui-autocomplete-item, .p-autocomplete-item, .autocomplete li, .suggestions li');
    await options.first().waitFor({ state: 'visible', timeout }).catch(() => undefined);
    const total = await options.count();
    const scored = await Promise.all(Array.from({ length: Math.min(total, 50) }, async (_, index) => ({ index, text: (await options.nth(index).innerText().catch(() => '')).trim() })));
    const candidates = scored.filter((item) => item.text).map((item) => ({ ...item, score: this.score(item.text, request) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) throw new Error(`STATION_NOT_FOUND: IRCTC did not show a matching autocomplete option for ${request.canonical}`);
    const target = options.nth(best.index); await this.highlight(target, `Select ${request.canonical}`); await target.click({ timeout });
    return best.text;
  }

  private score(text: string, request: StationRequest): number {
    const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    return request.aliases.reduce((score, alias) => { const value = alias.toLowerCase().replace(/[^a-z0-9]/g, ''); return score + (normalized.includes(value) ? value.length : 0); }, 0);
  }
  private matches(value: string, request: StationRequest): boolean { return this.score(value, request) > 0; }
  private extractCode(value: string): string | undefined { return value.match(/\b[A-Z]{2,5}\b/)?.[0]; }
  private async highlight(locator: Locator, label: string): Promise<void> { await locator.scrollIntoViewIfNeeded({ timeout }); const box = await locator.boundingBox(); if (box) { this.socket.send({ type: 'cursor', x: box.x + box.width / 2, y: box.y + box.height / 2, target: { x: box.x, y: box.y, width: box.width, height: box.height, label } }); await pagePause(); } }
}
function pagePause(): Promise<void> { return new Promise((resolve) => setTimeout(resolve, 260)); }
