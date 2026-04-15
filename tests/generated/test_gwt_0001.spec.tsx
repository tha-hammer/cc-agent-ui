// gwt-0001: fork.pane.passes-index-and-onfork
// Verifies that ChatMessagesPane passes messageIndex=i and onFork to each
// MessageComponent render. Verifiers:
//   - IndexFidelity
//   - CallbackIdentity
//   - PropAdditivity
//   - NoSideEffects
//   - RenderCompleteness

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock MessageComponent with a spy that records props
vi.mock('../../src/components/chat/view/subcomponents/MessageComponent', () => ({
  default: vi.fn(() => null),
}));

import ChatMessagesPane from '../../src/components/chat/view/subcomponents/ChatMessagesPane';
import MessageComponent from '../../src/components/chat/view/subcomponents/MessageComponent';

describe('gwt-0001 fork.pane.passes-index-and-onfork', () => {
  it('passes messageIndex=i and onFork reference to each rendered MessageComponent', () => {
    (MessageComponent as any).mockClear?.();
    const onFork = vi.fn();
    const visibleMessages = [
      { id: 'm0', type: 'user', content: 'hi', timestamp: new Date() },
      { id: 'm1', type: 'assistant', content: 'hello', timestamp: new Date() },
      { id: 'm2', type: 'assistant', content: 'again', timestamp: new Date() },
    ];
    const before = [...visibleMessages];

    render(
      <ChatMessagesPane
        scrollContainerRef={{ current: null } as any}
        onWheel={() => {}}
        onTouchMove={() => {}}
        isLoadingSessionMessages={false}
        chatMessages={visibleMessages as any}
        selectedSession={null}
        currentSessionId={'sid'}
        provider={'claude' as any}
        setProvider={() => {}}
        textareaRef={{ current: null } as any}
        claudeModel=""
        setClaudeModel={() => {}}
        cursorModel=""
        setCursorModel={() => {}}
        codexModel=""
        setCodexModel={() => {}}
        geminiModel=""
        setGeminiModel={() => {}}
        tasksEnabled={false}
        isTaskMasterInstalled={null}
        setInput={() => {}}
        isLoadingMoreMessages={false}
        hasMoreMessages={false}
        totalMessages={3}
        sessionMessagesCount={3}
        visibleMessageCount={3}
        visibleMessages={visibleMessages as any}
        loadEarlierMessages={() => {}}
        loadAllMessages={() => {}}
        allMessagesLoaded={false}
        isLoadingAllMessages={false}
        loadAllJustFinished={false}
        showLoadAllOverlay={false}
        createDiff={() => []}
        onFileOpen={() => {}}
        onShowSettings={() => {}}
        onGrantToolPermission={() => ({ success: true })}
        autoExpandTools={false}
        showRawParameters={false}
        showThinking={false}
        selectedProject={{ name: 'p', displayName: 'p', fullPath: '/p', path: '/p' } as any}
        isLoading={false}
        onFork={onFork}
      />
    );

    const calls = (MessageComponent as any).mock.calls;
    // RenderCompleteness
    expect(calls.length).toBe(3);
    calls.forEach(([props]: any[], i: number) => {
      // IndexFidelity
      expect(props.messageIndex).toBe(i);
      // CallbackIdentity
      expect(props.onFork).toBe(onFork);
      // PropAdditivity — pre-existing props still threaded
      expect(props.message).toBe(visibleMessages[i]);
      expect(props.provider).toBe('claude');
      // selectedProject preserved
      expect(props.selectedProject).toBeDefined();
    });

    // NoSideEffects — input array not mutated
    expect(visibleMessages).toEqual(before);
  });
});
