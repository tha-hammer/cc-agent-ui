import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  FileSpreadsheet,
  FileText,
  Link2,
  ListChecks,
  MessageCircle,
  Package,
  Plus,
  Search,
  Settings,
  Square,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import './NolmeAppRoute.css';

type NolmeView = 'send-working' | 'questions' | 'working' | 'artifact';

type ChatMessage = {
  id: string;
  body: string;
  timestamp: string;
};

type Deliverable = {
  id: string;
  title: string;
  edited: string;
  icon: LucideIcon;
  tone: 'document' | 'sheet' | 'link';
  isNew?: boolean;
};

const FIRST_PROMPT =
  'Can you do a create a list that reaches an audience outside of the SF Bay area from our data we provided and consider venue location now?';

const ANSWER_PROMPT = '15 mile radius outside the San Francisco Bay Area.';

const QUESTION_OPTIONS = ['5 mile radius', '10 mile radius', '20 mile radius', 'Other (describe below)'];

const BASE_DELIVERABLES: Deliverable[] = [
  {
    id: 'outline',
    title: 'Outline document',
    edited: 'last edited: 5/15/2026',
    icon: FileText,
    tone: 'document',
  },
  {
    id: 'audience',
    title: 'Audience spreadsheet',
    edited: 'last edited: 5/16/2026',
    icon: FileSpreadsheet,
    tone: 'sheet',
  },
  {
    id: 'venues',
    title: 'Venue database',
    edited: 'last edited: 5/16/2026',
    icon: FileSpreadsheet,
    tone: 'sheet',
  },
];

const NAV_ITEMS: Array<{ label: string; icon: LucideIcon; active?: boolean }> = [
  { label: 'Search', icon: Search },
  { label: 'Chat', icon: MessageCircle, active: true },
  { label: 'Audience', icon: Users },
  { label: 'Tasks', icon: ListChecks },
  { label: 'Settings', icon: Settings },
];

export default function NolmeAppRoute() {
  const [view, setView] = useState<NolmeView>('send-working');
  const [selectedOption, setSelectedOption] = useState('Other (describe below)');
  const [customRadius, setCustomRadius] = useState('15 miles radius outside the Bay Area');

  useEffect(() => {
    if (view !== 'working') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setView('artifact'), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [view]);

  const messages = useMemo<ChatMessage[]>(() => {
    const rows: ChatMessage[] = [
      {
        id: 'prompt',
        body: view === 'send-working'
          ? 'Can you do a deeper analysis of the audience and venue so that I am able to reach the full potential of attendees within the Bay Area.'
          : FIRST_PROMPT,
        timestamp: 'May 20, 4:20pm',
      },
    ];

    if (view === 'working' || view === 'artifact') {
      rows.push({
        id: 'radius',
        body: ANSWER_PROMPT,
        timestamp: 'May 20, 4:22pm',
      });
    }

    return rows;
  }, [view]);

  const thinkingLabel =
    view === 'send-working'
      ? 'Populated questions to ensure properly taking on task...'
      : view === 'working'
        ? 'Gathering people in a 15 mile radius...'
        : null;

  const progress = view === 'send-working' ? 82 : 85;

  return (
    <div className="nolme-app" data-node-id="nolme-app-route">
      <NavPanel />

      <main className="nolme-app__chat-stream" aria-label="Nolme chat stream">
        <div className="nolme-app__messages">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} compact={message.id === 'radius'} />
          ))}

          {view === 'artifact' && <ArtifactResponse />}

          {thinkingLabel && <ThinkingRow label={thinkingLabel} />}
        </div>

        <div className="nolme-app__input-zone">
          {view === 'questions' ? (
            <QuestionCard
              selectedOption={selectedOption}
              customRadius={customRadius}
              onSelectOption={setSelectedOption}
              onCustomRadiusChange={setCustomRadius}
              onSkip={() => setView('send-working')}
              onContinue={() => setView('working')}
            />
          ) : (
            <Composer
              isWorking={view === 'working'}
              progress={progress}
              onAskQuestions={() => setView('questions')}
              onStartPhase={() => setView('working')}
              onShowArtifact={() => setView('artifact')}
            />
          )}
        </div>
      </main>

      <RightPanel hasArtifact={view === 'artifact'} />
    </div>
  );
}

