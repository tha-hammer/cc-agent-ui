import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  FileSpreadsheet,
  FileText,
  Link2,
  ListChecks,
  Loader2,
  MessageCircle,
  Package,
  Plus,
  Search,
  Settings as SettingsIcon,
  Square,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import Settings from '../../settings/view/Settings';
import { cn } from '../../../lib/utils';
import { api, authenticatedFetch } from '../../../utils/api';
import './NolmeAppRoute.css';

type NavPanelId = 'search' | 'chat' | 'tasks';

type Project = {
  name: string;
  displayName?: string;
  path?: string;
  fullPath?: string;
};

type Skill = {
  id: string;
  name: string;
  description: string;
  path: string;
  relativePath: string;
  source: string;
};

type SearchHighlight = { start: number; end: number };
type SearchSessionMatch = {
  provider?: string;
  timestamp?: string | null;
  snippet: string;
  highlights?: SearchHighlight[];
};
type SearchSession = {
  sessionId: string;
  sessionSummary: string;
  provider?: string;
  matches: SearchSessionMatch[];
};
type SearchProjectResult = {
  projectName: string;
  projectDisplayName: string;
  sessions: SearchSession[];
};

type AlgorithmPhase = {
  id: string;
  label: string;
  title: string;
  status: 'idle' | 'active' | 'complete';
};

type AlgorithmDeliverable = {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
  tone?: 'emerald' | 'iris' | 'gold' | 'document' | 'sheet' | 'link';
  action?: 'download' | 'link';
  url?: string | null;
};

type AlgorithmQuestion = {
  id: string;
  prompt: string;
  choices?: string[];
  defaultValue?: string | null;
};

type AlgorithmPermission = {
  id: string;
  toolName: string;
  action: string;
  risks?: string[];
};

type AlgorithmOutput = {
  title?: string;
  body?: string;
  url?: string | null;
};

type AlgorithmRunState = {
  runId: string;
  provider: string;
  model?: string | null;
  prompt?: string | null;
  taskTitle?: string | null;
  status: string;
  sessionId?: string | null;
  phase?: string | null;
  phases?: AlgorithmPhase[];
  currentPhaseIndex?: number;
  currentReviewLine?: string;
  deliverables?: AlgorithmDeliverable[];
  finalOutput?: AlgorithmOutput | null;
  pendingQuestion?: AlgorithmQuestion | null;
  pendingPermission?: AlgorithmPermission | null;
  lastError?: { code: string; message: string } | null;
  eventCursor?: { sequence: number };
};

const NAV_ITEMS: Array<{ id: NavPanelId | 'audience' | 'settings'; label: string; icon: LucideIcon; disabled?: boolean }> = [
  { id: 'search', label: 'Search', icon: Search },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'audience', label: 'Audience', icon: Users, disabled: true },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function readInitialRunId() {
  if (typeof window === 'undefined') return '';
  const fromUrl = new URLSearchParams(window.location.search).get('runId');
  if (fromUrl) return fromUrl;
  try {
    return localStorage.getItem('nolme-active-algorithm-run-id') || '';
  } catch {
    return '';
  }
}

function selectedProjectPath(projects: Project[]) {
  const project = projects[0];
  return project?.fullPath || project?.path || '';
}

function projectLabel(projects: Project[]) {
  const project = projects[0];
  return project?.displayName || project?.name || 'No project selected';
}

