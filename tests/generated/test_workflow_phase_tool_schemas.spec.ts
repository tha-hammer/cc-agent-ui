import { describe, it, expect } from 'vitest';
import { WORKFLOW_PHASE_TOOLS } from '../../server/tools/workflow-phase-tools.js';

describe('WORKFLOW_PHASE_TOOLS (Phase 1 · B7)', () => {
  it('exports exactly three tools: setPhaseState, advancePhase, addResource', () => {
    const names = WORKFLOW_PHASE_TOOLS.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(['addResource', 'advancePhase', 'setPhaseState']);
  });

  it('each tool has name, description, parameters', () => {
    for (const tool of WORKFLOW_PHASE_TOOLS) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('parameters');
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('setPhaseState requires phases array with {id, label, title, status}', () => {
    const tool = WORKFLOW_PHASE_TOOLS.find((t: { name: string }) => t.name === 'setPhaseState');
    expect(tool).toBeDefined();
    const params = tool!.parameters as any;
    expect(params.type).toBe('object');
    expect(params.required).toContain('phases');
    const phaseItem = params.properties.phases.items;
    expect(phaseItem.required).toEqual(expect.arrayContaining(['id', 'label', 'title', 'status']));
    expect(phaseItem.properties.status.enum).toEqual(['idle', 'active', 'complete']);
  });

  it('advancePhase requires phaseId string', () => {
    const tool = WORKFLOW_PHASE_TOOLS.find((t: { name: string }) => t.name === 'advancePhase');
    expect(tool).toBeDefined();
    const params = tool!.parameters as any;
    expect(params.required).toContain('phaseId');
    expect(params.properties.phaseId.type).toBe('string');
  });

  it('addResource requires {badge, title, subtitle, tone, action}', () => {
    const tool = WORKFLOW_PHASE_TOOLS.find((t: { name: string }) => t.name === 'addResource');
    expect(tool).toBeDefined();
    const params = tool!.parameters as any;
    const required = params.required as string[];
    expect(required).toEqual(expect.arrayContaining(['badge', 'title', 'subtitle', 'tone', 'action']));
    expect(params.properties.badge.enum).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(params.properties.tone.enum).toEqual(['emerald', 'iris', 'gold']);
    expect(params.properties.action.enum).toEqual(['download', 'link']);
  });
});
