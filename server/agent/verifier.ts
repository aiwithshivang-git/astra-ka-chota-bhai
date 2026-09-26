import type { Page } from 'playwright';
import type { SemanticAction } from '../types.js';
import { observe } from '../browser/browserObserver.js';

export async function verify(page: Page, action: SemanticAction): Promise<boolean> {
  switch (action.verify ?? 'none') {
    case 'none': return true;
    case 'url': return Boolean(page.url() && page.url() !== 'about:blank');
    case 'input': {
      if (!action.target || action.value === undefined) return false;
      const candidates = page.locator('input, textarea, [contenteditable="true"]');
      const count = await candidates.count();
      for (let index = 0; index < count; index += 1) if (await candidates.nth(index).inputValue().catch(() => '') === action.value) return true;
      return false;
    }
    case 'checked': return action.target ? page.getByRole(action.target.role === 'radio' ? 'radio' : 'checkbox', { name: action.target.text ?? action.target.description }).isChecked().catch(() => false) : false;
    case 'video-playing': {
      const video = page.locator('video').first();
      return (await video.count()) > 0 && video.evaluate((element: HTMLVideoElement) => !element.paused && element.currentTime >= 0).catch(() => false);
    }
    case 'visible': {
      if (!action.target) return Boolean((await observe(page)).visibleText);
      if (/YouTube search results/i.test(action.target.description)) return (await page.locator('ytd-video-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-item-section-renderer, a[href*="/watch"]').count()) > 0;
      if (/Google search results/i.test(action.target.description)) return (await page.locator('#search a[href]').count()) > 0;
      if (/Wikipedia search results/i.test(action.target.description)) return (await page.locator('.mw-search-results, .mw-search-result-heading, #mw-content-text').count()) > 0 && /search=|Special:Search/i.test(page.url());
      if (/DuckDuckGo search results/i.test(action.target.description)) return (await page.locator('[data-testid="result-title-a"], [data-testid="result"]').count()) > 0;
      if (/IRCTC train results/i.test(action.target.description)) return (await page.locator('app-train-listing, app-train-list, .train-list, .train-card, [class*="train-list"], [class*="train-card"]').count()) > 0;
      if (/search results/i.test(action.target.description)) return /results|video/i.test((await observe(page)).visibleText);
      return true;
    }
    case 'download': return false; // download verification occurs atomically in the executor
  }
}
