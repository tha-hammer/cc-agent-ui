import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Copy,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Link2,
  ListChecks,
  Loader2,
  MessageCircle,
  Package,
  Plus,
  Search,
  Settings as SettingsIcon,
  Square,
  Trash2,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import Settings from '../../settings/view/Settings';
import SessionProviderLogo from '../../llm-logo-provider/SessionProviderLogo';
import { cn } from '../../../lib/utils';
import { useWebSocket } from '../../../contexts/WebSocketContext';
import { api, authenticatedFetch } from '../../../utils/api';
import { formatTimeAgo } from '../../../utils/dateUtils';
import type { Project, ProjectSession, ProjectsUpdatedMessage, SessionProvider } from '../../../types/app';
import type { NormalizedMessage } from '../../../stores/useSessionStore';
import { CLAUDE_MODELS } from '../../../../shared/modelConstants';
import './NolmeAppRoute.css';

type NavPanelId = 'search' | 'chat' | 'tasks';
type ChatView = 'projects' | 'composer';

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
  filePath?: string | null;
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

type ChatTranscriptItem = {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  timestamp: string;
  streaming?: boolean;
};

type SessionWithProvider = ProjectSession & {
  __provider: SessionProvider;
};

type LoadingSessionsByProject = Record<string, boolean>;

type SessionMessage = Partial<NormalizedMessage> & Record<string, unknown>;

type UnifiedSessionMessagesBody = {
  messages?: SessionMessage[];
  error?: string | { message?: string };
  message?: string;
};

type RefreshSessionOptions = {
  showSpinner?: boolean;
};

type ArtifactCandidate = {
  id: string;
  title: string;
  subtitle: string;
  url?: string | null;
  filePath?: string | null;
  tone?: AlgorithmDeliverable['tone'];
  action?: AlgorithmDeliverable['action'];
};

const ALGORITHM_PHASE_TITLES = ['Observe', 'Think', 'Plan', 'Build', 'Execute', 'Verify', 'Learn'] as const;
const ALGORITHM_PHASE_PATTERN = /\b(OBSERVE|THINK|PLAN|BUILD|EXECUTE|VERIFY|LEARN)\b/i;
const ALGORITHM_PROGRESS_PATTERN = /\b(\d+)\s*\/\s*(\d+)\b/;

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

function readInitialRunIdIsExplicit() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('runId');
}

function getProjectPath(project: Project | null | undefined) {
  return project?.fullPath || project?.path || '';
}

function getProjectLabel(project: Project) {
  return project.displayName || project.name;
}

function getSessionProvider(session: ProjectSession): SessionProvider {
  const provider = session.__provider;
  if (provider === 'cursor' || provider === 'codex' || provider === 'gemini') return provider;
  return 'claude';
}

function getProjectSessions(project: Project): SessionWithProvider[] {
  const claudeSessions = (project.sessions || []).map((session) => ({ ...session, __provider: 'claude' as const }));
  const cursorSessions = (project.cursorSessions || []).map((session) => ({ ...session, __provider: 'cursor' as const }));
  const codexSessions = (project.codexSessions || []).map((session) => ({ ...session, __provider: 'codex' as const }));
  const geminiSessions = (project.geminiSessions || []).map((session) => ({ ...session, __provider: 'gemini' as const }));

  return [...claudeSessions, ...cursorSessions, ...codexSessions, ...geminiSessions].sort(
    (a, b) => new Date(getSessionTime(b)).getTime() - new Date(getSessionTime(a)).getTime(),
  );
}

function getSessionTitle(session: SessionWithProvider) {
  const fallback = `${session.__provider[0].toUpperCase()}${session.__provider.slice(1)} Session`;
  return String(session.summary || session.title || session.name || fallback);
}

function getSessionTime(session: SessionWithProvider) {
  if (session.__provider === 'cursor') {
    return String(session.createdAt || session.updated_at || '');
  }
  if (session.__provider === 'codex') {
    return String(session.createdAt || session.lastActivity || session.updated_at || '');
  }
  return String(session.lastActivity || session.createdAt || session.updated_at || '');
}

function getSessionCount(session: SessionWithProvider) {
  return Number(session.messageCount || 0);
}

function toTranscriptItem(message: NormalizedMessage): ChatTranscriptItem | null {
  if (message.kind !== 'text' || !message.role || !message.content) return null;
  return {
    id: message.id || `${message.role}-${message.timestamp || Date.now()}`,
    role: message.role,
    body: String(message.content),
    timestamp: message.timestamp || new Date().toISOString(),
  };
}

function mapTranscriptMessages(messages: SessionMessage[]) {
  return messages.map((message) => toTranscriptItem(message as NormalizedMessage)).filter(Boolean) as ChatTranscriptItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeProjectsPayload(data: unknown): Project[] {
  if (Array.isArray(data)) return data as Project[];
  if (isRecord(data) && Array.isArray(data.projects)) return data.projects as Project[];
  return [];
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isCompletedStatus(value: unknown) {
  const status = asString(value).toLowerCase();
  return !status || ['complete', 'completed', 'done', 'success', 'succeeded'].includes(status);
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function basename(value: string) {
  const normalized = value.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).at(-1) || value;
}

function inferDeliverableTone(value: string): AlgorithmDeliverable['tone'] {
  if (/\b(csv|xlsx?|spreadsheet|sheet|table)\b/i.test(value)) return 'sheet';
  if (isHttpUrl(value)) return 'link';
  return 'document';
}

function getRecordString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return '';
}

function contentToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(contentToText).filter(Boolean).join('\n');
  if (!isRecord(value)) return '';
  return [value.text, value.content].map(contentToText).filter(Boolean).join('\n');
}

function getOutputFilePath(record: Record<string, unknown>) {
  return getRecordString(record, ['outputFile', 'output_file', 'output-file', 'filePath', 'file_path', 'path', 'file', 'filename']);
}

