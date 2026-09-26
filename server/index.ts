import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 1. Ensure .env is explicitly loaded before anything reads process.env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { BrowserSocket } from './websocket/browserSocket.js';
import { BrowserManager } from './browser/browserManager.js';
import { AgentRunner } from './agent/agentRunner.js';
import { createPlan } from './agent/agentPlanner.js';
import { aiProviderManager } from './ai/aiProviderManager.js';
import { GeminiProvider } from './ai/providers/geminiProvider.js';
import { OpenRouterProvider } from './ai/providers/openRouterProvider.js';
import type { AIProviderId } from './ai/types.js';

// ─── Register AI Providers ────────────────────────────────────────────────────
const geminiProvider = new GeminiProvider();
const openRouterProvider = new OpenRouterProvider();
aiProviderManager.register(geminiProvider);
aiProviderManager.register(openRouterProvider);

// If env explicitly requests openrouter as default, set it; otherwise use gemini
const envDefault = process.env.AI_PROVIDER?.trim().toLowerCase();
if (envDefault === 'openrouter') {
  aiProviderManager.setActiveProvider('openrouter');
} else {
  aiProviderManager.setActiveProvider('gemini');
}

// ─── Safe diagnostic boot log ─────────────────────────────────────────────────
console.log('[AI Boot] Active provider:', aiProviderManager.getActiveProviderId());
console.log('[Gemini] GEMINI_API_KEY configured:', Boolean(process.env.GEMINI_API_KEY?.trim()));
console.log('[OpenRouter] OPENROUTER_API_KEY configured:', Boolean(process.env.OPENROUTER_API_KEY?.trim()));
console.log('[OpenRouter] Model:', process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash');

// Quick connectivity check logged at boot (non-blocking)
Promise.allSettled([
  geminiProvider.healthCheck(),
  openRouterProvider.healthCheck()
]).then(([gRes, orRes]) => {
  if (gRes.status === 'fulfilled') {
    const h = gRes.value;
    console.log(`[Gemini] Status: ${h.status}${h.error ? ` — ${h.error}` : ''}`);
  }
  if (orRes.status === 'fulfilled') {
    const h = orRes.value;
    console.log(`[OpenRouter] Status: ${h.status}${h.error ? ` — ${h.error}` : ''}`);
  }
});

// ─── Express + HTTP Server ────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);
const socket = new BrowserSocket();
const browser = new BrowserManager(socket);
const runner = new AgentRunner(browser, socket);

app.use(express.json({ limit: '100kb' }));

// ─── Standard REST API ────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, browserActive: runner.isActive }));

// ─── Brain / Provider API ─────────────────────────────────────────────────────

/** GET /api/brain/providers — list all providers with health */
app.get('/api/brain/providers', async (_req, res) => {
  const providers = await aiProviderManager.getProviderHealthList();
  return res.json({
    activeProvider: aiProviderManager.getActiveProviderId(),
    automaticFallback: aiProviderManager.getAutomaticFallback(),
    providers
  });
});

/** POST /api/brain/select — switch active provider */
app.post('/api/brain/select', (req, res) => {
  const id = typeof req.body?.provider === 'string' ? req.body.provider.trim() : '';
  if (!id) return res.status(400).json({ error: 'provider field is required.' });
  try {
    aiProviderManager.setActiveProvider(id as AIProviderId);
    const active = aiProviderManager.getActiveProvider();
    return res.json({
      ok: true,
      activeProvider: active.id,
      name: active.name,
      model: active.model
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error switching provider.' });
  }
});

/** POST /api/brain/fallback — toggle automatic fallback */
app.post('/api/brain/fallback', (req, res) => {
  const enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined;
  if (enabled === undefined) return res.status(400).json({ error: 'enabled (boolean) field is required.' });
  aiProviderManager.setAutomaticFallback(enabled);
  return res.json({ ok: true, automaticFallback: aiProviderManager.getAutomaticFallback() });
});

/** GET /api/brain/test/:providerId — test a specific provider's connectivity */
app.get('/api/brain/test/:providerId', async (req, res) => {
  const providerId = req.params.providerId as AIProviderId;
  const result = await aiProviderManager.healthCheck(providerId);
  return res.json(result);
});

// ─── Task API ─────────────────────────────────────────────────────────────────
app.post('/api/task', async (req, res) => {
  const task = typeof req.body?.task === 'string' ? req.body.task.trim() : '';
  if (!task || task.length > 4_000) return res.status(400).json({ error: 'Task must be between 1 and 4000 characters.' });
  if (runner.isActive) return res.status(409).json({ error: 'An agent task is already running.' });

  // Resolve the currently selected provider at request time
  let provider;
  try {
    provider = aiProviderManager.getActiveProvider();
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'No AI provider is available.' });
  }

  try {
    const { plan, warning, brainLabel } = await createPlan(task, provider);
    void runner.run(plan, task).catch(() => undefined);
    return res.status(202).json({ plan, warning, brainLabel });
  } catch (error) {
    // Surface provider errors clearly
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Unable to create a safe task plan.' });
  }
});

app.post('/api/navigate', async (req, res) => {
  if (runner.isActive) return res.status(409).json({ error: 'Navigation is disabled while an agent task is running.' });
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Enter a full http(s) URL.' });
  try {
    const page = await browser.page();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    socket.send({ type: 'state', url: page.url(), status: 'idle', mode: browser.getDisplayMode() });
    await browser.captureFrame();
    return res.json({ url: page.url() });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Navigation failed' });
  }
});

app.get('/api/browser/mode', (_req, res) => {
  return res.json({ mode: browser.getDisplayMode() });
});

app.post('/api/browser/mode', async (req, res) => {
  const mode = req.body?.mode;
  if (mode !== 'desktop' && mode !== 'mobile') {
    return res.status(400).json({ error: 'mode must be "desktop" or "mobile"' });
  }
  try {
    const result = await browser.setDisplayMode(mode);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to change display mode' });
  }
});

app.post('/api/browser/:command', async (req, res) => {
  if (runner.isActive) return res.status(409).json({ error: 'Browser controls are disabled while an agent task is running.' });
  try {
    const page = await browser.page();
    const command = req.params.command;
    if (command === 'back') await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15_000 });
    else if (command === 'forward') await page.goForward({ waitUntil: 'domcontentloaded', timeout: 15_000 });
    else if (command === 'reload') await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
    else return res.status(404).json({ error: 'Unknown command' });
    socket.send({ type: 'state', url: page.url(), status: 'idle', mode: browser.getDisplayMode() });
    await browser.captureFrame();
    return res.json({ url: page.url() });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Browser command failed' });
  }
});

