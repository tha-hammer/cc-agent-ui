/**
 * SectionAccumulator — streaming markdown structure detector.
 *
 * A 3-state machine that accumulates section metadata from a character
 * stream without touching the DOM. Feed it chunks as they arrive from
 * the WebSocket stream; after the stream completes, call finalize() then
 * getMetadata() for the full section list.
 *
 * Determinism guarantee: same input bytes always produce the same
 * SectionMeta[], whether the input arrives in 1 chunk or 1000.
 */

export interface SectionMeta {
  type:
    | 'heading'
    | 'code'
    | 'table'
    | 'checklist'
    | 'list'
    | 'blockquote'
    | 'hr'
    | 'prose'
    | 'algorithm-phase';
  level?: number;
  title?: string;
  startOffset: number;
  endOffset?: number;
  language?: string;
  lineCount?: number;
}

type State = 'CONTENT' | 'CODE_BLOCK' | 'TABLE_PENDING';

const ALGORITHM_PHASES: Record<string, string> = {
  '━━━ 👁️ OBSERVE': 'Observe',
  '━━━ 👁 OBSERVE': 'Observe',
  '━━━ 🧠 THINK': 'Think',
  '━━━ 📋 PLAN': 'Plan',
  '━━━ 🔨 BUILD': 'Build',
  '━━━ ⚡ EXECUTE': 'Execute',
  '━━━ ✅ VERIFY': 'Verify',
  '━━━ 📚 LEARN': 'Learn',
};

export class SectionAccumulator {
  private state: State = 'CONTENT';
  private pendingLine = '';
  private pendingLineOffset = 0;
  private sections: SectionMeta[] = [];
  private currentOffset = 0;
  private codeBlockLineCount = 0;
  private tableStartOffset = -1;
  private _isAlgorithmMode = false;

