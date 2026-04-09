/**
 * sectionsToPrefab — transforms SectionMeta[] + content into a
 * ComponentNode tree for structured horizontal layout.
 *
 * Pure function: same input always produces same output.
 */

import type { SectionMeta } from './SectionAccumulator';

export interface ComponentNode {
  type: string;
  props?: Record<string, unknown>;
  children?: ComponentNode[];
  text?: string;
}

export function sectionsToPrefab(
  sections: SectionMeta[],
  content: string,
): ComponentNode {
  const phases = sections.filter((s) => s.type === 'algorithm-phase');
  if (phases.length >= 2) {
    return buildAlgorithmLayout(phases, sections, content);
  }

  const h1s = sections.filter((s) => s.type === 'heading' && s.level === 1);

  if (h1s.length >= 3) {
    return buildTabsLayout(h1s, sections, content);
  }

  if (h1s.length === 2) {
    return buildTwoColumnLayout(h1s, content);
  }

  const h2s = sections.filter((s) => s.type === 'heading' && s.level === 2);
  if (h2s.length >= 2) {
    return buildGridLayout(h2s, content);
  }

  return buildSingleCard(sections, content);
}

// ── Algorithm Layout ────────────────────────────────

const PHASE_ICONS: Record<string, string> = {
  Observe: '👁️',
  Think: '🧠',
  Plan: '📋',
  Build: '🔨',
  Execute: '⚡',
  Verify: '✅',
  Learn: '📚',
};

function buildAlgorithmLayout(
  phases: SectionMeta[],
  allSections: SectionMeta[],
  content: string,
): ComponentNode {
  const tabs = phases.map((phase, i) => {
    const nextPhase = phases[i + 1];
    const phaseEnd = nextPhase ? nextPhase.startOffset : content.length;
    const phaseContent = content.slice(phase.startOffset, phaseEnd);

    const phaseSections = allSections.filter(
      (s) =>
        s !== phase &&
        s.startOffset >= phase.startOffset &&
        s.startOffset < phaseEnd,
    );

    const icon = PHASE_ICONS[phase.title ?? ''] ?? '';
    const title = `${icon} ${phase.title}`;

    return {
      type: 'Tab' as const,
      props: { value: phase.title, title },
      children: buildPhaseContent(phaseSections, phaseContent, phase.startOffset),
    };
  });

  return {
    type: 'Tabs',
    props: { defaultValue: phases[0]?.title },
    children: tabs,
  };
}

// ── Standard Layouts ────────────────────────────────

function buildTabsLayout(
  h1s: SectionMeta[],
  allSections: SectionMeta[],
  content: string,
): ComponentNode {
  const tabs = h1s.map((h1, i) => {
    const nextH1 = h1s[i + 1];
    const sectionEnd = nextH1 ? nextH1.startOffset : content.length;
    const sectionContent = content.slice(h1.startOffset, sectionEnd);

    const childSections = allSections.filter(
      (s) =>
        s !== h1 &&
        s.startOffset >= h1.startOffset &&
        s.startOffset < sectionEnd,
    );

    return {
      type: 'Tab' as const,
      props: { value: h1.title, title: h1.title },
      children: buildPhaseContent(childSections, sectionContent, h1.startOffset),
    };
  });

  return {
    type: 'Tabs',
    props: { defaultValue: h1s[0]?.title },
    children: tabs,
  };
}

function buildTwoColumnLayout(h1s: SectionMeta[], content: string): ComponentNode {
  const cards = h1s.map((h1, i) => {
    const nextH1 = h1s[i + 1];
    const sectionEnd = nextH1 ? nextH1.startOffset : content.length;
    return buildCard(h1.title ?? `Section ${i + 1}`, content.slice(h1.startOffset, sectionEnd));
  });

  return { type: 'Grid', props: { columns: 2 }, children: cards };
}

function buildGridLayout(headings: SectionMeta[], content: string): ComponentNode {
  const cards = headings.map((h, i) => {
    const nextH = headings[i + 1];
    const sectionEnd = nextH ? nextH.startOffset : content.length;
    return buildCard(h.title ?? `Section ${i + 1}`, content.slice(h.startOffset, sectionEnd));
  });

  return { type: 'Grid', props: { columns: 2, minColumnWidth: '320px' }, children: cards };
}

function buildSingleCard(sections: SectionMeta[], content: string): ComponentNode {
  const title = sections.find((s) => s.type === 'heading')?.title ?? 'Response';
  return buildCard(title, content);
}

// ── Helpers ─────────────────────────────────────────

function buildCard(title: string, content: string): ComponentNode {
  const summary =
    content.length > 1000
      ? content.slice(0, 120).replace(/\s+\S*$/, '') + '...'
      : undefined;

  return {
    type: 'Card',
    children: [
      {
        type: 'CardHeader',
        children: [{ type: 'CardTitle', text: title }],
      },
      ...(summary ? [{ type: 'CardDescription', text: summary }] : []),
      {
        type: 'CardContent',
        children: [{ type: 'Markdown', text: content }],
      },
    ],
  };
}

function buildPhaseContent(
  sections: SectionMeta[],
  phaseContent: string,
  baseOffset: number,
): ComponentNode[] {
  const h2s = sections.filter((s) => s.type === 'heading' && s.level === 2);

  if (h2s.length >= 2) {
    const cards = h2s.map((h2, i) => {
      const nextH2 = h2s[i + 1];
      const sectionEnd = nextH2
        ? nextH2.startOffset - baseOffset
        : phaseContent.length;
      const sectionStart = h2.startOffset - baseOffset;
      const text = phaseContent.slice(sectionStart, sectionEnd);
      return buildCard(h2.title ?? `Section ${i + 1}`, text);
    });

    return [
      {
        type: 'Grid',
        props: { columns: 2, minColumnWidth: '320px' },
        children: cards,
      },
    ];
  }

  return [{ type: 'Markdown', text: phaseContent }];
}
