import type { AttachmentUploadResult } from '@copilotkit/shared';
import { nolmeFetch } from '../../lib/fetch';

export interface NolmeAttachment {
  filename: string;
  source: { type: 'data'; value: string };
  status: 'ready';
}

interface UploadResponseImage {
  name: string;
  data: string;
  size: number;
  mimeType: string;
}

async function postImages(projectName: string, files: File[]): Promise<UploadResponseImage[]> {
  if (!files.length) return [];
  const form = new FormData();
  for (const f of files) {
    form.append('images', f, f.name);
  }
  const res = await nolmeFetch(`/api/projects/${encodeURIComponent(projectName)}/upload-images`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { images: UploadResponseImage[] };
  return json.images;
}

/**
 * Batch upload helper used by tests + wrappers — returns Nolme-shaped attachment
 * records (matches the legacy donor composer convention).
 */
export function makeUploadAttachmentsHandler(projectName: string) {
  return async function onUpload(files: File[]): Promise<NolmeAttachment[]> {
    const records = await postImages(projectName, files);
    return records.map((r) => ({
      filename: r.name,
      source: { type: 'data' as const, value: r.data },
      status: 'ready' as const,
    }));
  };
}

/**
 * Per-file CopilotKit v2 `AttachmentsConfig.onUpload` handler — receives a
 * single File and returns an `AttachmentUploadResult` ({ type:'data', value,
 * mimeType, metadata? }) that v2 wires into the next outgoing message.
 */
export function makeV2OnUpload(projectName: string) {
  return async function onUpload(file: File): Promise<AttachmentUploadResult> {
    const [record] = await postImages(projectName, [file]);
    if (!record) {
      // Surface as data result with empty value so v2 can decide to drop it; the
      // donor endpoint never returns 200 with empty images, so this is a safety
      // net rather than a real path.
      return { type: 'data', value: '', mimeType: file.type || 'application/octet-stream' };
    }
    return {
      type: 'data',
      value: record.data,
      mimeType: record.mimeType,
      metadata: { filename: record.name, size: record.size },
    };
  };
}