  feed(chunk: string): void {
    const buf = this.pendingLine + chunk;
    let lineStart = 0;

    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === '\n') {
        const line = buf.slice(lineStart, i);
        const globalOffset =
          this.currentOffset - this.pendingLine.length + lineStart;
        this.processLine(line, globalOffset);
        lineStart = i + 1;
      }
    }

    const remaining = buf.slice(lineStart);
    this.pendingLineOffset =
      this.currentOffset - this.pendingLine.length + lineStart;
    this.pendingLine = remaining;
    this.currentOffset += chunk.length;
  }

  finalize(): void {
    if (this.pendingLine.length > 0) {
      this.processLine(this.pendingLine, this.pendingLineOffset);
      this.pendingLine = '';
    }

    if (this.sections.length > 0) {
      const last = this.sections[this.sections.length - 1];
      if (last.endOffset === undefined) {
        last.endOffset = this.currentOffset;
      }
    }

    if (this.state === 'CODE_BLOCK') {
      const codeSection = this.findLastOpenCode();
      if (codeSection) {
        codeSection.endOffset = this.currentOffset;
        codeSection.lineCount = this.codeBlockLineCount;
      }
      this.state = 'CONTENT';
    }
  }

  getMetadata(): SectionMeta[] {
    return [...this.sections];
  }

  get isAlgorithmMode(): boolean {
    return this._isAlgorithmMode;
  }

  reset(): void {
    this.state = 'CONTENT';
    this.pendingLine = '';
    this.pendingLineOffset = 0;
    this.sections = [];
    this.currentOffset = 0;
    this.codeBlockLineCount = 0;
    this.tableStartOffset = -1;
    this._isAlgorithmMode = false;
  }

  // ── Internal ──────────────────────────────────────

  private processLine(line: string, offset: number): void {
    if (
      !this._isAlgorithmMode &&
      this.sections.length === 0 &&
      (line.includes('═════════════') || line.includes('ALGORITHM'))
    ) {
      this._isAlgorithmMode = true;
    }

    switch (this.state) {
      case 'CONTENT':
        this.processContentLine(line, offset);
        break;
      case 'CODE_BLOCK':
        this.processCodeBlockLine(line, offset);
        break;
      case 'TABLE_PENDING':
        this.processTablePendingLine(line, offset);
        break;
    }
  }

  private processContentLine(line: string, offset: number): void {
    // Algorithm phase headers (highest priority)
    for (const [prefix, name] of Object.entries(ALGORITHM_PHASES)) {
      if (line.startsWith(prefix)) {
        this.closeLastSection(offset);
        this.sections.push({
          type: 'algorithm-phase',
          title: name,
          startOffset: offset,
        });
        return;
      }
    }

    // Code fence open
    if (line.startsWith('```')) {
      this.closeLastSection(offset);
      const lang = line.slice(3).trim();
      this.codeBlockLineCount = 0;
      this.state = 'CODE_BLOCK';
      this.sections.push({
        type: 'code',
        language: lang || undefined,
        startOffset: offset,
        lineCount: 0,
      });
      return;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      this.closeLastSection(offset);
      this.sections.push({
        type: 'heading',
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        startOffset: offset,
      });
      return;
    }

    // Table row start
    if (line.startsWith('|') && line.includes('|', 1)) {
      if (this.state !== 'TABLE_PENDING') {
        this.tableStartOffset = offset;
        this.state = 'TABLE_PENDING';
      }
      return;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line) && line.trim().length >= 3) {
      this.closeLastSection(offset);
      this.sections.push({ type: 'hr', startOffset: offset });
      return;
    }

    // Checklist items
    if (/^[-*]\s+\[[ xX]\]\s/.test(line)) {
      const last = this.sections.length > 0 ? this.sections[this.sections.length - 1] : null;
      if (!last || last.type !== 'checklist') {
        this.closeLastSection(offset);
        this.sections.push({ type: 'checklist', startOffset: offset });
      }
      return;
    }

    // Unordered list items
    if (/^[-*+]\s+/.test(line) && !/^[-*_]{3,}/.test(line)) {
      const last = this.sections.length > 0 ? this.sections[this.sections.length - 1] : null;
      if (!last || last.type !== 'list') {
        this.closeLastSection(offset);
        this.sections.push({ type: 'list', startOffset: offset });
      }
      return;
    }

    // Ordered list items
    if (/^\d+\.\s+/.test(line)) {
      const last = this.sections.length > 0 ? this.sections[this.sections.length - 1] : null;
      if (!last || last.type !== 'list') {
        this.closeLastSection(offset);
        this.sections.push({ type: 'list', startOffset: offset });
      }
      return;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const last = this.sections.length > 0 ? this.sections[this.sections.length - 1] : null;
      if (!last || last.type !== 'blockquote') {
        this.closeLastSection(offset);
        this.sections.push({ type: 'blockquote', startOffset: offset });
      }
      return;
    }

    // Prose fallback for non-empty lines
    if (line.trim().length > 0) {
      const last = this.sections.length > 0 ? this.sections[this.sections.length - 1] : null;
      if (
        !last ||
        last.type === 'hr' ||
        last.type === 'code' ||
        last.type === 'table'
      ) {
        this.sections.push({ type: 'prose', startOffset: offset });
      }
    }
  }

  private processCodeBlockLine(line: string, offset: number): void {
    if (line.startsWith('```')) {
      const codeSection = this.findLastOpenCode();
      if (codeSection) {
        codeSection.endOffset = offset + line.length;
        codeSection.lineCount = this.codeBlockLineCount;
      }
      this.state = 'CONTENT';
    } else {
      this.codeBlockLineCount++;
    }
  }

  private processTablePendingLine(line: string, offset: number): void {
    if (/^\|[\s-:|]+\|/.test(line) && line.includes('-')) {
      this.closeLastSection(this.tableStartOffset);
      this.sections.push({ type: 'table', startOffset: this.tableStartOffset });
      this.state = 'CONTENT';
      return;
    }

    if (line.startsWith('|') && line.includes('|', 1)) {
      return;
    }

    this.state = 'CONTENT';
    this.processContentLine(line, offset);
  }

  private closeLastSection(beforeOffset: number): void {
    if (this.sections.length > 0) {
      const last = this.sections[this.sections.length - 1];
      if (last.endOffset === undefined) {
        last.endOffset = beforeOffset;
      }
    }
  }

  private findLastOpenCode(): SectionMeta | null {
    for (let i = this.sections.length - 1; i >= 0; i--) {
      if (this.sections[i].type === 'code' && this.sections[i].endOffset === undefined) {
        return this.sections[i];
      }
    }
    return null;
  }
}

export function qualifiesForStructure(
  metadata: SectionMeta[],
  contentLength: number,
): boolean {
  const headingCount = metadata.filter(
    (s) => s.type === 'heading' || s.type === 'algorithm-phase',
  ).length;

  return (
    (headingCount >= 2 && contentLength >= 500) ||
    metadata.some((s) => s.type === 'table') ||
    metadata.some((s) => s.type === 'code' && (s.lineCount ?? 0) > 10)
  );
}
