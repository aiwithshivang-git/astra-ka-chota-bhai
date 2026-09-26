import { z } from 'zod';
import type { Plan, SemanticAction, Stage } from '../types.js';
import { normalizeAction } from './actionNormalizer.js';
import { validateAction } from './actionValidator.js';
import { parseJourneyRequest } from '../irctc/journeyParser.js';
import type { AIProvider, AIProviderId } from '../ai/types.js';
import { ProviderError } from '../ai/types.js';

const actionSchema = z.object({
  action: z.enum(['click', 'type', 'select', 'select_station', 'select_date', 'extract_trains', 'scroll', 'navigate', 'back', 'forward', 'reload', 'wait', 'read', 'download', 'finish']),
  target: z.object({ description: z.string().optional(), text: z.string().optional(), role: z.enum(['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox']).optional(), ariaLabel: z.string().optional(), selector: z.string().optional(), position: z.number().int().positive().optional() }).optional(),
  value: z.string().optional(), url: z.string().optional(), deltaY: z.number().optional(), verify: z.enum(['url', 'input', 'checked', 'video-playing', 'download', 'visible', 'none']).optional()
});
const modelPlanSchema = z.object({ goal: z.string(), entities: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])), stages: z.array(z.object({ description: z.string(), action: actionSchema })).min(1).max(20) });

function extractSearchTerm(task: string): string | undefined {
  const quoted = task.match(/(?:search(?:\s+for)?|search\s+youtube\s+for)\s+[""]([^""]+)[""]/i) ?? task.match(/[""]([^""]+)[""]/);
  if (quoted?.[1]) return quoted[1];
  const plain = task.match(/search(?:\s+(?:google|youtube|duckduckgo|wikipedia|the web))?\s+for\s+([^,.]+?)(?:\s+and\s+|,|\.|$)/i);
  return plain?.[1]?.trim();
}

function extractUrl(task: string): string | undefined {
  const match = task.match(/https?:\/\/[^\s,]+/i);
  return match?.[0]?.replace(/[.)\],]+$/, '');
}

function stage(id: number, description: string, action: SemanticAction): Stage { return { id, description, action, status: 'pending', attempts: 0 }; }