function collectTaskOutputFiles(messages: SessionMessage[]) {
  const outputFiles = new Map<string, string>();

  for (const message of messages) {
    const toolUseResult = isRecord(message.toolResult) && isRecord(message.toolResult.toolUseResult)
      ? message.toolResult.toolUseResult
      : null;
    const outputFile = toolUseResult ? getOutputFilePath(toolUseResult) : '';
    const agentId = toolUseResult ? getRecordString(toolUseResult, ['agentId', 'taskId', 'task-id']) : '';

    if (outputFile) {
      if (agentId) outputFiles.set(agentId, outputFile);
      if (message.toolId) outputFiles.set(String(message.toolId), outputFile);
    }

    const content = contentToText(message.content);
    const contentAgentId = content.match(/\bagentId:\s*([^\s]+)/i)?.[1] || '';
    const contentOutputFile = content.match(/\boutput_file:\s*([^\s]+)/i)?.[1] || '';
    if (contentAgentId && contentOutputFile) outputFiles.set(contentAgentId, contentOutputFile);
    if (message.toolId && contentOutputFile) outputFiles.set(String(message.toolId), contentOutputFile);
  }

  return outputFiles;
}

function createArtifactCandidate(
  source: Record<string, unknown>,
  id: string,
  fallbackSubtitle: string,
  fallbackTitle = 'Completed task output',
): ArtifactCandidate | null {
  if (!isCompletedStatus(source.status)) return null;

  const url = getRecordString(source, ['url', 'href', 'link']);
  const filePath = getOutputFilePath(source);
  const summary = getRecordString(source, ['summary', 'title', 'name', 'label']);
  const title = summary || (filePath ? basename(filePath) : '') || (url ? basename(url) : '') || fallbackTitle;
  const subtitle = getRecordString(source, ['subtitle', 'description']) || fallbackSubtitle;
  const toneSource = [title, subtitle, url, filePath].filter(Boolean).join(' ');

  return {
    id,
    title,
    subtitle,
    tone: inferDeliverableTone(toneSource),
    action: url && isHttpUrl(url) ? 'link' : filePath ? 'link' : undefined,
    url: url && isHttpUrl(url) ? url : null,
    filePath: filePath || null,
  };
}

function extractXmlTag(text: string, tag: string) {
  const match = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
}

function parseTaskNotificationXml(text: string, id: string, outputFiles: Map<string, string>): ArtifactCandidate | null {
  if (!/<task-notification[\s>]/i.test(text)) return null;
  const status = extractXmlTag(text, 'status');
  if (!isCompletedStatus(status)) return null;
  const taskId = extractXmlTag(text, 'task-id');
  const toolUseId = extractXmlTag(text, 'tool-use-id');
  const summary = extractXmlTag(text, 'summary') || extractXmlTag(text, 'title');
  const url = extractXmlTag(text, 'url');
  const outputFile =
    extractXmlTag(text, 'output-file') ||
    extractXmlTag(text, 'output_file') ||
    extractXmlTag(text, 'file-path') ||
    extractXmlTag(text, 'file_path') ||
    outputFiles.get(taskId) ||
    outputFiles.get(toolUseId) ||
    '';
  const source = {
    status,
    summary,
    url,
    outputFile,
  };
  return createArtifactCandidate(source, id, 'Completed task output');
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function artifactCandidatesFromValue(
  value: unknown,
  idPrefix: string,
  fallbackSubtitle: string,
): ArtifactCandidate[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => artifactCandidatesFromValue(item, `${idPrefix}-${index}`, fallbackSubtitle));
  }
  if (!isRecord(value)) return [];

  const candidates: ArtifactCandidate[] = [];
  const direct = createArtifactCandidate(value, idPrefix, fallbackSubtitle);
  if (direct) candidates.push(direct);

  for (const key of ['artifact', 'artifacts', 'deliverable', 'deliverables', 'output', 'outputs', 'result', 'results']) {
    if (key in value) {
      candidates.push(...artifactCandidatesFromValue(value[key], `${idPrefix}-${key}`, fallbackSubtitle));
    }
  }

  return candidates;
}

function extractFinalReportTitle(text: string) {
  const afterMarker = text.split(/REPORT DELIVERED/i).at(-1) || text;
  const heading = afterMarker.match(/^\s{0,3}#{1,3}\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  const firstLine = afterMarker
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !/REPORT DELIVERED/i.test(line));
  return firstLine || 'Final assistant report';
}

function extractFinalReportFilePath(text: string) {
  const markerLine = text.split(/\r?\n/).find((line) => /REPORT DELIVERED/i.test(line)) || '';
  const backtickPath = markerLine.match(/`([^`]+)`/)?.[1]?.trim();
  if (backtickPath?.startsWith('/')) return backtickPath;
  const absolutePath = markerLine.match(/(\/[^\s)]+)/)?.[1]?.trim();
  return absolutePath || '';
}

function deriveSessionDeliverables(messages: SessionMessage[]): AlgorithmDeliverable[] {
  const candidates: ArtifactCandidate[] = [];
  const outputFiles = collectTaskOutputFiles(messages);

  messages.forEach((message, index) => {
    const id = String(message.id || `${message.kind || 'message'}-${index}`);
    const content = asString(message.content);

    if (message.kind === 'task_notification') {
      const direct = createArtifactCandidate(message, id, 'Completed task output');
      if (direct) candidates.push(direct);
    }

    const xmlCandidate = content ? parseTaskNotificationXml(content, `${id}-xml`, outputFiles) : null;
    if (xmlCandidate) candidates.push(xmlCandidate);

    const jsonCandidate = content ? tryParseJson(content) : null;
    candidates.push(...artifactCandidatesFromValue(jsonCandidate, `${id}-json`, 'Completed task output'));

    if (isRecord(message.toolResult)) {
      const toolResultContent = asString(message.toolResult.content);
      const toolResultValue = toolResultContent ? tryParseJson(toolResultContent) : null;
      candidates.push(...artifactCandidatesFromValue(
        message.toolResult.toolUseResult ?? toolResultValue,
        `${id}-tool-result`,
        getRecordString(message, ['toolName']) ? `${getRecordString(message, ['toolName'])} result` : 'Completed task output',
      ));
    }
  });

  const seen = new Set<string>();
  const deliverables = candidates
    .filter((candidate) => candidate.title)
    .filter((candidate) => {
      const key = `${candidate.title.toLowerCase()}::${candidate.url || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((candidate, index) => ({
      id: candidate.id || `session-deliverable-${index}`,
      title: candidate.title,
      subtitle: candidate.subtitle,
      tone: candidate.tone || 'document',
      action: candidate.action,
      url: candidate.url ?? null,
      filePath: candidate.filePath ?? null,
    }));

  if (deliverables.length > 0) return deliverables;

  const finalReport = [...messages].reverse().find((message) => (
    message.kind === 'text' &&
    message.role === 'assistant' &&
    typeof message.content === 'string' &&
    /REPORT DELIVERED/i.test(message.content)
  ));

  if (!finalReport?.content) return [];

  return [{
    id: `${String(finalReport.id || 'final-report')}-deliverable`,
    title: extractFinalReportTitle(finalReport.content),
    subtitle: 'Final assistant report',
    tone: 'document',
    url: null,
    filePath: extractFinalReportFilePath(finalReport.content) || null,
  }];
}

