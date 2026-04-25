/**
 * @gwt.id    gwt-nolme-attachments
 * @rr.reads  rr.nolme.nolme_fetch, rr.nolme.attachment_upload_endpoint
 * @rr.writes rr.nolme.attachment
 * @rr.raises —
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const { nolmeFetchSpy, handleDropSpy, CopilotChatSpy } = vi.hoisted(() => ({
  nolmeFetchSpy: vi.fn(),
  handleDropSpy: vi.fn(),
  CopilotChatSpy: vi.fn(),
}));

vi.mock('../../../src/lib/fetch', () => ({ nolmeFetch: nolmeFetchSpy }));

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChat: (props: Record<string, unknown>) => {
    CopilotChatSpy(props);
    return (
      <div
        data-testid="chat-dropzone"
        onDrop={(props as { onDrop?: (e: React.DragEvent) => void }).onDrop}
      />
    );
  },
  useAttachments: () => ({
    attachments: [],
    enabled: true,
    handleDrop: handleDropSpy,
    consumeAttachments: () => [],
  }),
  useRenderTool: vi.fn(),
  useHumanInTheLoop: vi.fn(),
}));

vi.mock('@copilotkit/react-core', () => ({
  useCopilotChat: () => ({ appendMessage: vi.fn() }),
}));

import { NolmeChat } from '../../../src/components/NolmeChat';
import { NolmeAttachmentQueue } from '../../../src/components/NolmeAttachmentQueue';
import { makeUploadAttachmentsHandler } from '../../../src/components/bindings/useNolmeAttachmentsSubmit';

beforeEach(() => {
  nolmeFetchSpy.mockReset();
  handleDropSpy.mockReset();
  CopilotChatSpy.mockReset();
});

describe('G1 · drop queues attachment via useAttachments.handleDrop', () => {
  it('CopilotChat receives enabled=true attachments config', () => {
    render(<NolmeChat threadId="s-1" projectName="proj" />);
    const props = CopilotChatSpy.mock.calls[0][0];
    expect(props.attachments?.enabled).toBe(true);
    expect(typeof props.attachments?.onUpload).toBe('function');
    expect(props.attachments?.accept).toBe('image/*');
    expect(props.attachments?.maxSize).toBe(5 * 1024 * 1024);
  });
});

describe('G2 · Queue renders + remove works', () => {
  it('renders attachment thumb and calls onRemoveAttachment on × click', () => {
    const spy = vi.fn();
    const attachments = [
      {
        id: 'a1',
        filename: 'venue.png',
        source: { type: 'data' as const, value: 'data:image/png;base64,AAA=' },
        status: 'ready' as const,
      },
    ];
    const { getByTestId, getByLabelText } = render(
      <NolmeAttachmentQueue attachments={attachments} onRemoveAttachment={spy} />,
    );
    expect(getByTestId('attachment-a1')).toBeTruthy();
    fireEvent.click(getByLabelText('Remove venue.png'));
    expect(spy).toHaveBeenCalledWith('a1');
  });
});

describe('G3 · onUpload posts FormData via nolmeFetch and maps base64 response', () => {
  it('POSTs to /api/projects/:projectName/upload-images with FormData(images)', async () => {
    nolmeFetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        images: [
          { name: 'venue.png', data: 'data:image/png;base64,AAA=', size: 3, mimeType: 'image/png' },
        ],
      }),
    });
    const onUpload = makeUploadAttachmentsHandler('proj');
    const file = new File(['x'], 'venue.png', { type: 'image/png' });
    const result = await onUpload([file]);

    expect(nolmeFetchSpy).toHaveBeenCalledWith(
      '/api/projects/proj/upload-images',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const body = nolmeFetchSpy.mock.calls[0][1].body as FormData;
    expect(body.getAll('images').length).toBe(1);

    expect(result).toEqual([
      expect.objectContaining({
        filename: 'venue.png',
        source: { type: 'data', value: 'data:image/png;base64,AAA=' },
        status: 'ready',
      }),
    ]);
  });

  it('returns [] on non-OK response without throwing', async () => {
    nolmeFetchSpy.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'auth' }) });
    const onUpload = makeUploadAttachmentsHandler('proj');
    const file = new File(['x'], 'venue.png', { type: 'image/png' });
    await expect(onUpload([file])).resolves.toEqual([]);
  });

  it('returns [] when no files provided', async () => {
    const onUpload = makeUploadAttachmentsHandler('proj');
    await expect(onUpload([])).resolves.toEqual([]);
    expect(nolmeFetchSpy).not.toHaveBeenCalled();
  });
});
