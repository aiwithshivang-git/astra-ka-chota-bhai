import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from 'playwright';
import type { BrowserSocket } from '../websocket/browserSocket.js';
import type { DisplayMode } from '../types.js';

export const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export class BrowserManager {
  private browser?: Browser;
  private context?: BrowserContext;
  private primaryPage?: Page;
  private cdpSession?: CDPSession;
  private frameTimer?: NodeJS.Timeout;
  private capturing = false;
  private displayMode: DisplayMode = 'desktop';

  constructor(private readonly socket: BrowserSocket) {}

  getDisplayMode(): DisplayMode {
    return this.displayMode;
  }

  getViewportSize(): { width: number; height: number } {
    return this.displayMode === 'mobile' ? { ...MOBILE_VIEWPORT } : { ...DESKTOP_VIEWPORT };
  }

  async page(): Promise<Page> {
    if (this.primaryPage && !this.primaryPage.isClosed()) return this.primaryPage;
    try {
      this.browser = await chromium.launch({ headless: true });
    } catch (error) {
      throw new Error('Chromium is unavailable. Run: npx playwright install chromium. ' + (error instanceof Error ? error.message : ''));
    }
    const initialViewport = this.displayMode === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
    this.context = await this.browser.newContext({
      viewport: initialViewport,
      acceptDownloads: true,
      deviceScaleFactor: 1
    });
    this.primaryPage = await this.context.newPage();
    this.primaryPage.setDefaultTimeout(10_000);
    this.primaryPage.setDefaultNavigationTimeout(15_000);
    this.primaryPage.on('framenavigated', () => this.publishFrameSoon());
    this.primaryPage.on('load', () => this.publishFrameSoon());

    if (this.displayMode === 'mobile') {
      await this.applyMobileEmulation(this.primaryPage);
    }

    this.startStreaming();
    return this.primaryPage;
  }

  private async getCdpSession(page: Page): Promise<CDPSession> {
    if (!this.cdpSession || !this.context) {
      this.cdpSession = await page.context().newCDPSession(page);
    }
    return this.cdpSession;
  }

  private async applyMobileEmulation(page: Page): Promise<void> {
    try {
      const cdp = await this.getCdpSession(page);
      await cdp.send('Network.setUserAgentOverride', { userAgent: MOBILE_USER_AGENT });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    } catch (err) {
      console.warn('[BrowserManager] CDP mobile emulation error:', err);
    }
  }

  private async clearMobileEmulation(page: Page): Promise<void> {
    try {
      const cdp = await this.getCdpSession(page);
      await cdp.send('Network.setUserAgentOverride', { userAgent: '' });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    } catch (err) {
      console.warn('[BrowserManager] CDP clear emulation error:', err);
    }
  }

  async setDisplayMode(mode: DisplayMode): Promise<{ mode: DisplayMode; width: number; height: number }> {
    this.displayMode = mode;
    const targetViewport = mode === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;

    if (this.primaryPage && !this.primaryPage.isClosed()) {
      await this.primaryPage.setViewportSize(targetViewport);

      if (mode === 'mobile') {
        await this.applyMobileEmulation(this.primaryPage);
      } else {
        await this.clearMobileEmulation(this.primaryPage);
      }

      await this.captureFrame();
    }

    this.socket.send({
      type: 'mode',
      mode: this.displayMode,
      width: targetViewport.width,
      height: targetViewport.height
    });

    return {
      mode: this.displayMode,
      width: targetViewport.width,
      height: targetViewport.height
    };
  }

  async url(): Promise<string> { return (await this.page()).url(); }

  async publishFrameSoon(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    await this.captureFrame();
  }

  async captureFrame(): Promise<void> {
    if (this.capturing || !this.socket.hasClients || !this.primaryPage || this.primaryPage.isClosed()) return;
    this.capturing = true;
    try {
      const image = await this.primaryPage.screenshot({ type: 'jpeg', quality: 62, timeout: 5_000 });
      const viewport = this.primaryPage.viewportSize() ?? (this.displayMode === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT);
      this.socket.send({ type: 'browser_frame', timestamp: Date.now(), image: image.toString('base64'), width: viewport.width, height: viewport.height });
    } catch { /* a navigation can invalidate a transient capture */ }
    finally { this.capturing = false; }
  }

  private startStreaming(): void {
    if (this.frameTimer) return;
    this.frameTimer = setInterval(() => void this.captureFrame(), 100); // latest-frame-wins, max 10 FPS
  }

  async close(): Promise<void> {
    if (this.frameTimer) clearInterval(this.frameTimer);
    try { await this.cdpSession?.detach(); } catch { /* ignore */ }
    await this.context?.close();
    await this.browser?.close();
  }
}