function mergeRunStateWithDerivedState(
  runState: AlgorithmRunState | null,
  derivedRunState: AlgorithmRunState | null,
) {
  if (!derivedRunState) return runState;
  if (!runState) return derivedRunState;
  if (runState.phases && runState.phases.length > 0) return runState;
  return {
    ...derivedRunState,
    ...runState,
    phase: runState.phase || derivedRunState.phase,
    phases: derivedRunState.phases,
    currentPhaseIndex: derivedRunState.currentPhaseIndex,
    currentReviewLine: runState.currentReviewLine || derivedRunState.currentReviewLine,
    taskTitle: runState.taskTitle || derivedRunState.taskTitle,
  };
}

function selectRightPanelRunState({
  runState,
  derivedRunState,
  sessionDeliverables,
  selectedSessionId,
  chatSessionId,
  explicitRunMode,
}: {
  runState: AlgorithmRunState | null;
  derivedRunState: AlgorithmRunState | null;
  sessionDeliverables: AlgorithmDeliverable[];
  selectedSessionId: string | null;
  chatSessionId: string | null;
  explicitRunMode: boolean;
}) {
  const baseRunState = mergeRunStateWithDerivedState(runState, derivedRunState);
  if (sessionDeliverables.length === 0) return baseRunState;

  const runDeliverables = baseRunState?.deliverables ?? [];
  const selectedSessionIds = [selectedSessionId, chatSessionId].filter(Boolean) as string[];
  const runMatchesSelectedSession = Boolean(baseRunState?.sessionId && selectedSessionIds.includes(baseRunState.sessionId));
  const canUseRunDeliverables = runDeliverables.length > 0 && (
    explicitRunMode ||
    selectedSessionIds.length === 0 ||
    runMatchesSelectedSession
  );

  if (canUseRunDeliverables) return baseRunState;

  return {
    runId: baseRunState?.runId || 'selected-session-deliverables',
    provider: baseRunState?.provider || 'claude',
    status: baseRunState?.status || 'completed',
    ...baseRunState,
    deliverables: sessionDeliverables,
  };
}

function isProjectsUpdatedMessage(message: unknown): message is ProjectsUpdatedMessage {
  return isRecord(message) && message.type === 'projects_updated' && Array.isArray(message.projects);
}

function getChangedSessionId(changedFile?: string) {
  if (!changedFile) return '';
  return basename(changedFile).replace(/\.jsonl$/i, '');
}

function doesProjectUpdateTargetSession(message: ProjectsUpdatedMessage, session: SessionWithProvider | null) {
  if (!session) return false;
  return getChangedSessionId(message.changedFile) === session.id;
}

function applyProjectsUpdatedMessage(
  projectsMessage: ProjectsUpdatedMessage,
  currentProjects: Project[],
  selectedProject: Project | null,
  selectedSession: SessionWithProvider | null,
) {
  const nextProjects = projectsMessage.projects.length > 0 ? projectsMessage.projects : currentProjects;
  const nextSelectedProject = selectedProject
    ? nextProjects.find((project) => project.name === selectedProject.name) || selectedProject
    : selectedProject;
  const nextSelectedSession = nextSelectedProject && selectedSession
    ? getProjectSessions(nextSelectedProject).find((session) => (
      session.id === selectedSession.id && session.__provider === selectedSession.__provider
    )) || selectedSession
    : selectedSession;

  return {
    projects: nextProjects,
    selectedProject: nextSelectedProject,
    selectedSession: nextSelectedSession,
  };
}

function buildDeliverableFileHref(projectName: string | null | undefined, filePath: string | null | undefined) {
  if (!projectName || !filePath) return '';
  const params = new URLSearchParams({ path: filePath });
  try {
    const token = localStorage.getItem('auth-token');
    if (token) params.set('token', token);
  } catch {
    // Link remains usable in platform/no-storage contexts that do not require a token.
  }
  return `/api/projects/${encodeURIComponent(projectName)}/files/content?${params.toString()}`;
}

