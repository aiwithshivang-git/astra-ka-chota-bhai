import type { Locator, Page } from 'playwright';
import type { BrowserManager } from '../browser/browserManager.js';
import type { BrowserSocket } from '../websocket/browserSocket.js';
import type { SemanticAction, Target } from '../types.js';
import { StationFieldResolver } from '../irctc/stationFieldResolver.js';
import { DatePickerResolver } from '../irctc/datePickerResolver.js';
import { parseTrainResults, waitForTrainResults } from '../irctc/trainResultParser.js';
import type { TrainSearchStore } from '../irctc/types.js';

const ACTION_TIMEOUT = 10_000;
const settle = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function classify(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/irctc\.co\.in/i.test(message) && /(ERR_HTTP2_PROTOCOL_ERROR|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_TIMED_OUT)/i.test(message)) return 'IRCTC_NOT_REACHABLE';
  if (/captcha/i.test(message)) return 'IRCTC_CAPTCHA_REQUIRED';
  if (/timeout/i.test(message)) return 'TIMEOUT';
  if (/not found|strict mode|locator/i.test(message)) return 'ELEMENT_NOT_FOUND';
  if (/intercept|overlay/i.test(message)) return 'OVERLAY_BLOCKED';
  if (/detached|stale/i.test(message)) return 'STALE_ELEMENT';
  return 'UNKNOWN';
}

export class ActionExecutor {
  constructor(private readonly browser: BrowserManager, private readonly socket: BrowserSocket, private readonly trainStore?: TrainSearchStore) {}