function NavPanel() {
  return (
    <aside className="nolme-app__nav-panel" aria-label="Nolme app navigation">
      <div className="nolme-app__logo-wrap">
        <div className="nolme-app__logo-mark" aria-label="Nolme">
          N
        </div>
      </div>

      <div className="nolme-app__nav-content">
        <nav className="nolme-app__nav-menu" aria-label="Primary">
          {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              type="button"
              className={cn('nolme-app__nav-button', active && 'nolme-app__nav-button--active')}
              aria-label={label}
              title={label}
            >
              <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
            </button>
          ))}
        </nav>

        <div className="nolme-app__nav-footer">
          <div className="nolme-app__avatar nolme-app__avatar--user" aria-label="Cindy M">
            CM
          </div>
        </div>
      </div>
    </aside>
  );
}

function ChatBubble({ message, compact = false }: { message: ChatMessage; compact?: boolean }) {
  return (
    <div className="nolme-app__bubble-row">
      <article className={cn('nolme-app__chat-bubble', compact && 'nolme-app__chat-bubble--compact')}>
        <p>{message.body}</p>
        <footer>
          <span>{message.timestamp}</span>
          <span>Delivered</span>
        </footer>
      </article>
    </div>
  );
}

function ThinkingRow({ label }: { label: string }) {
  return (
    <div className="nolme-app__thinking-row" role="status" aria-live="polite">
      <AgentAvatar />
      <span>{label}</span>
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="nolme-app__agent-avatar" aria-label="Aria">
      A
    </div>
  );
}

function QuestionCard({
  selectedOption,
  customRadius,
  onSelectOption,
  onCustomRadiusChange,
  onSkip,
  onContinue,
}: {
  selectedOption: string;
  customRadius: string;
  onSelectOption: (option: string) => void;
  onCustomRadiusChange: (value: string) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="nolme-app__question-card" aria-label="Clarifying question">
      <div className="nolme-app__question-copy">
        <p>Before I proceed, I&apos;d like to clarify a few things:</p>
        <h2>How much distance outside the Bay Area did you want to apply:</h2>
      </div>

      <div className="nolme-app__question-options" role="radiogroup" aria-label="Distance outside the Bay Area">
        {QUESTION_OPTIONS.map((option, index) => {
          const selected = selectedOption === option;

          return (
            <div key={option}>
              <button
                type="button"
                className="nolme-app__option-row"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelectOption(option)}
              >
                <span className={cn('nolme-app__checkbox', selected && 'nolme-app__checkbox--selected')}>
                  {selected && <Check aria-hidden="true" size={12} strokeWidth={2.4} />}
                </span>
                <span>{option}</span>
              </button>
              {index < QUESTION_OPTIONS.length - 1 && <Divider />}
            </div>
          );
        })}

        <label className="nolme-app__field-label">
          <span className="sr-only">Custom distance</span>
          <input
            value={customRadius}
            onChange={(event) => onCustomRadiusChange(event.target.value)}
            onFocus={() => onSelectOption('Other (describe below)')}
          />
        </label>
      </div>

      <div className="nolme-app__question-cta">
        <button type="button" className="nolme-app__text-action" onClick={onSkip}>
          Skip for now
        </button>
        <button type="button" className="nolme-app__primary-button" onClick={onContinue}>
          Continue
        </button>
      </div>
    </section>
  );
}

