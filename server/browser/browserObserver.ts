import type { Page } from 'playwright';
import type { Observation } from '../types.js';

export async function observe(page: Page): Promise<Observation> {
  const interactiveElements = await page.locator('input, textarea, select, button, a[href], [role="button"], [role="textbox"], [role="checkbox"], [role="radio"]').evaluateAll((elements) =>
    elements.slice(0, 80).map((element) => {
      const html = element as HTMLInputElement;
      return {
        role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
        name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 120) ?? '',
        value: 'value' in html ? html.value : undefined,
        href: element instanceof HTMLAnchorElement ? element.href : undefined
      };
    }).filter((item) => item.name || item.value || item.href)
  ).catch(() => []);
  return {
    url: page.url(),
    title: await page.title().catch(() => ''),
    visibleText: (await page.locator('body').innerText({ timeout: 3_000 }).catch(() => '')).replace(/\s+/g, ' ').slice(0, 3_000),
    interactiveElements,
    hasVideo: await page.locator('video').count().then((count) => count > 0).catch(() => false)
  };
}
