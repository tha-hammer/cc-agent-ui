/**
 * StructuredMessage — self-contained component that analyzes assistant
 * message content and renders it as a horizontal layout (Grid/Tabs/Cards)
 * when it qualifies, with a toggle to switch back to single-column markdown.
 *
 * Drop-in replacement: wrap any <Markdown>{content}</Markdown> with
 * <StructuredMessage content={content}><Markdown>...</Markdown></StructuredMessage>
 */

import React, { useState, useMemo } from 'react';
import { SectionAccumulator, qualifiesForStructure } from '../../../../utils/SectionAccumulator';
import { sectionsToPrefab, type ComponentNode } from '../../../../utils/sectionsToPrefab';
import { Markdown } from './Markdown';

// ── Lightweight layout components (Tailwind-based) ──────

function LayoutGrid({ columns, minColumnWidth, children }: {
  columns?: number;
  minColumnWidth?: string;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = minColumnWidth
    ? { gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}, 1fr))` }
    : { gridTemplateColumns: `repeat(${columns ?? 2}, 1fr)` };

  return (
    <div className="grid gap-4 w-full" style={style}>
      {children}
    </div>
  );
}

function LayoutCard({ title, summary, children }: {
  title?: string;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </h3>
          {summary && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {summary}
            </p>
          )}
        </div>
      )}
      <div className="px-4 py-3 overflow-auto max-h-[600px]">
        {children}
      </div>
    </div>
  );
}

function LayoutTabs({ tabs, defaultValue }: {
  tabs: { value: string; title: string; content: React.ReactNode }[];
  defaultValue?: string;
}) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value);

  return (
    <div className="w-full">
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors
              ${active === tab.value
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tabs.find((t) => t.value === active)?.content}
      </div>
    </div>
  );
}

// ── ComponentNode → React renderer ──────────────────

function RenderNode({ node }: { node: ComponentNode }): React.ReactElement | null {
  switch (node.type) {
    case 'Tabs': {
      const tabs = (node.children ?? []).map((child) => ({
        value: String(child.props?.value ?? ''),
        title: String(child.props?.title ?? child.props?.value ?? ''),
        content: (
          <div>
            {(child.children ?? []).map((grandchild, i) => (
              <RenderNode key={i} node={grandchild} />
            ))}
          </div>
        ),
      }));
      return (
        <LayoutTabs
          tabs={tabs}
          defaultValue={String(node.props?.defaultValue ?? '')}
        />
      );
    }

    case 'Grid':
      return (
        <LayoutGrid
          columns={node.props?.columns as number | undefined}
          minColumnWidth={node.props?.minColumnWidth as string | undefined}
        >
          {(node.children ?? []).map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </LayoutGrid>
      );

    case 'Card': {
      const header = node.children?.find((c) => c.type === 'CardHeader');
      const titleNode = header?.children?.find((c) => c.type === 'CardTitle');
      const descNode = node.children?.find((c) => c.type === 'CardDescription');
      const contentNode = node.children?.find((c) => c.type === 'CardContent');
      return (
        <LayoutCard
          title={titleNode?.text}
          summary={descNode?.text}
        >
          {contentNode?.children?.map((child, i) => (
            <RenderNode key={i} node={child} />
          )) ?? null}
        </LayoutCard>
      );
    }

    case 'Markdown':
      return (
        <Markdown className="prose prose-sm max-w-none dark:prose-invert">
          {node.text ?? ''}
        </Markdown>
      );

    case 'Tab':
      return null;

    default:
      if (node.text) {
        return <span>{node.text}</span>;
      }
      return (
        <>
          {(node.children ?? []).map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </>
      );
  }
}

// ── View Toggle ─────────────────────────────────────

function ViewToggle({ mode, onToggle }: {
  mode: 'structured' | 'raw';
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 p-0.5">
      <button
        onClick={mode !== 'structured' ? onToggle : undefined}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          mode === 'structured'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
        }`}
      >
        Structured
      </button>
      <button
        onClick={mode !== 'raw' ? onToggle : undefined}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          mode === 'raw'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
        }`}
      >
        Raw
      </button>
    </div>
  );
}

// ── Main Component ──────────────────────────────────

interface StructuredMessageWrapperProps {
  content: string;
  children: React.ReactNode; // The original <Markdown> element as fallback
}

/**
 * Self-contained wrapper. Analyzes content via SectionAccumulator
 * on mount. If the content qualifies for structured layout, renders
 * Grid/Tabs/Cards with a toggle. Otherwise renders children as-is.
 */
export default function StructuredMessageWrapper({
  content,
  children,
}: StructuredMessageWrapperProps) {
  const [renderMode, setRenderMode] = useState<'structured' | 'raw'>('structured');

  const analysis = useMemo(() => {
    if (!content || content.length < 500) return null;

    const acc = new SectionAccumulator();
    acc.feed(content);
    acc.finalize();
    const sections = acc.getMetadata();

    if (!qualifiesForStructure(sections, content.length)) return null;

    return {
      sections,
      tree: sectionsToPrefab(sections, content),
    };
  }, [content]);

  // Doesn't qualify — render children (original Markdown) unchanged
  if (!analysis) {
    return <>{children}</>;
  }

  return (
    <div className="w-full">
      <div className="flex justify-end mb-3">
        <ViewToggle
          mode={renderMode}
          onToggle={() => setRenderMode((m) => (m === 'structured' ? 'raw' : 'structured'))}
        />
      </div>

      {renderMode === 'structured' ? (
        <RenderNode node={analysis.tree} />
      ) : (
        children
      )}
    </div>
  );
}