  private async resolve(page: Page, target: Target): Promise<Locator> {
    const name = target.ariaLabel ?? target.text ?? target.description;
    const isTypeAction = target.role === 'textbox' || /search.*(?:bar|input|box)|input|query/i.test(target.description);
    if (/YouTube search input/i.test(target.description) || (/youtube\.com/i.test(page.url()) && isTypeAction && !/button/i.test(target.description))) {
      const visibleInput = page.locator('input.search-input, input[type="search"], input[name="search_query"], input#search, input.ytSearchboxComponentInput, ytd-searchbox input, input[type="text"]').filter({ visible: true }).first();
      if (await visibleInput.count()) return visibleInput;
      // On mobile YouTube, search input may be revealed by tapping the top search icon
      const mobileSearchToggle = page.locator('button.topbar-button-search-button, button[aria-label*="Search YouTube" i], button.search-button').filter({ visible: true }).first();
      if (await mobileSearchToggle.count()) {
        await mobileSearchToggle.click({ timeout: 3000 }).catch(() => undefined);
        await page.waitForTimeout(400);
      }
      const revealedInput = page.locator('input.search-input, input[type="search"], input[name="search_query"], input#search, input[type="text"]').filter({ visible: true }).first();
      if (await revealedInput.count()) return revealedInput;
      return page.locator('input[name="search_query"], input#search, input.ytSearchboxComponentInput, ytd-searchbox input, input[type="text"]').first();
    }
    if (/YouTube search button/i.test(target.description) || (/youtube\.com/i.test(page.url()) && (/button/i.test(target.description) || target.role === 'button') && /search/i.test(target.description + (target.ariaLabel ?? '')))) {
      const visibleBtn = page.locator('button.topbar-button-search-button, button[aria-label*="Search YouTube" i], button#search-icon-legacy, button.ytSearchboxComponentSearchButton, button[aria-label="Search"]').filter({ visible: true }).first();
      if (await visibleBtn.count()) return visibleBtn;
      return page.locator('button#search-icon-legacy, button.ytSearchboxComponentSearchButton, #search-icon-legacy button, button[aria-label="Search"]').first();
    }
    if (/actual YouTube video result/i.test(target.description) || (/youtube\.com/i.test(page.url()) && /video|result/i.test(target.description) && !/search/i.test(target.description))) {
      const idx = (target.position ?? 1) - 1;
      const visibleVideos = page.locator('ytm-video-with-context-renderer a[href*="/watch"], ytm-compact-video-renderer a[href*="/watch"], a.media-item-thumbnail-container, a.compact-media-item-headline, ytd-video-renderer a#video-title, ytd-rich-item-renderer a#video-title, #contents ytd-video-renderer a#video-title, a#video-title, a[href*="/watch"]').filter({ visible: true });
      if (await visibleVideos.count() > idx) return visibleVideos.nth(idx);
      return page.locator('ytd-video-renderer a#video-title, ytd-rich-item-renderer a#video-title, #contents ytd-video-renderer a#video-title, a#video-title, a[href*="/watch"]').nth(idx);
    }
    if (/first actual search result/i.test(target.description)) return page.locator('#search a[href], [data-snhf] a[href]').filter({ hasText: /.+/ }).nth((target.position ?? 1) - 1);
    if (/first Wikipedia result/i.test(target.description)) return page.locator('.mw-search-result-heading a').nth((target.position ?? 1) - 1);
    if (/first DuckDuckGo result/i.test(target.description)) return page.locator('[data-testid="result-title-a"]').nth((target.position ?? 1) - 1);
    if (/video play control/i.test(target.description) || (/youtube\.com/i.test(page.url()) && /play/i.test(target.description))) {
      const visiblePlay = page.locator('.ytp-play-button, button[aria-label*="Play" i], button.player-control-play, video').filter({ visible: true }).first();
      if (await visiblePlay.count()) return visiblePlay;
      return page.locator('.ytp-play-button, button[aria-label*="Play" i], video').first();
    }
    if (/Google search input/i.test(target.description)) return page.locator('textarea[name="q"], input[name="q"], [role="combobox"][name="q"]').first();
    if (/Google Search button/i.test(target.description)) return page.locator('input[value="Google Search"], button[aria-label="Google Search"]').first();
    if (/Google search results/i.test(target.description)) return page.locator('#search, #rso, [role="main"]').first();
    if (/Wikipedia search input/i.test(target.description)) return page.locator('input[name="search"], #searchInput').first();
    if (/Wikipedia search button/i.test(target.description)) return page.locator('#searchButton, .cdx-search-input__end-button, button[type="submit"], input[type="submit"]').first();
    if (/Wikipedia search results/i.test(target.description)) return page.locator('.mw-search-results, #mw-content-text').first();
    if (/DuckDuckGo search input/i.test(target.description)) return page.locator('input[name="q"], input[aria-label="Search with DuckDuckGo"]').first();
    if (/DuckDuckGo search button/i.test(target.description)) return page.locator('button[type="submit"], button[aria-label*="Search"]').first();
    if (/DuckDuckGo search results/i.test(target.description)) return page.locator('[data-testid="result"], #links').first();
    if (/IRCTC train search form/i.test(target.description)) return page.locator('form, [class*="train-search"], [class*="journey"] form').first();
    if (/IRCTC Search button/i.test(target.description)) return page.getByRole('button', { name: /search trains|search/i }).first().or(page.locator('button[type="submit"], input[type="submit"]').first());
    if (/IRCTC train results/i.test(target.description)) return page.locator('app-train-listing, app-train-list, .train-list, .train-card, [class*="train-list"], [class*="train-card"]').first();
    if (/YouTube search results/i.test(target.description)) return page.locator('ytd-item-section-renderer, ytd-search, ytm-search, ytm-item-section-renderer, ytm-section-list-renderer, [role="main"]').first();
    if (/YouTube video player|playing video/i.test(target.description)) return page.locator('video, #movie_player').first();
    if (target.role) {
      const roleLocator = page.getByRole(target.role, { name: new RegExp(`^${escapeRegExp(name)}$`, 'i') }).first();
      if (await roleLocator.count()) return roleLocator;
    }
    if (target.role === 'textbox') {
      const inputLocator = page.locator('input:not([type="hidden"]), textarea, [contenteditable="true"]').first();
      if (await inputLocator.count()) return inputLocator;
    }
    const label = page.getByLabel(new RegExp(escapeRegExp(name), 'i')).first();
    if (await label.count()) return label;
    const text = page.getByText(name, { exact: Boolean(target.text) }).first();
    if (await text.count()) return text;
    const aria = page.locator(`[aria-label*="${cssEscape(name)}" i]`).first();
    if (await aria.count()) return aria;
    throw new Error(`Could not resolve target: ${target.description}`);
  }

  private async highlight(locator: Locator, label: string): Promise<void> {
    await locator.scrollIntoViewIfNeeded({ timeout: ACTION_TIMEOUT });
    const box = await locator.boundingBox();
    if (box) {
      this.socket.send({ type: 'cursor', x: box.x + box.width / 2, y: box.y + box.height / 2, target: { x: box.x, y: box.y, width: box.width, height: box.height, label } });
      await settle(280);
    }
  }

