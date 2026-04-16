// G-1: canonical path encoding per Claude Agent SDK docs
// SDK rule: "every non-alphanumeric character replaced by '-'"

import { describe, it, expect } from 'vitest';
import { encodeProjectPath } from '../../server/projects.js';

describe('encodeProjectPath — SDK canonical rule', () => {
  it('replaces dot with dash', () => {
    expect(encodeProjectPath('/home/maceo/Dev/my.project')).toBe('-home-maceo-Dev-my-project');
  });

  it('replaces parens with dash', () => {
    expect(encodeProjectPath('/a/b(1)/c')).toBe('-a-b-1--c');
  });

  it('replaces square brackets with dash', () => {
    expect(encodeProjectPath('/a/b[2]/c')).toBe('-a-b-2--c');
  });

  it('replaces every non-alphanumeric ASCII character', () => {
    const encoded = encodeProjectPath('/foo/!@#$%&*=+?,;.bar');
    expect(encoded).toMatch(/^[a-zA-Z0-9-]+$/);
  });

  it('preserves alphanumeric chars', () => {
    expect(encodeProjectPath('/abc123XYZ')).toBe('-abc123XYZ');
  });
});

describe('encodeProjectPath — regression (existing paths unchanged)', () => {
  it.each([
    ['/home/maceo/Dev/temp_testing', '-home-maceo-Dev-temp-testing'],
    ['/Users/me/proj', '-Users-me-proj'],
    ['/home/maceo/Dev/cosmic-agent-memory', '-home-maceo-Dev-cosmic-agent-memory'],
    ['/home/maceo/Dev/claude-code', '-home-maceo-Dev-claude-code'],
  ])('path %s encodes to %s', (input, expected) => {
    expect(encodeProjectPath(input)).toBe(expected);
  });
});