// ─── Real-time process telemetry for Agent Radar ──────────────────────────────
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = process.hrtime.bigint();
function getCpuPercent(): number {
  const currentCpu = process.cpuUsage(lastCpuUsage);
  const currentTime = process.hrtime.bigint();
  const elapsedNs = Number(currentTime - lastCpuTime);
  lastCpuUsage = process.cpuUsage();
  lastCpuTime = currentTime;
  if (elapsedNs <= 0) return 0;
  const totalCpuNs = (currentCpu.user + currentCpu.system) * 1000;
  return Math.min(100, Math.max(0, Math.round((totalCpuNs / elapsedNs) * 100)));
}

const telemetryInterval = setInterval(() => {
  if (socket.hasClients) {
    socket.send({
      type: 'telemetry',
      cpu: getCpuPercent(),
      memoryMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      timestamp: Date.now()
    });
  }
}, 1000);

// ─── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (client) => {
  socket.add(client);
  void browser.page().then(async (page) => {
    socket.send({ type: 'state', url: page.url(), status: runner.isActive ? 'running' : 'idle', mode: browser.getDisplayMode() });
    socket.send({
      type: 'activity',
      id: `browser-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: 'OBSERVE',
      message: 'Controlled Chromium session connected',
      timestamp: Date.now()
    });
    await browser.captureFrame();
  }).catch((error: unknown) => {
    socket.send({ type: 'error', message: error instanceof Error ? error.message : 'Unable to launch browser' });
  });
});

httpServer.on('upgrade', (request, connection, head) => {
  if (request.url === '/ws/browser') {
    wss.handleUpgrade(request, connection, head, (client) => wss.emit('connection', client, request));
  } else {
    connection.destroy();
  }
});

const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
app.use(vite.middlewares);

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

httpServer.listen(port, host, () => {
  console.log('WebPilot AI Server running at:');
  console.log(`http://0.0.0.0:${port}`);
  console.log('WebSocket:');
  console.log(`ws://0.0.0.0:${port}/ws/browser`);
  console.log('Playwright Chromium: READY');
  console.log('Agent Radar: READY');
  console.log(`AI Brain: ${aiProviderManager.getActiveProviderId().toUpperCase()} (${aiProviderManager.getActiveProvider().model})`);
});

async function shutdown(): Promise<void> {
  clearInterval(telemetryInterval);
  await browser.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