function Composer({
  isWorking,
  progress,
  onAskQuestions,
  onStartPhase,
  onShowArtifact,
}: {
  isWorking: boolean;
  progress: number;
  onAskQuestions: () => void;
  onStartPhase: () => void;
  onShowArtifact: () => void;
}) {
  return (
    <section className="nolme-app__composer" aria-label="Message composer">
      <div className="nolme-app__composer-toolbar">
        <div className="nolme-app__agent-details">
          <div className="nolme-app__agent-profile">
            <AgentAvatar />
            <span>Aria - Community Lead Specialist</span>
          </div>
          <div className="nolme-app__progress-row">
            <div className="nolme-app__progress-track" aria-label={`${progress}% used`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <strong>{progress}% used</strong>
          </div>
        </div>

        <div className="nolme-app__quick-actions" aria-label="Quick actions">
          <button type="button" onClick={onAskQuestions}>
            Bring up any blockers
          </button>
          <button type="button" onClick={onShowArtifact}>
            Do a pre audit
          </button>
          <button type="button" onClick={onStartPhase}>
            Start Phase 1
          </button>
        </div>
      </div>

      <div className="nolme-app__input-field">
        <textarea placeholder="Type your response..." aria-label="Type your response" />

        <div className="nolme-app__input-status">
          <div className="nolme-app__input-left">
            <button type="button" className="nolme-app__icon-button" aria-label="Attach file" title="Attach file">
              <Plus aria-hidden="true" size={24} strokeWidth={1.8} />
            </button>
            <button type="button" className="nolme-app__model-pill" aria-label="Selected model Opus 4.7">
              Opus 4.7
              <ChevronDown aria-hidden="true" size={12} strokeWidth={2} />
            </button>
          </div>

          <div className="nolme-app__input-right">
            <span>0 tokens (est)</span>
            {isWorking && (
              <button type="button" className="nolme-app__stop-button" aria-label="Stop generation" title="Stop generation">
                <Square aria-hidden="true" size={12} fill="currentColor" strokeWidth={0} />
              </button>
            )}
            <button type="button" className="nolme-app__send-button" disabled>
              {isWorking ? 'Working...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function RightPanel({ hasArtifact }: { hasArtifact: boolean }) {
  const deliverables = useMemo<Deliverable[]>(() => {
    if (!hasArtifact) {
      return BASE_DELIVERABLES;
    }

    return [
      ...BASE_DELIVERABLES.map((deliverable) => ({
        ...deliverable,
        edited: deliverable.edited.replace('last edited', 'last'),
      })),
      {
        id: 'luma',
        title: 'Luma - Curated venue list',
        edited: 'last: just now',
        icon: Link2,
        tone: 'link',
        isNew: true,
      },
    ];
  }, [hasArtifact]);

  return (
    <aside className="nolme-app__right-panel" aria-label="Phases and deliverables">
      <section className="nolme-app__phase-section">
        <div className="nolme-app__section-header">
          <Workflow aria-hidden="true" size={24} strokeWidth={1.8} />
          <h2>Phases</h2>
          <button type="button">Edit</button>
        </div>

        <div className="nolme-app__phase-pills">
          <Pill label="P1: Audience & venue" active />
          <Pill label="P2" />
          <Pill label="P3" />
          <Pill label="P4" />
        </div>

        <article className="nolme-app__phase-card">
          <header>
            <h3>Audience & venue</h3>
            <StatusBadge label="Waiting" />
          </header>
          <div className="nolme-app__phase-task">
            <div>
              <strong>Task 5 of 5</strong>
              <p>Create a venue list that fits the criteria of the audience and venue data analyzed...</p>
            </div>
            <button type="button">
              View tasks
              <ChevronDown aria-hidden="true" size={16} strokeWidth={2} />
            </button>
          </div>
        </article>
      </section>

      <section className="nolme-app__deliverables-section">
        <div className="nolme-app__section-header">
          <Package aria-hidden="true" size={24} strokeWidth={1.8} />
          <h2>Deliverables</h2>
        </div>

        <div className="nolme-app__deliverables-list">
          <p>Phase 1 - Artifacts</p>
          <Divider />
          {deliverables.map((deliverable) => (
            <DeliverableRow key={deliverable.id} deliverable={deliverable} />
          ))}
        </div>
      </section>
    </aside>
  );
}

function DeliverableRow({ deliverable }: { deliverable: Deliverable }) {
  const Icon = deliverable.icon;

  return (
    <article className="nolme-app__deliverable-row">
      <div className={cn('nolme-app__deliverable-icon', `nolme-app__deliverable-icon--${deliverable.tone}`)}>
        <Icon aria-hidden="true" size={32} strokeWidth={1.8} />
      </div>
      <div>
        <h3>{deliverable.title}</h3>
        <p>{deliverable.edited}</p>
      </div>
      {deliverable.isNew && <span className="nolme-app__new-badge">New</span>}
    </article>
  );
}

function ArtifactResponse() {
  return (
    <section className="nolme-app__artifact-card" aria-label="Artifact response">
      <header>
        <div>
          <Link2 aria-hidden="true" size={32} strokeWidth={2} />
          <h2>Venues selected on Luma account and ready to review:</h2>
        </div>
        <button type="button" aria-label="Copy artifact link" title="Copy artifact link">
          <Copy aria-hidden="true" size={20} strokeWidth={1.8} />
        </button>
      </header>

      <p>
        I was able to select <strong>15 venues that meet audience, location, and pricing criteria based on your updates</strong>:
      </p>

      <a className="nolme-app__preview-card" href="https://lu.ma/" target="_blank" rel="noreferrer">
        <span>
          <strong>Luma Venue List: Cindy M</strong>
          <small>You have 15 venues saved on your list look at 1. 10 Market St, San Francisco, CA 91203...</small>
        </span>
        <span className="nolme-app__venue-thumb" aria-hidden="true">
          <i />
          <b />
        </span>
      </a>
    </section>
  );
}

function Pill({ label, active = false }: { label: string; active?: boolean }) {
  return <span className={cn('nolme-app__pill', active && 'nolme-app__pill--active')}>{label}</span>;
}

function StatusBadge({ label }: { label: string }) {
  return <span className="nolme-app__status-badge">{label}</span>;
}

function Divider() {
  return <span className="nolme-app__divider" aria-hidden="true" />;
}
