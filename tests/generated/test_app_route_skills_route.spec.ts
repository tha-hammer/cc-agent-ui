import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import http from 'node:http';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import skillsRouter from '../../server/routes/skills.js';

let server: http.Server;
let port: number;
let tempRoot: string;
let previousSkillDirs: string | undefined;
let previousLegacySkillDirs: string | undefined;
let previousHome: string | undefined;

async function start() {
  const app = express();
  app.use('/api/skills', skillsRouter);
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
}

describe('GET /api/skills', () => {
  beforeEach(async () => {
    previousSkillDirs = process.env.AGENT_SKILLS_DIRS;
    previousLegacySkillDirs = process.env.SKILLS_DIRS;
    previousHome = process.env.HOME;
    tempRoot = await mkdtemp(join(tmpdir(), 'app-route-skills-'));
    process.env.AGENT_SKILLS_DIRS = tempRoot;
    delete process.env.SKILLS_DIRS;

    const skillDir = join(tempRoot, 'research-codebase');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), [
      '---',
      'name: research-codebase',
      'description: Research an external codebase with function-level detail.',
      '---',
      '# Research Codebase',
      '',
      'Trace operation chains through source code.',
      '',
    ].join('\n'), 'utf8');

    await start();
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (previousSkillDirs === undefined) delete process.env.AGENT_SKILLS_DIRS;
    else process.env.AGENT_SKILLS_DIRS = previousSkillDirs;
    if (previousLegacySkillDirs === undefined) delete process.env.SKILLS_DIRS;
    else process.env.SKILLS_DIRS = previousLegacySkillDirs;
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('discovers SKILL.md files from the configured user skill directories', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/skills`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.roots).toEqual([tempRoot]);
    expect(body.skills[0]).toMatchObject({
      id: 'user:research-codebase',
      name: 'research-codebase',
      description: 'Research an external codebase with function-level detail.',
      relativePath: 'research-codebase/SKILL.md',
      source: 'user',
    });
  });

  it('defaults to ~/.claude/skills when no skills directory override is set', async () => {
    delete process.env.AGENT_SKILLS_DIRS;
    delete process.env.SKILLS_DIRS;
    process.env.HOME = tempRoot;

    const claudeSkillsRoot = join(tempRoot, '.claude', 'skills');
    const skillDir = join(claudeSkillsRoot, 'summarize');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), [
      '---',
      'name: summarize',
      'description: Summarize a project session.',
      '---',
      '# Summarize',
      '',
    ].join('\n'), 'utf8');

    const response = await fetch(`http://127.0.0.1:${port}/api/skills`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.roots).toEqual([claudeSkillsRoot]);
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0]).toMatchObject({
      id: 'claude:summarize',
      name: 'summarize',
      description: 'Summarize a project session.',
      relativePath: 'summarize/SKILL.md',
      source: 'claude',
    });
  });
});