function titleCaseAlgorithmPhase(rawPhase: string) {
  const normalized = rawPhase.toLowerCase();
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

function getLatestTaskLine(text: string) {
  const lines = text.split(/\r?\n/).reverse();
  const taskLine = lines.find((line) => /^\s*(?:TASK|Task)\s*:/.test(line));
  return taskLine?.replace(/^\s*(?:TASK|Task)\s*:\s*/, '').trim() || '';
}

function deriveAlgorithmRunStateFromText(text: string): AlgorithmRunState | null {
  const lines = text.split(/\r?\n/).reverse();
  const progressLine = lines.find((line) => (
    ALGORITHM_PHASE_PATTERN.test(line) && ALGORITHM_PROGRESS_PATTERN.test(line)
  ));
  if (!progressLine) return null;

  const phaseMatch = progressLine.match(ALGORITHM_PHASE_PATTERN);
  const progressMatch = progressLine.match(ALGORITHM_PROGRESS_PATTERN);
  if (!phaseMatch || !progressMatch) return null;

  const currentStep = Number(progressMatch[1]);
  const totalSteps = Number(progressMatch[2]);
  if (!Number.isFinite(currentStep) || !Number.isFinite(totalSteps) || currentStep < 1 || totalSteps < 1) {
    return null;
  }

  const currentPhaseIndex = Math.min(totalSteps - 1, currentStep - 1);
  const phaseTitle = titleCaseAlgorithmPhase(phaseMatch[1]);
  const phases = Array.from({ length: totalSteps }, (_, index) => ({
    id: ALGORITHM_PHASE_TITLES[index]?.toLowerCase() || `phase-${index + 1}`,
    label: `P${index + 1}`,
    title: index === currentPhaseIndex ? phaseTitle : ALGORITHM_PHASE_TITLES[index] || `Phase ${index + 1}`,
    status: index < currentPhaseIndex
      ? 'complete' as const
      : index === currentPhaseIndex
        ? 'active' as const
        : 'idle' as const,
  }));
  const taskTitle = getLatestTaskLine(text);

  return {
    runId: 'chat-algorithm-output',
    provider: 'claude',
    status: 'running',
    taskTitle: taskTitle || undefined,
    phase: phaseTitle,
    phases,
    currentPhaseIndex,
    currentReviewLine: taskTitle || `${phaseTitle} ${currentStep}/${totalSteps}`,
  };
}

function removeSessionFromProject(project: Project, session: SessionWithProvider): Project {
  const remove = (sessions?: ProjectSession[]) => sessions?.filter((item) => item.id !== session.id) ?? [];
  const nextMeta = session.__provider === 'claude'
    ? {
      ...project.sessionMeta,
      total: Math.max(0, Number(project.sessionMeta?.total || 0) - 1),
    }
    : project.sessionMeta;

  return {
    ...project,
    sessions: remove(project.sessions),
    cursorSessions: remove(project.cursorSessions),
    codexSessions: remove(project.codexSessions),
    geminiSessions: remove(project.geminiSessions),
    sessionMeta: nextMeta,
  };
}

function readClaudeModel() {
  if (typeof window === 'undefined') return CLAUDE_MODELS.DEFAULT;
  try {
    return localStorage.getItem('claude-model') || CLAUDE_MODELS.DEFAULT;
  } catch {
    return CLAUDE_MODELS.DEFAULT;
  }
}

function claudeModelLabel(model: string) {
  return CLAUDE_MODELS.OPTIONS.find((option) => option.value === model)?.label || model;
}

function writeClaudeModel(model: string) {
  try {
    localStorage.setItem('claude-model', model);
  } catch {
    // Ignore unavailable storage. The in-memory state still drives this route.
  }
}

function formatTimestamp(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function NolmeAppRoute() {
  const { sendMessage, latestMessage, isConnected } = useWebSocket();
  const [activePanel, setActivePanel] = useState<NavPanelId>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [activeRunId] = useState(readInitialRunId);
  const [explicitRunMode] = useState(readInitialRunIdIsExplicit);
  const [chatView, setChatView] = useState<ChatView>(activeRunId ? 'composer' : 'projects');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionWithProvider | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [loadingSessionsByProject, setLoadingSessionsByProject] = useState<LoadingSessionsByProject>({});
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [runState, setRunState] = useState<AlgorithmRunState | null>(null);
  const [derivedRunState, setDerivedRunState] = useState<AlgorithmRunState | null>(null);
  const [sessionDeliverables, setSessionDeliverables] = useState<AlgorithmDeliverable[]>([]);
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
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatTranscriptItem[]>([]);
  const [selectedModel, setSelectedModel] = useState(readClaudeModel);
  const [currentTime, setCurrentTime] = useState(new Date());
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchSourceRef = useRef<EventSource | null>(null);
  const processedRealtimeIdsRef = useRef(new Set<string>());
  const processedProjectsUpdatedRef = useRef<unknown>(null);
  const sessionRefreshRequestIdRef = useRef(0);
  const selectedSessionRef = useRef<SessionWithProvider | null>(null);
  const chatSessionIdRef = useRef<string | null>(null);
  const algorithmOutputTextRef = useRef('');
  const runEventSequence = runState?.eventCursor?.sequence ?? null;
  const rightPanelRunState = useMemo(() => {
    return selectRightPanelRunState({
      runState,
      derivedRunState,
      sessionDeliverables,
      selectedSessionId: selectedSession?.id ?? null,
      chatSessionId,
      explicitRunMode,
    });
  }, [chatSessionId, derivedRunState, explicitRunMode, runState, selectedSession?.id, sessionDeliverables]);

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  useEffect(() => {
    chatSessionIdRef.current = chatSessionId;
  }, [chatSessionId]);

  const captureAlgorithmOutput = useCallback((content: string) => {
    algorithmOutputTextRef.current = `${algorithmOutputTextRef.current}${content}`;
    const nextRunState = deriveAlgorithmRunStateFromText(algorithmOutputTextRef.current);
    if (nextRunState) {
      setDerivedRunState(nextRunState);
    }
  }, []);

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
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);

    api.projects()
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.error ||
            body?.message ||
            `Failed to load projects (${response.status || 'unknown status'})`,
          );
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const nextProjects = normalizeProjectsPayload(data);
        setProjects(nextProjects);
        setProjectsError(null);
        setExpandedProjects((previous) => {
          if (previous.size > 0) return previous;
          const firstProject = nextProjects[0]?.name;
          return firstProject ? new Set([firstProject]) : previous;
        });
        setSelectedProject((previous) => {
          if (!previous) return previous;
          return nextProjects.find((project) => project.name === previous.name) || previous;
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setProjects([]);
        setProjectsError(error instanceof Error ? error.message : 'Failed to load projects');
      })
      .finally(() => {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const refreshModel = () => setSelectedModel(readClaudeModel());
    window.addEventListener('storage', refreshModel);
    window.addEventListener('focus', refreshModel);
    return () => {
      window.removeEventListener('storage', refreshModel);
      window.removeEventListener('focus', refreshModel);
    };
  }, []);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    writeClaudeModel(model);
  };

  const selectPanel = (panel: NavPanelId) => {
    setActivePanel(panel);
    if (panel === 'chat') {
      setChatView('projects');
    }
  };

  const openComposerForProject = (project: Project) => {
    sessionRefreshRequestIdRef.current += 1;
    setSelectedProject(project);
    setSelectedSession(null);
    selectedSessionRef.current = null;
    setChatSessionId(null);
    chatSessionIdRef.current = null;
    setChatMessages([]);
    setSessionDeliverables([]);
    algorithmOutputTextRef.current = '';
    setDerivedRunState(null);
    setRunError(null);
    setChatView('composer');
    setActivePanel('chat');
  };

  const loadSelectedSessionMessages = useCallback(async (
    project: Project,
    session: SessionWithProvider,
    options: RefreshSessionOptions = {},
  ) => {
    const provider = getSessionProvider(session);
    const requestId = sessionRefreshRequestIdRef.current + 1;
    sessionRefreshRequestIdRef.current = requestId;
    if (options.showSpinner) {
      setLoadingSessionId(session.id);
    }

    try {
      const response = await api.unifiedSessionMessages(session.id, provider, {
        projectName: project.name,
        projectPath: getProjectPath(project),
      });
      const body = await response.json().catch(() => ({})) as UnifiedSessionMessagesBody;
      if (!response.ok) {
        const errorMessage = typeof body.error === 'string'
          ? body.error
          : body.error?.message || body.message || `Failed to load session ${session.id}`;
        throw new Error(errorMessage);
      }

      const isLatestRequest = sessionRefreshRequestIdRef.current === requestId;
      const isCurrentSession = selectedSessionRef.current?.id === session.id && chatSessionIdRef.current === session.id;
      if (!isLatestRequest || !isCurrentSession) return;

      const rawMessages = Array.isArray(body.messages) ? body.messages : [];
      const messages = mapTranscriptMessages(rawMessages);
      setChatMessages(messages);
      const algorithmOutput = messages
        .filter((message) => message.role === 'assistant')
        .map((message) => message.body)
        .join('\n');
      algorithmOutputTextRef.current = algorithmOutput;
      setDerivedRunState(deriveAlgorithmRunStateFromText(algorithmOutput));
      setSessionDeliverables(deriveSessionDeliverables(rawMessages));
      setRunError(null);
    } catch (error) {
      const isLatestRequest = sessionRefreshRequestIdRef.current === requestId;
      const isCurrentSession = selectedSessionRef.current?.id === session.id && chatSessionIdRef.current === session.id;
      if (isLatestRequest && isCurrentSession) {
        setRunError(error instanceof Error ? error.message : 'Failed to load session');
      }
    } finally {
      const isLatestRequest = sessionRefreshRequestIdRef.current === requestId;
      if (isLatestRequest && options.showSpinner) {
        setLoadingSessionId(null);
      }
    }
  }, []);

  const openSession = async (project: Project, session: SessionWithProvider) => {
    const provider = getSessionProvider(session);
    setSelectedProject(project);
    setSelectedSession(session);
    selectedSessionRef.current = session;
    setChatSessionId(session.id);
    chatSessionIdRef.current = session.id;
    setChatView('composer');
    setActivePanel('chat');
    setRunError(null);
    setChatMessages([]);
    setSessionDeliverables([]);
    algorithmOutputTextRef.current = '';
    setDerivedRunState(null);
    try {
      localStorage.setItem('selected-provider', provider);
    } catch {
      // Ignore storage failures.
    }

    await loadSelectedSessionMessages(project, session, { showSpinner: true });
  };

  const deleteSession = async (project: Project, session: SessionWithProvider) => {
    const sessionTitle = getSessionTitle(session);
    if (!window.confirm(`Delete "${sessionTitle}"? This cannot be undone.`)) {
      return;
    }

    const provider = getSessionProvider(session);
    if (provider === 'cursor') {
      setRunError('Cursor session deletion is not supported yet.');
      return;
    }

    try {
      const response = provider === 'codex'
        ? await api.deleteCodexSession(session.id)
        : provider === 'gemini'
          ? await api.deleteGeminiSession(session.id)
          : await api.deleteSession(project.name, session.id);

      if (!response.ok) {
        throw new Error(`Failed to delete session ${session.id}`);
      }

      setProjects((items) => items.map((item) => (
        item.name === project.name ? removeSessionFromProject(item, session) : item
      )));

      if (selectedSession?.id === session.id) {
        sessionRefreshRequestIdRef.current += 1;
        setSelectedSession(null);
        selectedSessionRef.current = null;
        setChatSessionId(null);
        chatSessionIdRef.current = null;
        setChatMessages([]);
        setSessionDeliverables([]);
        setChatView('projects');
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to delete session');
    }
  };

  const loadMoreSessions = async (project: Project) => {
    if (loadingSessionsByProject[project.name]) return;
    setLoadingSessionsByProject((items) => ({ ...items, [project.name]: true }));
    try {
      const offset = project.sessions?.length ?? 0;
      const response = await api.sessions(project.name, 5, offset);
      if (!response.ok) return;
      const body = await response.json();
      const nextSessions = Array.isArray(body.sessions) ? body.sessions : [];
      setProjects((items) => items.map((item) => (
        item.name === project.name
          ? {
            ...item,
            sessions: [...(item.sessions || []), ...nextSessions],
            sessionMeta: {
              ...item.sessionMeta,
              hasMore: Boolean(body.hasMore),
            },
          }
          : item
      )));
    } catch {
      // Keep the browser stable if pagination fails.
    } finally {
      setLoadingSessionsByProject((items) => ({ ...items, [project.name]: false }));
    }
  };

  const toggleProject = (projectName: string) => {
    setExpandedProjects((previous) => {
      const next = new Set(previous);
      if (next.has(projectName)) {
        next.delete(projectName);
      } else {
        next.add(projectName);
      }
      return next;
    });
  };

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
    const message = latestMessage;
    if (!message) return;

    if (isProjectsUpdatedMessage(message)) {
      if (processedProjectsUpdatedRef.current === message) return;
      processedProjectsUpdatedRef.current = message;

      const update = applyProjectsUpdatedMessage(message, projects, selectedProject, selectedSession);
      setProjects(update.projects);
      setProjectsLoading(false);
      setProjectsError(null);
      setSelectedProject(update.selectedProject);
      setSelectedSession(update.selectedSession);
      selectedSessionRef.current = update.selectedSession;

      if (doesProjectUpdateTargetSession(message, selectedSession) && update.selectedProject && update.selectedSession) {
        void loadSelectedSessionMessages(update.selectedProject, update.selectedSession, { showSpinner: false });
      }
      return;
    }

    if (message.provider !== 'claude') return;
    if (message.id && processedRealtimeIdsRef.current.has(message.id)) return;
    if (message.id) {
      processedRealtimeIdsRef.current.add(message.id);
    }
    if (chatSessionId && message.sessionId && message.sessionId !== chatSessionId) return;

    if (message.kind === 'session_created' && message.newSessionId) {
      setChatSessionId(String(message.newSessionId));
      return;
    }

    if (message.kind === 'text' && message.role === 'assistant' && message.content) {
      captureAlgorithmOutput(`\n${String(message.content)}`);
      setChatMessages((items) => [
        ...items,
        {
          id: message.id || `assistant-${Date.now()}`,
          role: 'assistant',
          body: String(message.content),
          timestamp: message.timestamp || new Date().toISOString(),
        },
      ]);
      return;
    }

    if (message.kind === 'stream_delta' && message.content) {
      captureAlgorithmOutput(String(message.content));
      setChatMessages((items) => {
        const last = items.at(-1);
        if (last?.role === 'assistant' && last.streaming) {
          return [
            ...items.slice(0, -1),
            { ...last, body: `${last.body}${message.content}` },
          ];
        }
        return [
          ...items,
          {
            id: message.id || `assistant-stream-${Date.now()}`,
            role: 'assistant',
            body: String(message.content),
            timestamp: message.timestamp || new Date().toISOString(),
            streaming: true,
          },
        ];
      });
      return;
    }

    if (message.kind === 'stream_end') {
      setChatMessages((items) => {
        const last = items.at(-1);
        if (last?.role !== 'assistant' || !last.streaming) return items;
        return [...items.slice(0, -1), { ...last, streaming: false }];
      });
      return;
    }

    if (message.kind === 'error') {
      setRunError(String(message.content || 'LLM request failed'));
      setIsStartingRun(false);
      return;
    }

    if (message.kind === 'complete') {
      setIsStartingRun(false);
    }
  }, [captureAlgorithmOutput, chatSessionId, latestMessage, loadSelectedSessionMessages, projects, selectedProject, selectedSession]);

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

  const handleSendPrompt = () => {
    const trimmedPrompt = prompt.trim();
    const projectPath = getProjectPath(selectedProject);
    if (!trimmedPrompt || isStartingRun) return;
    if (!isConnected) {
      setRunError('The LLM connection is not ready yet. Reconnect and try again.');
      return;
    }
    if (!projectPath) {
      setRunError('Select or create a project before sending a message.');
      return;
    }

    setIsStartingRun(true);
    setRunError(null);
    const timestamp = new Date().toISOString();
    setChatMessages((items) => [
      ...items,
      {
        id: `user-${timestamp}`,
        role: 'user',
        body: trimmedPrompt,
        timestamp,
      },
    ]);

    let toolsSettings = { allowedTools: [], disallowedTools: [], skipPermissions: false };
    try {
      const savedSettings = localStorage.getItem('claude-settings');
      if (savedSettings) {
        toolsSettings = { ...toolsSettings, ...JSON.parse(savedSettings) };
      }
    } catch {
      // Keep default tool settings if local storage is unavailable or malformed.
    }

    sendMessage({
      type: 'claude-command',
      command: trimmedPrompt,
      options: {
        projectPath,
        cwd: projectPath,
        toolsSettings,
        permissionMode: 'default',
        model: selectedModel,
        sessionSummary: selectedSkill?.name || trimmedPrompt.slice(0, 80),
        sessionId: chatSessionId,
        resume: Boolean(chatSessionId),
      },
    });
    setPrompt('');
    setActivePanel('chat');
    setChatView('composer');
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
        onSelectPanel={selectPanel}
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
            setChatView('composer');
          }}
        />
      ) : chatView === 'projects' ? (
        <ProjectsPanel
          projects={projects}
          isLoading={projectsLoading}
          error={projectsError}
          expandedProjects={expandedProjects}
          selectedSession={selectedSession}
          loadingSessionsByProject={loadingSessionsByProject}
          loadingSessionId={loadingSessionId}
          currentTime={currentTime}
          onToggleProject={toggleProject}
          onNewSession={openComposerForProject}
          onOpenSession={openSession}
          onDeleteSession={deleteSession}
          onLoadMoreSessions={loadMoreSessions}
        />
      ) : (
        <ChatPanel
          runState={runState}
          chatMessages={chatMessages}
          runError={runError}
          prompt={prompt}
          selectedSkill={selectedSkill}
          selectedProject={selectedProject}
          modelLabel={claudeModelLabel(selectedModel)}
          modelValue={selectedModel}
          onModelChange={handleModelChange}
          isStartingRun={isStartingRun}
          decisionError={decisionError}
          onPromptChange={setPrompt}
          onStartRun={handleSendPrompt}
          onAnswerQuestion={answerQuestion}
          onDecidePermission={decidePermission}
          onOpenSkills={() => setActivePanel('tasks')}
          onRefreshRun={() => activeRunId && loadRunState(activeRunId)}
        />
      )}

      <RightPanel runState={rightPanelRunState} projectName={selectedProject?.name ?? null} />

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