function formatTimestamp(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function NolmeAppRoute() {
  const [activePanel, setActivePanel] = useState<NavPanelId>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeRunId, setActiveRunId] = useState(readInitialRunId);
  const [runState, setRunState] = useState<AlgorithmRunState | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProjectResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<{ scannedProjects: number; totalProjects: number } | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchSourceRef = useRef<EventSource | null>(null);
  const runEventSequence = runState?.eventCursor?.sequence ?? null;

  const loadRunState = async (runId: string) => {
    if (!runId) return;
    try {
      const response = await api.algorithmRunState(runId);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error?.message || `Failed to load run ${runId}`);
      }
      const body = await response.json();
      setRunState(body.state);
      setRunError(null);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to load Algorithm run');
    }
  };

  useEffect(() => {
    api.projects()
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!activeRunId || typeof window === 'undefined') return;
    try {
      localStorage.setItem('nolme-active-algorithm-run-id', activeRunId);
    } catch {
      // Ignore storage failures.
    }
    const url = new URL(window.location.href);
    url.searchParams.set('runId', activeRunId);
    window.history.replaceState({}, '', url);
  }, [activeRunId]);

  useEffect(() => {
    if (!activeRunId) {
      setRunState(null);
      return undefined;
    }

    void loadRunState(activeRunId);
    return undefined;
  }, [activeRunId]);

  useEffect(() => {
    if (!activeRunId || runEventSequence === null) return undefined;
    if (typeof EventSource === 'undefined') return undefined;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventSource = new EventSource(api.algorithmRunEventsUrl(activeRunId, runEventSequence));
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('algorithm.event', () => {
      void loadRunState(activeRunId);
    });
    eventSource.addEventListener('error', () => {
      eventSource.close();
      eventSourceRef.current = null;
    });

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [activeRunId, runEventSequence]);

  useEffect(() => {
    if (activePanel !== 'tasks' || skills.length > 0 || skillsLoading) return;
    setSkillsLoading(true);
    setSkillsError(null);
    api.skills()
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || 'Failed to load skills');
        }
        return response.json();
      })
      .then((body) => setSkills(Array.isArray(body.skills) ? body.skills : []))
      .catch((error) => setSkillsError(error instanceof Error ? error.message : 'Failed to load skills'))
      .finally(() => setSkillsLoading(false));
  }, [activePanel, skills.length, skillsLoading]);

  useEffect(() => {
    if (searchSourceRef.current) {
      searchSourceRef.current.close();
      searchSourceRef.current = null;
    }

    const query = searchQuery.trim();
    if (activePanel !== 'search' || query.length < 2) {
      setIsSearching(false);
      setSearchProgress(null);
      if (query.length < 2) {
        setSearchResults([]);
        setSearchTotal(0);
      }
      return undefined;
    }
    if (typeof EventSource === 'undefined') {
      setIsSearching(false);
      setSearchProgress(null);
      return undefined;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSearchTotal(0);
    const source = new EventSource(api.searchConversationsUrl(query));
    searchSourceRef.current = source;
    const nextResults: SearchProjectResult[] = [];

    source.addEventListener('result', (event) => {
      const data = JSON.parse(event.data);
      nextResults.push(data.projectResult);
      setSearchResults([...nextResults]);
      setSearchTotal(data.totalMatches ?? nextResults.length);
      setSearchProgress({ scannedProjects: data.scannedProjects, totalProjects: data.totalProjects });
    });
    source.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setSearchTotal(data.totalMatches ?? 0);
      setSearchProgress({ scannedProjects: data.scannedProjects, totalProjects: data.totalProjects });
    });
    source.addEventListener('done', () => {
      source.close();
      searchSourceRef.current = null;
      setIsSearching(false);
      setSearchProgress(null);
    });
    source.addEventListener('error', () => {
      source.close();
      searchSourceRef.current = null;
      setIsSearching(false);
      setSearchProgress(null);
    });

    return () => {
      source.close();
      searchSourceRef.current = null;
    };
  }, [activePanel, searchQuery]);

  const handleStartRun = async () => {
    const trimmedPrompt = prompt.trim();
    const projectPath = selectedProjectPath(projects);
    if (!trimmedPrompt || isStartingRun) return;
    if (!projectPath) {
      setRunError('Select or create a project before starting an Algorithm run.');
      return;
    }

    setIsStartingRun(true);
    setRunError(null);
    try {
      const response = await api.startAlgorithmRun({
        schemaVersion: 1,
        provider: 'claude',
        projectPath,
        prompt: trimmedPrompt,
        metadata: {
          taskTitle: selectedSkill ? selectedSkill.name : trimmedPrompt.slice(0, 80),
          skill: selectedSkill ? {
            name: selectedSkill.name,
            path: selectedSkill.path,
            source: selectedSkill.source,
          } : null,
          source: 'app-route',
        },
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body?.error?.message || 'Failed to start Algorithm run');
      }
      setPrompt('');
      setActiveRunId(body.run.runId);
      setRunState({
        ...body.run,
        runId: body.run.runId,
        provider: body.run.provider,
        prompt: trimmedPrompt,
        taskTitle: selectedSkill ? selectedSkill.name : trimmedPrompt.slice(0, 80),
      });
      setActivePanel('chat');
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to start Algorithm run');
    } finally {
      setIsStartingRun(false);
    }
  };

  const answerQuestion = async (answer: string) => {
    if (!activeRunId || !runState?.pendingQuestion) return;
    setDecisionError(null);
    try {
      const response = await authenticatedFetch(
        `/api/algorithm-runs/${encodeURIComponent(activeRunId)}/questions/${encodeURIComponent(runState.pendingQuestion.id)}/answer`,
        {
          method: 'POST',
          body: JSON.stringify({ schemaVersion: 1, answer }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || 'Failed to answer question');
      }
      await loadRunState(activeRunId);
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'Failed to answer question');
    }
  };

  const decidePermission = async (allow: boolean) => {
    if (!activeRunId || !runState?.pendingPermission) return;
    setDecisionError(null);
    try {
      const response = await authenticatedFetch(
        `/api/algorithm-runs/${encodeURIComponent(activeRunId)}/permissions/${encodeURIComponent(runState.pendingPermission.id)}/decision`,
        {
          method: 'POST',
          body: JSON.stringify({ schemaVersion: 1, allow }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || 'Failed to resolve permission');
      }
      await loadRunState(activeRunId);
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'Failed to resolve permission');
    }
  };

  return (
    <div className="nolme-app" data-node-id="nolme-app-route">
      <NavPanel
        activePanel={activePanel}
        skillsCount={skills.length}
        onSelectPanel={setActivePanel}
        onShowSettings={() => setShowSettings(true)}
      />

      {activePanel === 'search' ? (
        <SearchPanel
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={searchResults}
          totalMatches={searchTotal}
          isSearching={isSearching}
          progress={searchProgress}
          onOpenSession={(session) => {
            if (session.provider) {
              try {
                localStorage.setItem('selected-provider', session.provider);
              } catch {
                // Ignore storage failures.
              }
            }
            window.location.href = `/session/${encodeURIComponent(session.sessionId)}`;
          }}
        />
      ) : activePanel === 'tasks' ? (
        <SkillsPanel
          skills={skills}
          selectedSkill={selectedSkill}
          isLoading={skillsLoading}
          error={skillsError}
          onSelectSkill={(skill) => {
            setSelectedSkill(skill);
            setActivePanel('chat');
          }}
        />
      ) : (
        <ChatPanel
          runState={runState}
          runError={runError}
          prompt={prompt}
          selectedSkill={selectedSkill}
          projectLabel={projectLabel(projects)}
          isStartingRun={isStartingRun}
          decisionError={decisionError}
          onPromptChange={setPrompt}
          onStartRun={handleStartRun}
          onAnswerQuestion={answerQuestion}
          onDecidePermission={decidePermission}
          onOpenSkills={() => setActivePanel('tasks')}
          onRefreshRun={() => activeRunId && loadRunState(activeRunId)}
        />
      )}

      <RightPanel runState={runState} />

      {showSettings && (
        <Settings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          projects={projects}
          initialTab="agents"
        />
      )}
    </div>
  );
}

