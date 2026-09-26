import type { Locator, Page } from 'playwright';
import type { BrowserSocket } from '../websocket/browserSocket.js';

const timeout = 10_000;
const monthIndex: Record<string, number> = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

export class DatePickerResolver {
  constructor(private readonly socket: BrowserSocket) {}

  async select(page: Page, isoDate: string): Promise<void> {
    const input = await this.findDateInput(page);
    await this.highlight(input, 'Journey Date');
    const [year, month, day] = isoDate.split('-').map(Number);
    if (await input.getAttribute('type') === 'date') {
      await input.fill(isoDate, { timeout });
      if (await input.inputValue() !== isoDate) throw new Error('DATE_SELECTION_FAILED: native date input did not retain the requested date');
      return;
    }
    await input.click({ timeout });
    const calendar = page.locator('.p-datepicker:visible, .ui-datepicker:visible, [role="dialog"]:visible, .calendar:visible').first();
    if (!await calendar.count()) throw new Error('DATE_SELECTION_FAILED: IRCTC date picker did not open; refusing to inject an arbitrary date string');
    await this.navigateMonth(calendar, year, month - 1);
    const dayCell = calendar.getByRole('button', { name: new RegExp(`^${day}$`) }).first().or(calendar.getByText(String(day), { exact: true }).first());
    if (!await dayCell.count()) throw new Error(`DATE_SELECTION_FAILED: day ${day} was not shown in the IRCTC date picker`);
    await this.highlight(dayCell, `Select ${isoDate}`); await dayCell.click({ timeout });
    const value = await input.inputValue().catch(() => '');
    if (!dateMatches(value, isoDate)) throw new Error(`DATE_SELECTION_FAILED: selected date "${value}" did not match ${isoDate}`);
  }

  private async findDateInput(page: Page): Promise<Locator> {
    const labelled = page.getByLabel(/journey date|departure date|date of journey/i).first(); if (await labelled.count() && await labelled.isVisible().catch(() => false)) return labelled;
    const candidates = ['input[type="date"]', 'input[placeholder*="Journey Date" i]', 'input[placeholder*="Departure Date" i]', 'input[aria-label*="date" i]', 'input[formcontrolname*="journey" i]', 'input[name*="date" i]'];
    for (const selector of candidates) { const locator = page.locator(selector).first(); if (await locator.count() && await locator.isVisible().catch(() => false)) return locator; }
    throw new Error('DATE_SELECTION_FAILED: journey date control was not found');
  }

  private async navigateMonth(calendar: Locator, year: number, month: number): Promise<void> {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const title = (await calendar.locator('.p-datepicker-title, .ui-datepicker-title, .calendar-title, [class*="month"]').first().innerText().catch(() => '')).toLowerCase();
      const actualMonth = Object.entries(monthIndex).find(([name]) => title.includes(name))?.[1]; const actualYear = Number(title.match(/\b20\d{2}\b/)?.[0]);
      if (actualMonth === month && actualYear === year) return;
      const backwards = Number.isFinite(actualYear) && (actualYear > year || (actualYear === year && (actualMonth ?? 0) > month));
      const button = calendar.locator(backwards ? 'button[aria-label*="Previous" i], .p-datepicker-prev, .ui-datepicker-prev' : 'button[aria-label*="Next" i], .p-datepicker-next, .ui-datepicker-next').first();
      if (!await button.count()) throw new Error('DATE_SELECTION_FAILED: could not navigate the visible date picker month');
      await button.click({ timeout });
    }
    throw new Error('DATE_SELECTION_FAILED: requested month was not reached within 24 calendar moves');
  }

  private async highlight(locator: Locator, label: string): Promise<void> { await locator.scrollIntoViewIfNeeded({ timeout }); const box = await locator.boundingBox(); if (box) { this.socket.send({ type: 'cursor', x: box.x + box.width / 2, y: box.y + box.height / 2, target: { x: box.x, y: box.y, width: box.width, height: box.height, label } }); await new Promise((resolve) => setTimeout(resolve, 260)); } }
}

function dateMatches(value: string, iso: string): boolean { const [year, month, day] = iso.split('-'); return value.includes(iso) || (value.includes(year) && new RegExp(`(^|\\D)0?${Number(day)}(\\D|$)`).test(value) && new RegExp(`(^|\\D)0?${Number(month)}(\\D|$)`).test(value)); }
