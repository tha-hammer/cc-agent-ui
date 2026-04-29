import express from 'express';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { parseFrontmatter } from '../utils/frontmatter.js';

const router = express.Router();
const SKILL_FILE_NAME = 'SKILL.md';

function configuredSkillRoots() {
  const configured = process.env.AGENT_SKILLS_DIRS || process.env.SKILLS_DIRS;
  if (configured) {
    return configured
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => path.resolve(entry));
  }

  const home = os.homedir();
  return [
    path.join(home, '.codex', 'skills'),
    path.join(home, '.agents', 'skills'),
    path.join(home, '.claude', 'skills'),
    path.join(home, 'skills'),
  ];
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findSkillFiles(root, depth = 0, maxDepth = 4) {
  if (depth > maxDepth || !(await pathExists(root))) {
    return [];
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const skillPath = entries.some((entry) => entry.isFile() && entry.name === SKILL_FILE_NAME)
    ? path.join(root, SKILL_FILE_NAME)
    : null;
  const nested = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    nested.push(...await findSkillFiles(path.join(root, entry.name), depth + 1, maxDepth));
  }

  return skillPath ? [skillPath, ...nested] : nested;
}

function sourceLabel(root) {
  const home = os.homedir();
  if (root.startsWith(path.join(home, '.codex'))) return 'codex';
  if (root.startsWith(path.join(home, '.agents'))) return 'agents';
  if (root.startsWith(path.join(home, '.claude'))) return 'claude';
  return 'user';
}

async function readSkill(skillPath, root) {
  const content = await fs.readFile(skillPath, 'utf8');
  const { data, content: body } = parseFrontmatter(content);
  const dirName = path.basename(path.dirname(skillPath));
  const firstHeading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const name = String(data.name ?? firstHeading ?? dirName).trim();
  const description = String(data.description ?? body.trim().split('\n').find(Boolean) ?? '').trim();

  return {
    id: `${sourceLabel(root)}:${path.relative(root, path.dirname(skillPath)).replace(/\\/g, '/') || dirName}`,
    name,
    description,
    path: skillPath,
    relativePath: path.relative(root, skillPath).replace(/\\/g, '/'),
    source: sourceLabel(root),
  };
}

router.get('/', async (_req, res) => {
  try {
    const roots = configuredSkillRoots();
    const skills = [];

    for (const root of roots) {
      const skillFiles = await findSkillFiles(root);
      for (const skillPath of skillFiles) {
        try {
          skills.push(await readSkill(skillPath, root));
        } catch (error) {
          console.error(`[skills] failed to read ${skillPath}:`, error);
        }
      }
    }

    skills.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ skills, count: skills.length, roots });
  } catch (error) {
    console.error('[skills] failed to list skills:', error);
    res.status(500).json({ error: 'Failed to list skills', message: error.message });
  }
});

export default router;
