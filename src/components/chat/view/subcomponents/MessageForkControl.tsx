import { useTranslation } from 'react-i18next';

/**
 * Trigger control rendered next to MessageCopyControl on assistant bubbles.
 * Dispatches a fork request back up through the `onFork` callback prop.
 *
 * V1 scope: assistant messages only, Claude provider only. Rendering is
 * gated by `enabled`; the caller (MessageComponent) derives that from the
 * message + provider combination.
 */
const MessageForkControl = ({
  messageId,
  messageIndex,
  enabled,
  onFork,
}: {
  messageId: string;
  messageIndex: number;
  enabled: boolean;
  onFork: (messageId: string, messageIndex: number) => void;
}) => {
  const { t } = useTranslation('chat');
  if (!enabled) return null;

  const title = t('fork.fork', { defaultValue: 'Fork from this message' });

  return (
    <button
      type="button"
      onClick={() => onFork(messageId, messageIndex)}
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Simple git-fork glyph: upper-right branch splitting from a trunk */}
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="6" cy="6" r="2" />
        <path d="M6 8v8" />
        <path d="M6 8a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6" />
      </svg>
      <span className="text-[10px] font-semibold uppercase tracking-wide">
        {t('fork.forkShort', { defaultValue: 'FORK' })}
      </span>
    </button>
  );
};

export default MessageForkControl;