function NavPanel({
  activePanel,
  skillsCount,
  onSelectPanel,
  onShowSettings,
}: {
  activePanel: NavPanelId;
  skillsCount: number;
  onSelectPanel: (panel: NavPanelId) => void;
  onShowSettings: () => void;
}) {
  return (
    <aside className="nolme-app__nav-panel" aria-label="Nolme app navigation">
      <div className="nolme-app__logo-wrap">
        <div className="nolme-app__logo-mark" aria-label="Nolme">
          N
        </div>
      </div>

      <div className="nolme-app__nav-content">
        <nav className="nolme-app__nav-menu" aria-label="Primary">
          {NAV_ITEMS.map(({ id, label, icon: Icon, disabled }) => {
            const isActive = id === activePanel;
            const handleClick = () => {
              if (disabled) return;
              if (id === 'settings') {
                onShowSettings();
              } else {
                onSelectPanel(id as NavPanelId);
              }
            };

            return (
              <button
                key={id}
                type="button"
                className={cn('nolme-app__nav-button', isActive && 'nolme-app__nav-button--active')}
                aria-label={label}
                title={disabled ? `${label} is not active yet` : label}
                aria-pressed={isActive}
                disabled={disabled}
                onClick={handleClick}
              >
                <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
                {id === 'tasks' && skillsCount > 0 && <span className="nolme-app__nav-badge">{skillsCount}</span>}
              </button>
            );
          })}
        </nav>

        <div className="nolme-app__nav-footer">
          <div className="nolme-app__avatar nolme-app__avatar--user" aria-label="Current user">
            U
          </div>
        </div>
      </div>
    </aside>
  );
}

