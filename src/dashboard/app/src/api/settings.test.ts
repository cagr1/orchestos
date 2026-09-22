import { describe, expect, it } from 'bun:test';
import { mapConfigResponse, mapSettingsKeys, mapUsageByModel, saveConfig } from './settings';

describe('settings API mappers', () => {
  it('maps masked provider keys without inventing configured values', () => {
    expect(mapSettingsKeys({ OPENROUTER_API_KEY: { set: true, masked: 'sk-or-••••1234' } })).toEqual({
      openrouter: { set: true, masked: 'sk-or-••••1234' },
      anthropic: { set: false, masked: '' },
      openai: { set: false, masked: '' },
      ollama: { set: false, masked: '' },
    });
  });

  it('aggregates usage rows by model and preserves real totals', () => {
    expect(mapUsageByModel({
      byDayModel: [
        { date: '2026-09-01', model: 'openrouter/a', usd: 1, runs: 2, inputTokens: 10, outputTokens: 20 },
        { date: '2026-09-02', model: 'openrouter/a', usd: 0.5, runs: 1, inputTokens: 5, outputTokens: 6 },
        { date: '2026-09-02', model: 'openrouter/b', usd: 2, runs: 1, inputTokens: 2, outputTokens: 3 },
      ], totalUsd: 3.5, totalRuns: 4,
    })).toEqual([
      { model: 'openrouter/b', runs: 1, tokens: 5, spend: 2 },
      { model: 'openrouter/a', runs: 3, tokens: 41, spend: 1.5 },
    ]);
  });

  it('keeps GET then PUT routing idempotent with the vanilla payload', async () => {
    const config = {
      source: '/tmp/orchestos.config.yaml',
      configFound: true,
      roles: {
        planner: 'openrouter/anthropic/claude-haiku-4-5',
        executor_heavy: 'openrouter/openai/gpt-4o-mini',
        executor_light: 'openrouter/deepseek/deepseek-v3',
        default: 'openrouter/anthropic/claude-haiku-4-5',
        qa: null,
      },
      pendingRouting: [],
      apiMode: 'single-shot' as const,
      agent: null,
      agenticMaxIterations: 15,
      externalTimeoutMinutes: 20,
      claudeCliDetected: false,
    };
    const normalized = mapConfigResponse(config);
    const requests: Array<{ init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      requests.push({ init });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      await saveConfig({ roles: normalized.roles });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(normalized.roles).toEqual({
      planner: 'anthropic/claude-haiku-4-5',
      executor_heavy: 'openai/gpt-4o-mini',
      executor_light: 'deepseek/deepseek-v3',
      default: 'anthropic/claude-haiku-4-5',
      qa: null,
    });
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ roles: normalized.roles });
  });

  it('round-trips catalog ids that already start with openrouter/ (openrouter/auto)', async () => {
    // El server guarda { provider: 'openrouter', model: 'openrouter/auto' } y el GET devuelve
    // 'openrouter/openrouter/auto': quitar el prefijo una sola vez devuelve el id del catálogo.
    const normalized = mapConfigResponse({
      source: '/tmp/orchestos.config.yaml', configFound: true,
      roles: { planner: 'openrouter/openrouter/auto', executor_heavy: null, executor_light: null, default: null, qa: null },
      pendingRouting: [], apiMode: 'single-shot' as const, agent: null,
      agenticMaxIterations: 15, externalTimeoutMinutes: 20, claudeCliDetected: false,
    });
    expect(normalized.roles.planner).toBe('openrouter/auto');
    const bodies: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => { bodies.push(String(init?.body)); return new Response('{}', { status: 200 }); }) as typeof fetch;
    try { await saveConfig({ roles: { planner: 'openrouter/auto' } }); } finally { globalThis.fetch = originalFetch; }
    expect(JSON.parse(bodies[0])).toEqual({ roles: { planner: 'openrouter/auto' } });
  });
});
