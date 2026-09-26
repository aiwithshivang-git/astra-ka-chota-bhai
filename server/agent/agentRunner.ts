import type { BrowserManager } from '../browser/browserManager.js';
import type { BrowserSocket } from '../websocket/browserSocket.js';
import type { ActivityEvent, Plan, Stage } from '../types.js';
import { observe } from '../browser/browserObserver.js';
import { ActionExecutor } from './actionExecutor.js';
import { validateAction } from './actionValidator.js';
import { verify } from './verifier.js';
import { parseJourneyRequest } from '../irctc/journeyParser.js';
import { TrainSearchStore } from '../irctc/types.js';

const STAGE_TIMEOUT = 30_000;
const MAX_ACTIONS = 50;
const MAX_ACTION_RETRIES = 3;
const MAX_STAGE_RETRIES = 5;

export class AgentRunner {
  private active = false;
  constructor(private readonly browser: BrowserManager, private readonly socket: BrowserSocket) {}

  get isActive(): boolean { return this.active; }

  private event(kind: ActivityEvent['kind'], message: string, stage?: Stage): void {
    this.socket.send({ type: 'activity', id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, kind, stage: stage?.id, status: stage?.status, message, timestamp: Date.now() });
  }

  async run(plan: Plan, task: string): Promise<void> {
    if (this.active) throw new Error('An agent task is already running');
    this.active = true;
    const trainStore = new TrainSearchStore(); trainStore.request = parseJourneyRequest(task);
    let actions = 0;
    this.socket.send({ type: 'state', url: await this.browser.url(), status: 'running', plan, mode: this.browser.getDisplayMode() });
    this.event('PLAN', `Task broken into ${plan.stages.length} verified stages${plan.source === 'fallback' ? ' (deterministic fallback planner)' : ''}`);
    try {
      for (const stage of plan.stages) {
        if (++actions > MAX_ACTIONS) throw new Error('Safety limit reached: maximum total actions exceeded');
        await this.runStage(stage, task, trainStore);
        this.socket.send({ type: 'state', url: await this.browser.url(), status: 'running', plan, mode: this.browser.getDisplayMode() });
      }
      this.event('COMPLETE', 'Final user requirement verified. Task completed successfully.');
      this.socket.send({ type: 'state', url: await this.browser.url(), status: 'completed', plan, mode: this.browser.getDisplayMode() });
    } catch (error) {
      this.event('ERROR', error instanceof Error ? error.message : 'Agent execution failed');
      this.socket.send({ type: 'state', url: await this.browser.url(), status: 'failed', plan, mode: this.browser.getDisplayMode() });
      throw error;
    } finally { this.active = false; }
  }

  private async runStage(stage: Stage, task: string, trainStore: TrainSearchStore): Promise<void> {
    const executor = new ActionExecutor(this.browser, this.socket, trainStore);
    const began = Date.now();
    let lastError = 'Unknown failure';
    for (let retry = 0; retry < MAX_STAGE_RETRIES && Date.now() - began < STAGE_TIMEOUT; retry += 1) {
      stage.attempts = retry + 1;
      try {
        const before = await observe(await this.browser.page());
        const irctcProblem = irctcBlocker(before.url, before.visibleText); if (irctcProblem) throw new Error(irctcProblem);
        if (isProtectionPage(before.url, before.visibleText)) throw new Error('SECURITY_CHALLENGE: The website presented an anti-bot/security challenge. WebPilot will not bypass it.');
        validateAction(stage.action, task);
        stage.status = 'running';
        this.event('ACT', stage.description, stage);
        let actionError: unknown;
        for (let attempt = 0; attempt < MAX_ACTION_RETRIES; attempt += 1) {
          try { await executor.execute(stage.action); actionError = undefined; break; }
          catch (error) { actionError = error; await this.recover(stage, attempt + 1, error); }
        }
        if (actionError) throw actionError;
        stage.status = 'verifying'; this.event('VERIFY', `Verifying: ${stage.description}`, stage);
        const passed = await Promise.race([verify(await this.browser.page(), stage.action), new Promise<false>((resolve) => setTimeout(() => resolve(false), 10_000))]);
        if (!passed) throw new Error('Verification did not confirm the requested browser state');
        stage.status = 'completed'; this.event('VERIFY', `Verified: ${stage.description}`, stage);
        const observation = await observe(await this.browser.page());
        const irctcProblemAfter = irctcBlocker(observation.url, observation.visibleText); if (irctcProblemAfter) throw new Error(irctcProblemAfter);
        if (isProtectionPage(observation.url, observation.visibleText)) throw new Error('SECURITY_CHALLENGE: The website presented an anti-bot/security challenge. WebPilot will not bypass it.');
        this.event('OBSERVE', `${observation.title || 'Page'} · ${observation.url.slice(0, 90)}`, stage);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        stage.status = 'failed';
        if (/^(SECURITY_CHALLENGE|IRCTC_NOT_REACHABLE|IRCTC_LOGIN_REQUIRED|IRCTC_CAPTCHA_REQUIRED):/.test(lastError)) throw new Error(lastError);
        if (retry < MAX_STAGE_RETRIES - 1 && Date.now() - began < STAGE_TIMEOUT) { this.event('RECOVER', `Recovering from ${lastError}`, stage); continue; }
      }
    }
    throw new Error(`Stage ${stage.id} failed: ${stage.description}. ${lastError}`);
  }

  private async recover(stage: Stage, attempt: number, error: unknown): Promise<void> {
    const detail = error instanceof Error ? error.message : String(error);
    this.event('RECOVER', `Attempt ${attempt}/${MAX_ACTION_RETRIES}: ${detail.slice(0, 130)}`, stage);
    await observe(await this.browser.page());
  }
}

function isProtectionPage(url: string, text: string): boolean {
  return /\/sorry\//i.test(url) || /unusual traffic|not a robot|verify you are human|captcha|security check/i.test(text);
}

function irctcBlocker(url: string, text: string): string | undefined {
  if (!/irctc\.co\.in/i.test(url)) return undefined;
  if (/captcha|verify you are human|security check/i.test(text)) return 'IRCTC_CAPTCHA_REQUIRED: IRCTC requires user security verification. WebPilot will not bypass it.';
  if (/login|sign in|username|password/i.test(text) && !/search trains|from station|journey date/i.test(text)) return 'IRCTC_LOGIN_REQUIRED: IRCTC requires login before the requested public search can continue.';
  return undefined;
}