function SearchPanel({
  query,
  onQueryChange,
  results,
  totalMatches,
  isSearching,
  progress,
  onOpenSession,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchProjectResult[];
  totalMatches: number;
  isSearching: boolean;
  progress: { scannedProjects: number; totalProjects: number } | null;
  onOpenSession: (session: SearchSession) => void;
}) {
  return (
    <main className="nolme-app__chat-stream nolme-app__workspace-panel" aria-label="Search projects and sessions">
      <section className="nolme-app__panel-card">
        <header className="nolme-app__panel-header">
          <div>
            <Search aria-hidden="true" size={22} />
            <h1>Search</h1>
          </div>
          {isSearching && (
            <span className="nolme-app__panel-status">
              <Loader2 aria-hidden="true" size={14} />
              Searching
            </span>
          )}
        </header>

        <label className="nolme-app__search-field">
          <Search aria-hidden="true" size={18} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search projects and sessions"
            autoFocus
          />
        </label>

        {progress && (
          <p className="nolme-app__panel-muted">
            Scanned {progress.scannedProjects} of {progress.totalProjects} projects.
          </p>
        )}

        {query.trim().length < 2 ? (
          <EmptyPanel icon={Search} title="Enter at least two characters" body="Search scans saved project sessions and returns matching conversations." />
        ) : results.length === 0 && !isSearching ? (
          <EmptyPanel icon={Search} title="No matches" body="Try a different project, session, or message phrase." />
        ) : (
          <div className="nolme-app__search-results">
            <p>{totalMatches} matches</p>
            {results.map((project) => (
              <article key={project.projectName} className="nolme-app__search-project">
                <h2>{project.projectDisplayName}</h2>
                {project.sessions.map((session) => (
                  <button
                    key={session.sessionId}
                    type="button"
                    className="nolme-app__search-session"
                    onClick={() => onOpenSession(session)}
                  >
                    <strong>{session.sessionSummary}</strong>
                    {session.matches.slice(0, 2).map((match, index) => (
                      <p key={`${session.sessionId}-${index}`}>
                        {formatTimestamp(match.timestamp)}
                        {formatTimestamp(match.timestamp) && ' - '}
                        {match.snippet}
                      </p>
                    ))}
                  </button>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SkillsPanel({
  skills,
  selectedSkill,
  isLoading,
  error,
  onSelectSkill,
}: {
  skills: Skill[];
  selectedSkill: Skill | null;
  isLoading: boolean;
  error: string | null;
  onSelectSkill: (skill: Skill) => void;
}) {
  return (
    <main className="nolme-app__chat-stream nolme-app__workspace-panel" aria-label="Available skills">
      <section className="nolme-app__panel-card">
        <header className="nolme-app__panel-header">
          <div>
            <ListChecks aria-hidden="true" size={22} />
            <h1>Tasks</h1>
          </div>
          {isLoading && (
            <span className="nolme-app__panel-status">
              <Loader2 aria-hidden="true" size={14} />
              Loading
            </span>
          )}
        </header>

        {error ? (
          <EmptyPanel icon={AlertCircle} title="Skills unavailable" body={error} />
        ) : skills.length === 0 && !isLoading ? (
          <EmptyPanel icon={ListChecks} title="No skills found" body="No SKILL.md files were found in the configured user skill directories." />
        ) : (
          <div className="nolme-app__skills-list">
            {skills.map((skill) => {
              const active = selectedSkill?.id === skill.id;
              return (
                <button
                  key={skill.id}
                  type="button"
                  className={cn('nolme-app__skill-row', active && 'nolme-app__skill-row--selected')}
                  onClick={() => onSelectSkill(skill)}
                >
                  <span>
                    <strong>{skill.name}</strong>
                    <small>{skill.description || skill.relativePath}</small>
                  </span>
                  <em>{skill.source}</em>
                  {active && <Check aria-hidden="true" size={18} />}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function ChatPanel({
  runState,
  runError,
  prompt,
  selectedSkill,
  projectLabel,
  isStartingRun,
  decisionError,
  onPromptChange,
  onStartRun,
  onAnswerQuestion,
  onDecidePermission,
  onOpenSkills,
  onRefreshRun,
}: {
  runState: AlgorithmRunState | null;
  runError: string | null;
  prompt: string;
  selectedSkill: Skill | null;
  projectLabel: string;
  isStartingRun: boolean;
  decisionError: string | null;
  onPromptChange: (value: string) => void;
  onStartRun: () => void;
  onAnswerQuestion: (answer: string) => void;
  onDecidePermission: (allow: boolean) => void;
  onOpenSkills: () => void;
  onRefreshRun: () => void;
}) {
  const thinkingLabel = runState
    ? `Algorithm run ${runState.runId} is ${runState.status}${runState.phase ? ` in ${runState.phase}` : ''}.`
    : 'Start an Algorithm run to populate chat, questions, phases, and deliverables.';

  return (
    <main className="nolme-app__chat-stream" aria-label="Nolme chat stream">
      <div className="nolme-app__messages">
        {runState?.prompt && (
          <ChatBubble
            body={runState.prompt}
            timestamp={runState.runId}
          />
        )}

        {runState?.finalOutput && <ArtifactResponse output={runState.finalOutput} />}

        {runError && <NoticeRow tone="error" label={runError} />}
        {decisionError && <NoticeRow tone="error" label={decisionError} />}
        {runState?.lastError && <NoticeRow tone="error" label={runState.lastError.message} />}

        {runState?.pendingQuestion && (
          <QuestionCard question={runState.pendingQuestion} onAnswer={onAnswerQuestion} />
        )}

        {runState?.pendingPermission && (
          <PermissionCard permission={runState.pendingPermission} onDecide={onDecidePermission} />
        )}

        <ThinkingRow label={thinkingLabel} />
      </div>

      <div className="nolme-app__input-zone">
        <Composer
          prompt={prompt}
          selectedSkill={selectedSkill}
          projectLabel={projectLabel}
          isWorking={isStartingRun || ['starting', 'running', 'stopping'].includes(runState?.status || '')}
          progress={runState?.eventCursor?.sequence ?? 0}
          onPromptChange={onPromptChange}
          onStartRun={onStartRun}
          onOpenSkills={onOpenSkills}
          onRefreshRun={onRefreshRun}
        />
      </div>
    </main>
  );
}

function ChatBubble({ body, timestamp }: { body: string; timestamp: string }) {
  return (
    <div className="nolme-app__bubble-row">
      <article className="nolme-app__chat-bubble">
        <p>{body}</p>
        <footer>
          <span>{timestamp}</span>
          <span>Queued</span>
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

function NoticeRow({ label, tone }: { label: string; tone: 'error' }) {
  return (
    <div className={cn('nolme-app__notice-row', `nolme-app__notice-row--${tone}`)} role="alert">
      <AlertCircle aria-hidden="true" size={16} />
      <span>{label}</span>
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="nolme-app__agent-avatar" aria-label="Agent">
      A
    </div>
  );
}

function QuestionCard({ question, onAnswer }: { question: AlgorithmQuestion; onAnswer: (answer: string) => void }) {
  const choices = question.choices ?? [];
  const [answer, setAnswer] = useState(question.defaultValue || choices[0] || '');

  return (
    <section className="nolme-app__question-card" aria-label="Clarifying question">
      <div className="nolme-app__question-copy">
        <p>Before I proceed, I need a decision:</p>
        <h2>{question.prompt}</h2>
      </div>

      {choices.length > 0 ? (
        <div className="nolme-app__question-options" role="radiogroup" aria-label={question.prompt}>
          {choices.map((choice, index) => {
            const selected = answer === choice;
            return (
              <div key={choice}>
                <button
                  type="button"
                  className="nolme-app__option-row"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAnswer(choice)}
                >
                  <span className={cn('nolme-app__checkbox', selected && 'nolme-app__checkbox--selected')}>
                    {selected && <Check aria-hidden="true" size={12} strokeWidth={2.4} />}
                  </span>
                  <span>{choice}</span>
                </button>
                {index < choices.length - 1 && <Divider />}
              </div>
            );
          })}
        </div>
      ) : (
        <label className="nolme-app__field-label">
          <span className="sr-only">Answer</span>
          <input value={answer} onChange={(event) => setAnswer(event.target.value)} />
        </label>
      )}

      <div className="nolme-app__question-cta">
        <button type="button" className="nolme-app__primary-button" onClick={() => onAnswer(answer)}>
          Continue
        </button>
      </div>
    </section>
  );
}

function PermissionCard({ permission, onDecide }: { permission: AlgorithmPermission; onDecide: (allow: boolean) => void }) {
  return (
    <section className="nolme-app__question-card" aria-label="Permission request">
      <div className="nolme-app__question-copy">
        <p>{permission.toolName}</p>
        <h2>{permission.action}</h2>
      </div>
      {permission.risks && permission.risks.length > 0 && (
        <ul className="nolme-app__risk-list">
          {permission.risks.map((risk) => <li key={risk}>{risk}</li>)}
        </ul>
      )}
      <div className="nolme-app__question-cta">
        <button type="button" className="nolme-app__text-action" onClick={() => onDecide(false)}>
          Deny
        </button>
        <button type="button" className="nolme-app__primary-button" onClick={() => onDecide(true)}>
          Allow
        </button>
      </div>
    </section>
  );
}

function Composer({
  prompt,
  selectedSkill,
  projectLabel,
  isWorking,
  progress,
  onPromptChange,
  onStartRun,
  onOpenSkills,
  onRefreshRun,
}: {
  prompt: string;
  selectedSkill: Skill | null;
  projectLabel: string;
  isWorking: boolean;
  progress: number;
  onPromptChange: (value: string) => void;
  onStartRun: () => void;
  onOpenSkills: () => void;
  onRefreshRun: () => void;
}) {
  return (
    <section className="nolme-app__composer" aria-label="Message composer">
      <div className="nolme-app__composer-toolbar">
        <div className="nolme-app__agent-details">
          <div className="nolme-app__agent-profile">
            <AgentAvatar />
            <span>{selectedSkill ? selectedSkill.name : 'Algorithm runner'}</span>
          </div>
          <div className="nolme-app__progress-row">
            <div className="nolme-app__progress-track" aria-label={`${progress} events received`}>
              <span style={{ width: `${Math.min(progress * 10, 100)}%` }} />
            </div>
            <strong>{progress} events</strong>
          </div>
        </div>

        <div className="nolme-app__quick-actions" aria-label="Run controls">
          <button type="button" onClick={onOpenSkills}>
            {selectedSkill ? 'Change skill' : 'Choose skill'}
          </button>
          <button type="button" onClick={onRefreshRun}>
            Refresh run
          </button>
        </div>
      </div>

      <div className="nolme-app__input-field">
        <textarea
          placeholder="Describe the Algorithm run to start..."
          aria-label="Algorithm prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
        />

        <div className="nolme-app__input-status">
          <div className="nolme-app__input-left">
            <button type="button" className="nolme-app__icon-button" aria-label="Attach file" title="Attach file" disabled>
              <Plus aria-hidden="true" size={24} strokeWidth={1.8} />
            </button>
            <button type="button" className="nolme-app__model-pill" aria-label={`Selected project ${projectLabel}`}>
              {projectLabel}
              <ChevronDown aria-hidden="true" size={12} strokeWidth={2} />
            </button>
          </div>

          <div className="nolme-app__input-right">
            <span>claude</span>
            {isWorking && (
              <button type="button" className="nolme-app__stop-button" aria-label="Stop generation" title="Stop generation" disabled>
                <Square aria-hidden="true" size={12} fill="currentColor" strokeWidth={0} />
              </button>
            )}
            <button type="button" className="nolme-app__send-button" disabled={isWorking || !prompt.trim()} onClick={onStartRun}>
              {isWorking ? 'Working...' : 'Start'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function RightPanel({ runState }: { runState: AlgorithmRunState | null }) {
  const phases = useMemo(() => {
    if (runState?.phases && runState.phases.length > 0) return runState.phases;
    if (runState?.phase) {
      return [{ id: runState.phase, label: 'P1', title: runState.phase, status: 'active' as const }];
    }
    return [];
  }, [runState]);
  const currentPhaseIndex = Math.max(0, Math.min(runState?.currentPhaseIndex ?? 0, Math.max(phases.length - 1, 0)));
  const activePhase = phases[currentPhaseIndex] ?? null;
  const deliverables = runState?.deliverables ?? [];

  return (
    <aside className="nolme-app__right-panel" aria-label="Phases and deliverables">
      <section className="nolme-app__phase-section">
        <div className="nolme-app__section-header">
          <Workflow aria-hidden="true" size={24} strokeWidth={1.8} />
          <h2>Phases</h2>
        </div>

        {phases.length === 0 ? (
          <EmptyRail title="No phases yet" body="Algorithm phase events will appear here." />
        ) : (
          <>
            <div className="nolme-app__phase-pills">
              {phases.map((phase, index) => (
                <Pill
                  key={phase.id}
                  label={`${phase.label}: ${phase.title}`}
                  active={index === currentPhaseIndex || phase.status === 'active'}
                  complete={phase.status === 'complete'}
                />
              ))}
            </div>

            {activePhase && (
              <article className="nolme-app__phase-card">
                <header>
                  <h3>{activePhase.title}</h3>
                  <StatusBadge label={runState?.status || activePhase.status} />
                </header>
                <div className="nolme-app__phase-task">
                  <div>
                    <strong>Task {currentPhaseIndex + 1} of {phases.length}</strong>
                    <p>{runState?.currentReviewLine || runState?.taskTitle || runState?.prompt || `Continue ${activePhase.title}.`}</p>
                  </div>
                </div>
              </article>
            )}
          </>
        )}
      </section>

      <section className="nolme-app__deliverables-section">
        <div className="nolme-app__section-header">
          <Package aria-hidden="true" size={24} strokeWidth={1.8} />
          <h2>Deliverables</h2>
        </div>

        <div className="nolme-app__deliverables-list">
          {deliverables.length === 0 ? (
            <EmptyRail title="No deliverables yet" body="Algorithm artifact events will appear here." />
          ) : (
            <>
              <p>Run artifacts</p>
              <Divider />
              {deliverables.map((deliverable) => (
                <DeliverableRow key={deliverable.id} deliverable={deliverable} />
              ))}
            </>
          )}
        </div>
      </section>
    </aside>
  );
}

function DeliverableRow({ deliverable }: { deliverable: AlgorithmDeliverable }) {
  const Icon = deliverable.action === 'download'
    ? FileText
    : deliverable.tone === 'sheet'
      ? FileSpreadsheet
      : Link2;

  const content = (
    <>
      <div className={cn('nolme-app__deliverable-icon', `nolme-app__deliverable-icon--${deliverable.tone || 'link'}`)}>
        <Icon aria-hidden="true" size={32} strokeWidth={1.8} />
      </div>
      <div>
        <h3>{deliverable.title}</h3>
        <p>{deliverable.subtitle || deliverable.badge || 'Artifact'}</p>
      </div>
    </>
  );

  if (deliverable.url) {
    return (
      <a className="nolme-app__deliverable-row nolme-app__deliverable-link" href={deliverable.url} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return <article className="nolme-app__deliverable-row">{content}</article>;
}

function ArtifactResponse({ output }: { output: AlgorithmOutput }) {
  return (
    <section className="nolme-app__artifact-card" aria-label="Artifact response">
      <header>
        <div>
          <Link2 aria-hidden="true" size={32} strokeWidth={2} />
          <h2>{output.title || 'Algorithm output'}</h2>
        </div>
        {output.url && (
          <a href={output.url} target="_blank" rel="noreferrer" aria-label="Open artifact link" title="Open artifact link">
            <Copy aria-hidden="true" size={20} strokeWidth={1.8} />
          </a>
        )}
      </header>

      {output.body && <p>{output.body}</p>}
    </section>
  );
}

function Pill({ label, active = false, complete = false }: { label: string; active?: boolean; complete?: boolean }) {
  return <span className={cn('nolme-app__pill', active && 'nolme-app__pill--active', complete && 'nolme-app__pill--complete')}>{label}</span>;
}

function StatusBadge({ label }: { label: string }) {
  return <span className="nolme-app__status-badge">{label}</span>;
}

function Divider() {
  return <span className="nolme-app__divider" aria-hidden="true" />;
}

function EmptyRail({ title, body }: { title: string; body: string }) {
  return (
    <div className="nolme-app__rail-empty">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="nolme-app__panel-empty">
      <Icon aria-hidden="true" size={24} />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
