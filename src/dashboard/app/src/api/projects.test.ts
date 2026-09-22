import { describe, expect, test } from 'bun:test';
import { mapProjectRow, mapSessionToAgent, timeSince } from './projects';
import { mapRunRow } from './runs';

describe('projects API mappings', () => {
  test('maps the registered path to a project without inventing branch or files', () => {
    expect(mapProjectRow({ id: 'p1', path: '/work/alpha', stackProfile: 'ts', lastUpdated: 'now' })).toEqual({
      id: 'p1', name: 'alpha', path: '/work/alpha', filesCount: 0, agents: [],
    });
  });

  test('maps pending sessions to active agents and completed sessions to checks', () => {
    const session = { id: 's1', projectId: 'p1', agent: 'codex', mode: 'code' as const, title: 'Build', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:05:00Z' };
    expect(mapSessionToAgent(session, { kind: 'pending' }).status).toBe('active');
    expect(mapSessionToAgent(session, { kind: 'none' }).status).toBe('completed');
  });

  test('maps API runs without inventing a diff', () => {
    const run = mapRunRow({
      id: 'r1', taskId: 'task-1', status: 'done', qaVerdict: 'pass', model: 'codex', provider: 'codex',
      inputTokens: 2, outputTokens: 3, costUsd: null, elapsedMs: 20, engine: 'codex', iterations: 1,
      fileDiffs: [{ path: 'src/a.ts', status: 'modified', diff: '+x' }], costBreakdown: [], contextWarnings: [],
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(run.fileDiffs).toHaveLength(1);
    expect(run.costUsd).toBe(0);
  });
});

describe('timeSince', () => {
  test('measures time since last activity, not session lifetime', () => {
    const now = Date.parse('2026-09-22T12:00:00Z');
    expect(timeSince('2026-09-22T11:43:00Z', now)).toBe('17m');
    expect(timeSince('2026-09-22T10:30:00Z', now)).toBe('1h');
    expect(timeSince('2026-09-18T21:12:15Z', now)).toBe('3d');
  });
});