function ProjectsPanel({
  projects,
  isLoading,
  error,
  expandedProjects,
  selectedSession,
  loadingSessionsByProject,
  loadingSessionId,
  currentTime,
  onToggleProject,
  onNewSession,
  onOpenSession,
  onDeleteSession,
  onLoadMoreSessions,
}: {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  expandedProjects: Set<string>;
  selectedSession: SessionWithProvider | null;
  loadingSessionsByProject: LoadingSessionsByProject;
  loadingSessionId: string | null;
  currentTime: Date;
  onToggleProject: (projectName: string) => void;
  onNewSession: (project: Project) => void;
  onOpenSession: (project: Project, session: SessionWithProvider) => void;
  onDeleteSession: (project: Project, session: SessionWithProvider) => void;
  onLoadMoreSessions: (project: Project) => void;
}) {
  return (
    <main className="nolme-app__chat-stream nolme-app__workspace-panel" aria-label="Projects and sessions">
      <section className="nolme-app__panel-card nolme-app__projects-panel">
        <header className="nolme-app__panel-header">
          <div>
            <Folder aria-hidden="true" size={22} />
            <h1>Projects</h1>
          </div>
        </header>

        {isLoading ? (
          <div className="nolme-app__panel-loading" role="status" aria-label="Loading projects">
            <Loader2 aria-hidden="true" size={24} />
            <strong>Loading projects</strong>
            <span>Scanning saved project sessions.</span>
          </div>
        ) : error ? (
          <EmptyPanel icon={AlertCircle} title="Projects failed to load" body={error} />
        ) : projects.length === 0 ? (
          <EmptyPanel icon={Folder} title="No projects found" body="Saved projects and sessions will appear here once they are available." />
        ) : (
          <div className="nolme-app__project-list">
            {projects.map((project) => (
              <ProjectSessionGroup
                key={project.name}
                project={project}
                isExpanded={expandedProjects.has(project.name)}
                selectedSession={selectedSession}
                isLoadingMore={Boolean(loadingSessionsByProject[project.name])}
                loadingSessionId={loadingSessionId}
                currentTime={currentTime}
                onToggleProject={onToggleProject}
                onNewSession={onNewSession}
                onOpenSession={onOpenSession}
                onDeleteSession={onDeleteSession}
                onLoadMoreSessions={onLoadMoreSessions}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ProjectSessionGroup({
  project,
  isExpanded,
  selectedSession,
  isLoadingMore,
  loadingSessionId,
  currentTime,
  onToggleProject,
  onNewSession,
  onOpenSession,
  onDeleteSession,
  onLoadMoreSessions,
}: {
  project: Project;
  isExpanded: boolean;
  selectedSession: SessionWithProvider | null;
  isLoadingMore: boolean;
  loadingSessionId: string | null;
  currentTime: Date;
  onToggleProject: (projectName: string) => void;
  onNewSession: (project: Project) => void;
  onOpenSession: (project: Project, session: SessionWithProvider) => void;
  onDeleteSession: (project: Project, session: SessionWithProvider) => void;
  onLoadMoreSessions: (project: Project) => void;
}) {
  const sessions = getProjectSessions(project);
  const projectLabel = getProjectLabel(project);
  const projectPath = getProjectPath(project);
  const sessionCount = project.sessionMeta?.hasMore ? `${sessions.length}+` : String(sessions.length);

  return (
    <article className="nolme-app__project-group">
      <button
        type="button"
        className="nolme-app__project-row"
        aria-expanded={isExpanded}
        onClick={() => onToggleProject(project.name)}
      >
        {isExpanded ? <FolderOpen aria-hidden="true" size={18} /> : <Folder aria-hidden="true" size={18} />}
        <span>
          <strong>{projectLabel}</strong>
          <small>{sessionCount} sessions - {projectPath || project.name}</small>
        </span>
        <ChevronDown aria-hidden="true" size={16} className={cn(isExpanded && 'nolme-app__chevron--open')} />
      </button>

      {isExpanded && (
        <div className="nolme-app__project-sessions">
          <button
            type="button"
            className="nolme-app__new-session-button"
            aria-label={`New session for ${projectLabel}`}
            onClick={() => onNewSession(project)}
          >
            <Plus aria-hidden="true" size={16} />
            New Session
          </button>

          {sessions.length === 0 ? (
            <p className="nolme-app__panel-muted">No sessions yet.</p>
          ) : (
            sessions.map((session) => (
              <ProjectSessionRow
                key={`${session.__provider}-${session.id}`}
                project={project}
                session={session}
                isSelected={selectedSession?.id === session.id}
                isLoading={loadingSessionId === session.id}
                currentTime={currentTime}
                onOpenSession={onOpenSession}
                onDeleteSession={onDeleteSession}
              />
            ))
          )}

          {project.sessionMeta?.hasMore && (
            <button
              type="button"
              className="nolme-app__show-more-sessions"
              aria-label={`Show more sessions for ${projectLabel}`}
              disabled={isLoadingMore}
              onClick={() => onLoadMoreSessions(project)}
            >
              {isLoadingMore ? <Loader2 aria-hidden="true" size={14} /> : <ChevronDown aria-hidden="true" size={14} />}
              {isLoadingMore ? 'Loading sessions' : 'Show more sessions'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function ProjectSessionRow({
  project,
  session,
  isSelected,
  isLoading,
  currentTime,
  onOpenSession,
  onDeleteSession,
}: {
  project: Project;
  session: SessionWithProvider;
  isSelected: boolean;
  isLoading: boolean;
  currentTime: Date;
  onOpenSession: (project: Project, session: SessionWithProvider) => void;
  onDeleteSession: (project: Project, session: SessionWithProvider) => void;
}) {
  const sessionTitle = getSessionTitle(session);
  const sessionTime = getSessionTime(session);
  const relativeTime = sessionTime
    ? formatTimeAgo(sessionTime, currentTime, undefined as unknown as Parameters<typeof formatTimeAgo>[2])
    : 'Unknown';
  const messageCount = getSessionCount(session);
  const canDelete = session.__provider !== 'cursor';

  return (
    <div className={cn('nolme-app__session-row', isSelected && 'nolme-app__session-row--selected')}>
      <button
        type="button"
        className="nolme-app__session-open"
        aria-label={`Open session ${sessionTitle}`}
        onClick={() => onOpenSession(project, session)}
      >
        <span className="nolme-app__session-provider" aria-label={`${session.__provider} session`}>
          <SessionProviderLogo provider={session.__provider} className="nolme-app__session-logo" />
        </span>
        <span className="nolme-app__session-copy">
          <strong>{sessionTitle}</strong>
          <small>
            <Clock aria-hidden="true" size={12} />
            {relativeTime}
          </small>
        </span>
        {messageCount > 0 && <em>{messageCount}</em>}
        {isLoading && <Loader2 aria-hidden="true" size={14} />}
      </button>

      {canDelete && (
        <button
          type="button"
          className="nolme-app__session-delete"
          aria-label={`Delete session ${sessionTitle}`}
          onClick={() => onDeleteSession(project, session)}
        >
          <Trash2 aria-hidden="true" size={14} />
        </button>
      )}
    </div>
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
  chatMessages,
  runError,
  prompt,
  selectedSkill,
  selectedProject,
  modelLabel,
  modelValue,
  onModelChange,
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
  chatMessages: ChatTranscriptItem[];
  runError: string | null;
  prompt: string;
  selectedSkill: Skill | null;
  selectedProject: Project | null;
  modelLabel: string;
  modelValue: string;
  onModelChange: (model: string) => void;
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
    : isStartingRun
      ? 'Waiting for the LLM response.'
      : 'Send a message to the LLM. Algorithm phase events will appear when a run is active.';

  return (
    <main className="nolme-app__chat-stream" aria-label="Nolme chat stream">
      <div className="nolme-app__messages" role="log" aria-label="Conversation history" aria-live="polite">
        {chatMessages.map((message) => (
          message.role === 'user'
            ? <ChatBubble key={message.id} body={message.body} timestamp={message.timestamp} />
            : <AssistantBubble key={message.id} body={message.body} timestamp={message.timestamp} />
        ))}

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
          selectedProject={selectedProject}
          modelLabel={modelLabel}
          modelValue={modelValue}
          onModelChange={onModelChange}
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

function AssistantBubble({ body, timestamp }: { body: string; timestamp: string }) {
  return (
    <div className="nolme-app__assistant-row">
      <AgentAvatar />
      <article className="nolme-app__assistant-bubble">
        <p>{body}</p>
        <footer>{formatTimestamp(timestamp) || timestamp}</footer>
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
  selectedProject,
  modelLabel,
  modelValue,
  onModelChange,
  isWorking,
  progress,
  onPromptChange,
  onStartRun,
  onOpenSkills,
  onRefreshRun,
}: {
  prompt: string;
  selectedSkill: Skill | null;
  selectedProject: Project | null;
  modelLabel: string;
  modelValue: string;
  onModelChange: (model: string) => void;
  isWorking: boolean;
  progress: number;
  onPromptChange: (value: string) => void;
  onStartRun: () => void;
  onOpenSkills: () => void;
  onRefreshRun: () => void;
}) {
  const modelOptions = CLAUDE_MODELS.OPTIONS.some((option) => option.value === modelValue)
    ? CLAUDE_MODELS.OPTIONS
    : [{ value: modelValue, label: modelLabel }, ...CLAUDE_MODELS.OPTIONS];
  const selectedProjectPath = getProjectPath(selectedProject);

  return (
    <section className="nolme-app__composer" aria-label="Message composer">
      <div className="nolme-app__composer-toolbar">
        <div className="nolme-app__agent-details">
          <div className="nolme-app__agent-profile">
            <AgentAvatar />
            <span>{selectedSkill ? selectedSkill.name : selectedProject ? getProjectLabel(selectedProject) : 'Select a project'}</span>
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
          placeholder="Message the LLM..."
          aria-label="Message prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            if (event.shiftKey || event.ctrlKey || event.metaKey) return;
            event.preventDefault();
            onStartRun();
          }}
        />

        <div className="nolme-app__input-status">
          <div className="nolme-app__input-left">
            <button type="button" className="nolme-app__icon-button" aria-label="Attach file" title="Attach file" disabled>
              <Plus aria-hidden="true" size={24} strokeWidth={1.8} />
            </button>
            <div className="nolme-app__model-picker">
              <select
                aria-label="Claude model"
                className="nolme-app__model-select"
                title={`Selected Claude model ${modelLabel}`}
                value={modelValue}
                onChange={(event) => onModelChange(event.target.value)}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={12} strokeWidth={2} />
            </div>
          </div>

          <div className="nolme-app__input-right">
            <span>claude</span>
            {isWorking && (
              <button type="button" className="nolme-app__stop-button" aria-label="Stop generation" title="Stop generation" disabled>
                <Square aria-hidden="true" size={12} fill="currentColor" strokeWidth={0} />
              </button>
            )}
            <button type="button" className="nolme-app__send-button" disabled={isWorking || !prompt.trim() || !selectedProjectPath} onClick={onStartRun}>
              {isWorking ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function RightPanel({ runState, projectName }: { runState: AlgorithmRunState | null; projectName: string | null }) {
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
                <DeliverableRow key={deliverable.id} deliverable={deliverable} projectName={projectName} />
              ))}
            </>
          )}
        </div>
      </section>
    </aside>
  );
}

function DeliverableRow({ deliverable, projectName }: { deliverable: AlgorithmDeliverable; projectName: string | null }) {
  const fileHref = buildDeliverableFileHref(projectName, deliverable.filePath);
  const href = deliverable.url || fileHref;
  const Icon = deliverable.filePath || deliverable.action === 'download'
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

  if (href) {
    return (
      <a className="nolme-app__deliverable-row nolme-app__deliverable-link" href={href} target="_blank" rel="noreferrer">
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
