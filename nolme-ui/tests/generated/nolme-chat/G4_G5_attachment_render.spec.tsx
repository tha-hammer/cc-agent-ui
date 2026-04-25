/**
 * @gwt.id    gwt-nolme-attachments
 * @rr.reads  rr.nolme.attachment
 * @rr.writes —
 * @rr.raises —
 *
 * Submission is owned by the framework via `onSubmitMessage` (passed to
 * NolmeComposer through the chatView slot). G4 is a structural anti-criterion:
 * NolmeComposer MUST NOT introduce markdown URL injection or any custom
 * onSubmitMessage handler that mutates content. G5 is unchanged — the
 * attachment renderer still owns its data-URI render path.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NolmeAttachmentQueue } from '../../../src/components/NolmeAttachmentQueue';

vi.mock('../../../src/hooks/useCcuSessionState', () => ({
  useCcuSessionState: () => ({
    binding: { provider: 'claude', sessionId: 's-1', projectName: 'p', projectPath: '/x', model: 'opus-4-7' },
    updateBinding: vi.fn(),
  }),
}));

describe('G4 · NolmeComposer does NOT inject markdown URLs into submitted content', () => {
  it('NolmeComposer source carries no markdown image URL composition or appendMessage call', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/NolmeComposer.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/!\[/);
    expect(src).not.toMatch(/data:image\//);
    expect(src).not.toMatch(/appendMessage\(/);
  });

  it('NolmeChatView source carries no markdown URL injection or appendMessage call', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/NolmeChatView.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/!\[/);
    expect(src).not.toMatch(/data:image\//);
    expect(src).not.toMatch(/appendMessage\(/);
  });

  it('NolmeChat configures attachments via v2 native AttachmentsConfig (no manual content injection)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/NolmeChat.tsx'),
      'utf8',
    );
    expect(src).toMatch(/attachments=\{attachmentsConfig\}/);
    expect(src).toMatch(/onUpload:\s*makeV2OnUpload/);
    expect(src).not.toMatch(/appendMessage\(/);
  });
});

describe('G5 · data-URI attachment renders via <img src="data:...">', () => {
  it('NolmeAttachmentQueue produces an <img> with the data: URI as src', () => {
    const attachments = [
      {
        id: 'a1',
        filename: 'venue.png',
        source: { type: 'data' as const, value: 'data:image/png;base64,AAA=' },
        status: 'ready' as const,
      },
    ];
    const { getByTestId } = render(
      <NolmeAttachmentQueue attachments={attachments} onRemoveAttachment={vi.fn()} />,
    );
    const tile = getByTestId('attachment-a1');
    const img = tile.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA=');
    expect(img.getAttribute('alt')).toBe('venue.png');
  });
});