function fallbackPlan(task: string): Plan | undefined {
  const trainJourney = parseJourneyRequest(task);
  if (trainJourney) return {
    goal: task, source: 'fallback', entities: { workflow: 'irctc', origin: trainJourney.origin.canonical, destination: trainJourney.destination.canonical, journey_date: trainJourney.journeyDate, search_only: true }, stages: [
      stage(1, 'Open official IRCTC train search', { action: 'navigate', url: 'https://www.irctc.co.in/nget/train-search', verify: 'url' }),
      stage(2, `Select From station: ${trainJourney.origin.canonical}`, { action: 'select_station', target: { description: 'IRCTC From station' }, value: trainJourney.origin.canonical, verify: 'visible' }),
      stage(3, `Select To station: ${trainJourney.destination.canonical}`, { action: 'select_station', target: { description: 'IRCTC To station' }, value: trainJourney.destination.canonical, verify: 'visible' }),
      stage(4, `Select journey date: ${trainJourney.journeyDate}`, { action: 'select_date', target: { description: 'IRCTC journey date' }, value: trainJourney.journeyDate, verify: 'visible' }),
      stage(5, 'Search trains (search only; never book)', { action: 'click', target: { description: 'IRCTC Search button', role: 'button' }, verify: 'url' }),
      stage(6, 'Wait for actual IRCTC train results', { action: 'wait', target: { description: 'IRCTC train results' }, value: '1200', verify: 'visible' }),
      stage(7, 'Read actual train availability from IRCTC results', { action: 'extract_trains', target: { description: 'IRCTC train results' }, verify: 'visible' }),
      stage(8, 'Present actual search-only results', { action: 'finish', verify: 'none' })
    ]
  };
  const query = extractSearchTerm(task) ?? '';
  const url = extractUrl(task);
  const youtube = /youtube|video|play/i.test(task);
  const requested = /second\s+(?:actual\s+)?video/i.test(task) ? 2 : 1;
  const openFirst = /\bopen\s+(?:the\s+)?first(?:\s+(?:actual\s+)?)?(?:result|link)?\b/i.test(task);
  if (url && !/\bsearch\b/i.test(task)) return {
    goal: task, source: 'fallback', entities: { url }, stages: [
      stage(1, `Open ${url}`, { action: 'navigate', url, verify: 'url' }),
      stage(2, 'Verify the requested page opened', { action: 'read', verify: 'url' })
    ]
  };
  if (youtube && query) return {
    goal: task, source: 'fallback', entities: { site: 'YouTube', search_query: query, target_position: requested }, stages: [
      stage(1, 'Open YouTube', { action: 'navigate', url: 'https://www.youtube.com', verify: 'url' }),
      stage(2, 'Locate the YouTube search input', { action: 'read', target: { description: 'YouTube search input', role: 'textbox', ariaLabel: 'Search' }, verify: 'visible' }),
      stage(3, `Enter exact search query "${query}"`, { action: 'type', target: { description: 'YouTube search input', role: 'textbox', ariaLabel: 'Search' }, value: query, verify: 'input' }),
      stage(4, 'Submit the YouTube search', { action: 'click', target: { description: 'YouTube search button', role: 'button', ariaLabel: 'Search' }, verify: 'url' }),
      stage(5, 'Verify YouTube search results', { action: 'read', target: { description: 'YouTube search results' }, verify: 'visible' }),
      stage(6, `Identify the ${requested === 1 ? 'first' : 'second'} actual video result`, { action: 'read', target: { description: 'actual YouTube video result', position: requested }, verify: 'visible' }),
      stage(7, 'Open the selected video', { action: 'click', target: { description: 'actual YouTube video result', role: 'link', position: requested }, verify: 'url' }),
      stage(8, 'Verify the video page', { action: 'read', target: { description: 'YouTube video player' }, verify: 'visible' }),
      stage(9, 'Start video playback', { action: 'click', target: { description: 'video play control', role: 'button', ariaLabel: 'Play' }, verify: 'video-playing' }),
      stage(10, 'Verify actual playback', { action: 'read', target: { description: 'playing video' }, verify: 'video-playing' })
    ]
  };
  if (/google/i.test(task) && query) return { goal: task, source: 'fallback', entities: { site: 'Google', search_query: query, target_position: 1 }, stages: [
    stage(1, 'Open Google', { action: 'navigate', url: 'https://www.google.com', verify: 'url' }),
    stage(2, 'Locate the search input', { action: 'read', target: { description: 'Google search input', role: 'textbox' }, verify: 'visible' }),
    stage(3, `Enter exact search query "${query}"`, { action: 'type', target: { description: 'Google search input', role: 'textbox' }, value: query, verify: 'input' }),
    stage(4, 'Submit search', { action: 'click', target: { description: 'Google Search button', role: 'button', text: 'Google Search' }, verify: 'url' }),
    stage(5, 'Verify search results', { action: 'read', target: { description: 'Google search results' }, verify: 'visible' }),
    stage(6, 'Open first actual result', { action: 'click', target: { description: 'first actual search result', role: 'link', position: 1 }, verify: 'url' }),
    stage(7, 'Verify destination opened', { action: 'read', verify: 'url' })
  ] };
  if (/wikipedia/i.test(task) && query) {
    const stages = [
      stage(1, 'Open Wikipedia', { action: 'navigate', url: 'https://en.wikipedia.org', verify: 'url' }),
      stage(2, 'Locate the Wikipedia search input', { action: 'read', target: { description: 'Wikipedia search input', role: 'textbox' }, verify: 'visible' }),
      stage(3, `Enter exact search query "${query}"`, { action: 'type', target: { description: 'Wikipedia search input', role: 'textbox' }, value: query, verify: 'input' }),
      stage(4, 'Run the Wikipedia full-text search', { action: 'navigate', url: `https://en.wikipedia.org/w/index.php?title=Special:Search&search=${encodeURIComponent(query)}&fulltext=1`, verify: 'url' }),
      stage(5, 'Verify Wikipedia search results', { action: 'read', target: { description: 'Wikipedia search results' }, verify: 'visible' })
    ];
    if (openFirst) stages.push(stage(6, 'Open the first Wikipedia result', { action: 'click', target: { description: 'first Wikipedia result', role: 'link', position: 1 }, verify: 'url' }), stage(7, 'Verify the Wikipedia article opened', { action: 'read', verify: 'url' }));
    return { goal: task, source: 'fallback', entities: { site: 'Wikipedia', search_query: query, target_position: openFirst ? 1 : 0 }, stages };
  }
  if (/duckduckgo/i.test(task) && query) {
    const stages = [
      stage(1, 'Open DuckDuckGo', { action: 'navigate', url: 'https://duckduckgo.com', verify: 'url' }),
      stage(2, 'Locate the DuckDuckGo search input', { action: 'read', target: { description: 'DuckDuckGo search input', role: 'textbox' }, verify: 'visible' }),
      stage(3, `Enter exact search query "${query}"`, { action: 'type', target: { description: 'DuckDuckGo search input', role: 'textbox' }, value: query, verify: 'input' }),
      stage(4, 'Submit the DuckDuckGo search', { action: 'click', target: { description: 'DuckDuckGo search button', role: 'button' }, verify: 'url' }),
      stage(5, 'Verify DuckDuckGo search results', { action: 'read', target: { description: 'DuckDuckGo search results' }, verify: 'visible' })
    ];
    if (openFirst) stages.push(stage(6, 'Open the first DuckDuckGo result', { action: 'click', target: { description: 'first DuckDuckGo result', role: 'link', position: 1 }, verify: 'url' }), stage(7, 'Verify destination opened', { action: 'read', verify: 'url' }));
    return { goal: task, source: 'fallback', entities: { site: 'DuckDuckGo', search_query: query, target_position: openFirst ? 1 : 0 }, stages };
  }
  return undefined;
}