  async execute(action: SemanticAction): Promise<void> {
    const page = await this.browser.page();
    try {
      switch (action.action) {
        case 'navigate':
          await page.goto(action.url!, { waitUntil: 'domcontentloaded', timeout: 15_000 }); await settle(350); break;
        case 'back': await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15_000 }); break;
        case 'forward': await page.goForward({ waitUntil: 'domcontentloaded', timeout: 15_000 }); break;
        case 'reload': await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 }); break;
        case 'wait':
          if (/IRCTC train results/i.test(action.target?.description ?? '')) await waitForTrainResults(page, 30_000);
          else await page.waitForTimeout(Math.min(5_000, Math.max(100, Number(action.value) || 750)));
          break;
        case 'select_station': await this.selectStation(page, action); break;
        case 'select_date': await this.selectDate(page, action); break;
        case 'extract_trains': await this.extractTrains(page); break;
        case 'scroll': await this.scroll(page, action); break;
        case 'type': await this.type(page, action); break;
        case 'select': await this.select(page, action); break;
        case 'click': await this.click(page, action); break;
        case 'read': if (action.target) await this.highlight(await this.resolve(page, action.target), action.target.description); break;
        case 'download': await this.download(page, action); break;
        case 'finish': break;
      }
      await this.browser.captureFrame();
    } catch (error) { throw new Error(`${classify(error)}: ${error instanceof Error ? error.message : String(error)}`); }
  }

  private async type(page: Page, action: SemanticAction): Promise<void> {
    const locator = await this.resolve(page, action.target!);
    await this.highlight(locator, action.target!.description);
    await locator.fill(action.value!, { timeout: ACTION_TIMEOUT });
    const value = await locator.inputValue();
    if (value !== action.value) throw new Error('INPUT_FAILED: input value did not match requested exact value');
  }

  private async select(page: Page, action: SemanticAction): Promise<void> {
    const locator = await this.resolve(page, action.target!);
    await this.highlight(locator, action.target!.description);
    await locator.selectOption(action.value!, { timeout: ACTION_TIMEOUT });
  }

  private async click(page: Page, action: SemanticAction): Promise<void> {
    if (action.verify === 'video-playing') {
      const video = page.locator('video').first();
      if (await video.count() && await video.evaluate((element: HTMLVideoElement) => !element.paused && element.currentTime > 0).catch(() => false)) return;
    }
    const locator = await this.resolve(page, action.target!);
    await this.highlight(locator, action.target!.description);
    await locator.click({ timeout: ACTION_TIMEOUT });
    await settle(250);
    if (action.verify === 'video-playing') {
      const video = page.locator('video').first();
      if (await video.count()) {
        await video.evaluate((el: HTMLVideoElement) => { if (el.paused) el.play().catch(() => {}); }).catch(() => undefined);
      }
    }
  }

  private async scroll(page: Page, action: SemanticAction): Promise<void> {
    if (action.target) {
      const locator = await this.resolve(page, action.target);
      await this.highlight(locator, action.target.description);
      return;
    }
    const y = Number.isFinite(action.deltaY) ? action.deltaY! : 500;
    this.socket.send({ type: 'cursor', x: 720, y: 580 });
    await page.mouse.wheel(0, y);
  }

  private async selectStation(page: Page, action: SemanticAction): Promise<void> {
    if (!this.trainStore?.request) throw new Error('UNKNOWN_IRCTC_STATE: train journey context was not initialized');
    const from = /from/i.test(action.target?.description ?? '');
    const resolver = new StationFieldResolver(this.socket);
    const resolved = await resolver.select(page, from ? 'from' : 'to', from ? this.trainStore.request.origin : this.trainStore.request.destination);
    if (from) this.trainStore.from = resolved; else this.trainStore.to = resolved;
  }

  private async selectDate(page: Page, action: SemanticAction): Promise<void> {
    const date = action.value ?? this.trainStore?.request?.journeyDate;
    if (!date) throw new Error('DATE_SELECTION_FAILED: requested journey date was unavailable');
    await new DatePickerResolver(this.socket).select(page, date);
    if (this.trainStore) this.trainStore.date = date;
  }

  private async extractTrains(page: Page): Promise<void> {
    if (!this.trainStore?.request) throw new Error('UNKNOWN_IRCTC_STATE: train journey context was not initialized');
    const result = await parseTrainResults(page, this.trainStore.request, this.trainStore);
    this.trainStore.result = result; this.socket.send({ type: 'train_results', result });
  }

  private async download(page: Page, action: SemanticAction): Promise<void> {
    const locator = await this.resolve(page, action.target!);
    await this.highlight(locator, action.target!.description);
    const download = await Promise.all([page.waitForEvent('download', { timeout: ACTION_TIMEOUT }), locator.click({ timeout: ACTION_TIMEOUT })]).then(([item]) => item);
    const path = await download.path();
    if (!path) throw new Error('DOWNLOAD_FAILED: download had no saved file');
  }
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function cssEscape(value: string): string { return value.replace(/["\\]/g, '\\$&'); }