function parseModelPlan(content: string, task: string, providerId: AIProviderId): Plan {
  const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = modelPlanSchema.parse(JSON.parse(clean));
  if (parsed.stages.length > 20) throw new Error('Planner exceeded maximum stage count');
  const explicit = extractSearchTerm(task);
  if (explicit && !parsed.entities.search_query) {
    parsed.entities.search_query = explicit;
  }
  const searchValue = String(parsed.entities.search_query ?? '');
  if (explicit && searchValue && searchValue.toLowerCase() !== explicit.toLowerCase()) {
    throw new Error('Planner changed the exact user search query');
  }
  const stages = parsed.stages.map((item, index) => {
    const rawTarget = item.action.target;
    const target = rawTarget
      ? {
          ...rawTarget,
          description: rawTarget.description || rawTarget.ariaLabel || rawTarget.text || item.description || 'element'
        }
      : undefined;
    const action = normalizeAction({ ...item.action, target });
    validateAction(action, task);
    return stage(index + 1, item.description, action);
  });
  if (explicit && !stages.some((item) => item.action.value?.toLowerCase() === explicit.toLowerCase())) {
    throw new Error('Planner omitted an explicit search value');
  }
  return { goal: parsed.goal, entities: parsed.entities, stages, source: providerId };
}

function buildPrompt(task: string): string {
  const explicit = extractSearchTerm(task);
  return `You are a browser-agent planner. Return JSON only, matching this schema:
{
  "goal": string,
  "entities": { ${explicit ? `"search_query": ${JSON.stringify(explicit)}, ` : ''}"site"?: string },
  "stages": [
    {
      "description": string,
      "action": {
        "action": "click" | "type" | "select" | "select_station" | "select_date" | "extract_trains" | "scroll" | "navigate" | "back" | "forward" | "reload" | "wait" | "read" | "download" | "finish",
        "target"?: { "description": string, "text"?: string, "role"?: "button" | "link" | "textbox" | "checkbox" | "radio" | "combobox", "ariaLabel"?: string, "position"?: number },
        "value"?: string,
        "url"?: string,
        "deltaY"?: number,
        "verify"?: "url" | "input" | "checked" | "video-playing" | "download" | "visible" | "none"
      }
    }
  ]
}
Create no more than 20 small, verifiable stages. Never output JavaScript or selectors. Preserve every user-provided quoted value exactly; do not submit a form if prohibited.${explicit ? ` Set entities.search_query to ${JSON.stringify(explicit)} and include a type stage with exact value ${JSON.stringify(explicit)}.` : ''} User task: ${task}`;
}

export async function createPlan(
  task: string,
  provider: AIProvider
): Promise<{ plan: Plan; warning?: string; brainLabel: string }> {
  const brainLabel = `${provider.name} — ${provider.model}`;

  // IRCTC always uses deterministic fallback plan (complex form filling)
  const deterministic = fallbackPlan(task);
  if (deterministic?.entities.workflow === 'irctc') {
    return { plan: deterministic, brainLabel };
  }

  const prompt = buildPrompt(task);

  try {
    const rawResponse = await provider.generatePlan(prompt, task);
    const plan = parseModelPlan(rawResponse, task, provider.id);
    return { plan, brainLabel };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    // Strict: if it's a ProviderError, do NOT silently use fallback —
    // report the real provider failure. Let the caller decide.
    if (error instanceof ProviderError) {
      throw error;
    }

    // For parse errors (LLM output was malformed), use deterministic fallback if available
    const fallback = fallbackPlan(task);
    if (!fallback) {
      throw new Error(
        `${provider.name} planning failed and this task has no safe deterministic fallback. Reason: ${reason}`
      );
    }
    return { plan: fallback, warning: `${provider.name} plan parsing failed, using deterministic fallback: ${reason}`, brainLabel };
  }
}
