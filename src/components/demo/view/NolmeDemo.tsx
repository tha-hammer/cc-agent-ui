import { useEffect, useState } from 'react';
import {
  AudioLines,
  CalendarRange,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  CirclePlay,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  House,
  Link2,
  ListTodo,
  Mail,
  MapPinned,
  MessageCircle,
  Pause,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  UserCog,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import './NolmeDemo.css';

type ResourceId = 'brief' | 'audience' | 'venues' | 'promo' | 'post';

type OutputTone = 'white' | 'lavender' | 'amber' | 'mint';

type OutputCard = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: 'doc' | 'sheet' | 'map' | 'mail' | 'price' | 'calendar' | 'sparkles' | 'globe';
  tone?: OutputTone;
  rating?: number;
  cta?: string;
};

type Beat = {
  id: string;
  label: string;
  reviewLine: string;
  title: string;
  scriptFocus: string;
  taskHeading: string;
  statusLabel: string;
  assistantCopy: string;
  userMessage?: string;
  thinkingLabel?: string;
  quickActions: string[];
  approvals: string[];
  outputs: OutputCard[];
  resources: ResourceId[];
  mode: 'empty' | 'cards' | 'venues';
};

const WORKFLOW_PHASES = [
  { label: 'Phase 1', title: 'Audience & venue' },
  { label: 'Phase 2', title: 'Promote & sell' },
  { label: 'Phase 3', title: 'Post-event' },
];

const RESOURCE_LIBRARY: Record<
  ResourceId,
  {
    badge: string;
    title: string;
    subtitle: string;
    tone: 'emerald' | 'iris' | 'gold';
    action: 'download' | 'link';
  }
> = {
  brief: {
    badge: 'P1',
    title: 'Workflow brief',
    subtitle: 'Google Document',
    tone: 'emerald',
    action: 'download',
  },
  audience: {
    badge: 'P2',
    title: 'Warm audience',
    subtitle: 'Google Sheet • 142 contacts',
    tone: 'iris',
    action: 'download',
  },
  venues: {
    badge: 'P2',
    title: 'Venue matches',
    subtitle: 'Luma • 3 locations',
    tone: 'iris',
    action: 'link',
  },
  promo: {
    badge: 'P3',
    title: 'Promo kit',
    subtitle: 'Email + SMS previews',
    tone: 'gold',
    action: 'download',
  },
  post: {
    badge: 'P4',
    title: 'Post-event kit',
    subtitle: 'Forms + thank-you templates',
    tone: 'gold',
    action: 'download',
  },
};

const DEMO_BEATS: Beat[] = [
  {
    id: 'opening',
    label: 'Scene 1',
    reviewLine: 'Opening on a blank workspace with quick actions ready',
    title: 'Empty dashboard start',
    scriptFocus: 'Start on an empty dashboard where the user can prompt and watch the workflow form around the agent.',
    taskHeading: 'New workflow',
    statusLabel: 'Waiting for input',
    assistantCopy:
      'Everything is empty by design here. The point of the demo is to show the system thinking in public as the workflow takes shape.',
    quickActions: ['Draft workflow brief', 'Map audience + venue', 'Outline phases'],
    approvals: [],
    outputs: [],
    resources: [],
    mode: 'empty',
  },
  {
    id: 'anchors',
    label: 'Scene 2',
    reviewLine: 'Anchors attached before prompting',
    title: 'Attach the agent context',
    scriptFocus:
      'Add the AI job description and principles so the assistant has explicit operating rules before any work begins.',
    taskHeading: 'Context intake',
    statusLabel: 'Anchors attached',
    assistantCopy:
      'I have the AI job description and the principles now. I will bias toward operations, project management, retention, and measurable outputs.',
    quickActions: ['Summarize context', 'Draft kickoff brief', 'Suggest the first workflow'],
    approvals: [],
    outputs: [
      {
        id: 'job',
        title: 'AI job description',
        subtitle: 'Attached anchor',
        description: 'Operating role, remit, and execution posture are now in scope.',
        icon: 'doc',
        tone: 'lavender',
      },
      {
        id: 'principles',
        title: 'Principles & guidelines',
        subtitle: 'Attached anchor',
        description: 'Messaging and decision rules will stay grounded while the plan unfolds.',
        icon: 'sparkles',
        tone: 'white',
      },
    ],
    resources: [],
    mode: 'cards',
  },
  {
    id: 'kickoff',
    label: 'Scene 3',
    reviewLine: 'Quick action begins the first workflow',
    title: 'Kick off from a quick action',
    scriptFocus:
      'Use a quick action instead of raw typing to show how the product shortens time-to-value at the very start.',
    taskHeading: 'Kickoff prompt',
    statusLabel: 'Synthesizing brief',
    assistantCopy:
      'Starting with a quick action lets the workspace move from a blank state into something directional without a long setup prompt.',
    userMessage:
      'Use the attached context to build a launch workflow for a community event. Start with the best first step and keep it operational.',
    thinkingLabel: 'Building the initial brief and mapping the first execution phase...',
    quickActions: ['Generate full brief', 'Summarize the audience', 'Start the first workflow'],
    approvals: [],
    outputs: [
      {
        id: 'brief-draft',
        title: 'Kickoff brief draft',
        subtitle: 'Summary',
        description: 'Event concept, audience, objectives, and an execution-first point of view.',
        icon: 'doc',
        tone: 'white',
      },
      {
        id: 'workflow-draft',
        title: 'First workflow lane',
        subtitle: 'Suggested',
        description: 'Audience and venue discovery is the fastest path to a concrete first deliverable.',
        icon: 'map',
        tone: 'lavender',
      },
    ],
    resources: [],
    mode: 'cards',
  },
  {
    id: 'breakdown',
    label: 'Scene 4',
    reviewLine: 'Agent proposes the phased plan and asks for approval',
    title: 'Surface the phase breakdown',
    scriptFocus:
      'Show all of the steps while interacting with the agent, including a summary, approval request, and task estimate.',
    taskHeading: 'Execution plan',
    statusLabel: 'Ready for approval',
    assistantCopy:
      'Here is the phased plan: audience and venue, promote and sell, then post-event follow-up. Estimated runtime is 18 minutes with approval gates between each phase.',
    quickActions: ['Tune the audience', 'Refine the goal', 'Adjust the estimate'],
    approvals: ['Approve phase plan', 'Revise audience', 'Refine goals'],
    outputs: [
      {
        id: 'phase-one',
        title: 'Phase 1',
        subtitle: 'Audience & venue',
        description: 'Warm audience list, venue matches, and the operating brief.',
        icon: 'map',
        tone: 'white',
      },
      {
        id: 'phase-two',
        title: 'Phase 2',
        subtitle: 'Promote & sell',
        description: 'Pricing, event setup, and channel-specific message previews.',
        icon: 'price',
        tone: 'white',
      },
      {
        id: 'phase-three',
        title: 'Phase 3',
        subtitle: 'Post-event',
        description: 'Survey plan, thank-you emails, and the reporting loop.',
        icon: 'calendar',
        tone: 'white',
      },
    ],
    resources: [],
    mode: 'cards',
  },
  {
    id: 'phase-one-approved',
    label: 'Scene 5',
    reviewLine: 'Phase 1 approved and moving',
    title: 'Confirm the first phase',
    scriptFocus:
      'Get explicit human approval before execution, then show the first phase running with a brief as an immediate artifact.',
    taskHeading: 'Phase 1: Kickoff',
    statusLabel: 'Approved and running',
    assistantCopy:
      'Phase 1 is active. I am packaging the workflow brief and creating the first output bucket so the work becomes tangible immediately.',
    userMessage: 'Looks good. Start phase 1 and keep the summary visible while you work.',
    thinkingLabel: 'Drafting the workflow brief and pulling the first operating outputs...',
    quickActions: ['Preview the brief', 'Inspect the estimate', 'Open attached context'],
    approvals: ['Confirm Phase 1', 'Ask a question while working'],
    outputs: [
      {
        id: 'brief',
        title: 'Workflow brief',
        subtitle: 'Google Doc draft',
        description: 'Message, audience, constraints, and operating checkpoints are locked in.',
        icon: 'doc',
        tone: 'white',
      },
      {
        id: 'estimate',
        title: 'Task estimate',
        subtitle: '18 minutes total',
        description: 'Execution remains chunked by approvals so the user stays in control of each phase.',
        icon: 'sparkles',
        tone: 'lavender',
      },
    ],
    resources: ['brief'],
    mode: 'cards',
  },
  {
    id: 'phase-two-run',
    label: 'Scene 6',
    reviewLine: 'Audience and venue outputs arrive',
    title: 'Build the audience and venue package',
    scriptFocus:
      'Move into phase two: pull a warm audience list, provide venue matches, and recommend the best promotion channel.',
    taskHeading: 'Phase 1: Audience & venue',
    statusLabel: 'Ready to review',
    assistantCopy:
      'I pulled a warm audience list, narrowed the venue options, and flagged the highest-conversion channel for this event concept.',
    quickActions: ['Open warm audience', 'Review venue logic', 'Inspect channel choice'],
    approvals: ['Confirm Phase 2', 'Change audience filters', 'Swap venue focus'],
    outputs: [
      {
        id: 'audience',
        title: 'Warm audience',
        subtitle: '142 qualified contacts',
        description: 'Past RSVPs, newsletter readers, and community members with the highest engagement signals.',
        icon: 'sheet',
        tone: 'white',
      },
      {
        id: 'matches',
        title: 'Venue shortlist',
        subtitle: '3 top matches',
        description: 'Filtered around cost, accessibility, neighborhood fit, and attendee comfort.',
        icon: 'map',
        tone: 'white',
      },
      {
        id: 'channel',
        title: 'Primary channel',
        subtitle: 'Community-led promotion',
        description: 'Lead with Luma plus warm outreach, then layer email and text follow-up.',
        icon: 'globe',
        tone: 'lavender',
      },
    ],
    resources: ['brief', 'audience', 'venues'],
    mode: 'cards',
  },
  {
    id: 'phase-two-approved',
    label: 'Scene 7',
    reviewLine: 'Phase 2 confirmed and promote-and-sell phase opens',
    title: 'Lock phase two and continue',
    scriptFocus:
      'Confirm the audience and venue output, then carry that momentum into pricing and promotion with clear approvals.',
    taskHeading: 'Phase 2: Promote & sell',
    statusLabel: 'Queued to execute',
    assistantCopy:
      'Phase 1 is approved. I am carrying the audience, venue, and brief into pricing, event setup, and outreach preview generation.',
    userMessage: 'Proceed into pricing and promotion. Keep the venue criteria visible while you work.',
    thinkingLabel: 'Drafting the pricing ladder, event setup, and first outreach examples...',
    quickActions: ['Open Luma draft', 'Preview pricing model', 'Review venue shortlist'],
    approvals: ['Approve phase handoff', 'Revise pricing guardrail'],
    outputs: [
      {
        id: 'pricing',
        title: 'Pricing guardrail',
        subtitle: 'Venue target <= $2500',
        description: 'Budget constraints are preserved so the model and shortlist stay realistic.',
        icon: 'price',
        tone: 'amber',
      },
      {
        id: 'handoff',
        title: 'Phase handoff',
        subtitle: 'Audience + venue retained',
        description: 'All previous outputs remain accessible in the resources rail while the next phase runs.',
        icon: 'sparkles',
        tone: 'white',
      },
    ],
    resources: ['brief', 'audience', 'venues'],
    mode: 'cards',
  },
  {
    id: 'venue-review',
    label: 'Scene 8',
    reviewLine: 'Reviewing task 3 of 3 - Event venue choices and reason',
    title: 'Venue pricing review in motion',
    scriptFocus:
      'This is the hero state from the frame: live venue review, conversational follow-up, and visible AI work while pricing constraints are applied.',
    taskHeading: 'Phase 3: Task 3',
    statusLabel: 'Ready to review',
    assistantCopy:
      'I’ve pulled up 3 locations for the event in Luma that fit the criteria of the audience type, location, accommodations and pricing. I have provided three links to preview the venues and also listed out a summary here of the accommodations and costs.',
    userMessage: 'Can we adjust the pricing to be $2500 or lower for the venue locations.',
    thinkingLabel: 'Browsing all locations that fit pricing criteria...',
    quickActions: ['Open Luma draft', 'Inspect venue scoring', 'Review cost assumptions'],
    approvals: ['Confirm Phase 3 👍', 'Make changes to locations', 'Look for event issues'],
    outputs: [
      {
        id: 'venue-one',
        title: 'Common Space',
        subtitle: '3108B Filmore St, San Francisco, CA',
        description: 'Budget: $2400 • 120 guests • AV included',
        icon: 'map',
        rating: 4.9,
      },
      {
        id: 'venue-two',
        title: 'Common Space',
        subtitle: '3108B Filmore St, San Francisco, CA',
        description: 'Budget: $2350 • 96 guests • Fast setup',
        icon: 'map',
        rating: 4.8,
      },
      {
        id: 'venue-three',
        title: 'Common Space',
        subtitle: '3108B Filmore St, San Francisco, CA',
        description: 'Budget: $2285 • 110 guests • Best neighborhood fit',
        icon: 'map',
        rating: 4.7,
      },
    ],
    resources: ['brief', 'audience', 'venues'],
    mode: 'venues',
  },
  {
    id: 'promo-ready',
    label: 'Scene 9',
    reviewLine: 'Pricing and promotion assets are ready',
    title: 'Package promotion outputs',
    scriptFocus:
      'Confirm the promote-and-sell phase and surface concrete artifacts: Luma setup, email preview, text copy, and pricing.',
    taskHeading: 'Phase 3: Promote & sell',
    statusLabel: 'Approved output',
    assistantCopy:
      'Pricing is aligned to the new budget ceiling, the Luma event draft is ready, and I packaged email plus SMS outreach previews for review.',
    quickActions: ['Preview outreach copy', 'Open event draft', 'Share pricing ladder'],
    approvals: ['Confirm Phase 3', 'Share promo kit'],
    outputs: [
      {
        id: 'luma',
        title: 'Luma event draft',
        subtitle: 'Event setup',
        description: 'Event description, schedule, pricing, and registration link are ready to publish.',
        icon: 'globe',
        tone: 'white',
        cta: 'Preview draft',
      },
      {
        id: 'email',
        title: 'Email preview',
        subtitle: 'Warm audience outreach',
        description: 'Personalized event invitation tuned for the converted audience segment.',
        icon: 'mail',
        tone: 'white',
      },
      {
        id: 'sms',
        title: 'SMS preview',
        subtitle: 'Reminder copy',
        description: 'Short confirmation text with location, timing, and RSVP urgency.',
        icon: 'sparkles',
        tone: 'lavender',
      },
      {
        id: 'pricing-model',
        title: 'Pricing model',
        subtitle: 'Performance guardrail',
        description: 'Venue, promotion, and attendance assumptions remain within target cost.',
        icon: 'price',
        tone: 'amber',
      },
    ],
    resources: ['brief', 'audience', 'venues', 'promo'],
    mode: 'cards',
  },
  {
    id: 'post-event',
    label: 'Scene 10',
    reviewLine: 'Post-event workflow closed with follow-up assets',
    title: 'Finish with the post-event loop',
    scriptFocus:
      'Move to the last phase and show the post-event follow-up loop: surveys, thank-you emails, and the reporting sheet.',
    taskHeading: 'Phase 4: Post-event',
    statusLabel: 'Ready for handoff',
    assistantCopy:
      'The post-event plan is assembled: survey prompts, thank-you emails, and a reporting sheet that captures what to learn from the event.',
    quickActions: ['Open survey plan', 'Review thank-you copy', 'Inspect reporting sheet'],
    approvals: ['Wrap workflow', 'Share recap assets'],
    outputs: [
      {
        id: 'survey',
        title: 'Survey flow',
        subtitle: 'Google Forms example',
        description: 'Questions focus on venue quality, topic relevance, and conversion to the next event.',
        icon: 'calendar',
        tone: 'white',
      },
      {
        id: 'thanks',
        title: 'Thank-you email',
        subtitle: 'Follow-up copy',
        description: 'Acknowledges attendance, summarizes value, and invites the next action.',
        icon: 'mail',
        tone: 'white',
      },
      {
        id: 'reporting',
        title: 'Reporting sheet',
        subtitle: 'Google data sheet',
        description: 'Attendance, survey results, and channel performance are ready for review.',
        icon: 'sheet',
        tone: 'lavender',
      },
    ],
    resources: ['brief', 'audience', 'venues', 'promo', 'post'],
    mode: 'cards',
  },
];

function getPhaseStatuses(step: number) {
  if (step < 3) {
    return ['idle', 'idle', 'idle'] as const;
  }

  if (step < 6) {
    return ['active', 'idle', 'idle'] as const;
  }

  if (step < 9) {
    return ['complete', 'active', 'idle'] as const;
  }

  return ['complete', 'complete', 'active'] as const;
}

function toneClasses(tone: OutputTone = 'white') {
  if (tone === 'lavender') {
    return 'border-[#cfc6ff] bg-[#f3f0ff]';
  }

  if (tone === 'amber') {
    return 'border-[#ffd89a] bg-[#fff6e7]';
  }

  if (tone === 'mint') {
    return 'border-[#bcebd7] bg-[#effcf5]';
  }

  return 'border-white/80 bg-white';
}

function outputIcon(icon: OutputCard['icon']) {
  const className = 'h-4 w-4';

  switch (icon) {
    case 'sheet':
      return <FileSpreadsheet className={className} />;
    case 'map':
      return <MapPinned className={className} />;
    case 'mail':
      return <Mail className={className} />;
    case 'price':
      return <CircleDollarSign className={className} />;
    case 'calendar':
      return <CalendarRange className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'globe':
      return <Globe className={className} />;
    case 'doc':
    default:
      return <FileText className={className} />;
  }
}

export default function NolmeDemo() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const beat = DEMO_BEATS[currentStep];
  const phaseStatuses = getPhaseStatuses(currentStep);
  const resources = beat.resources.map((resourceId) => RESOURCE_LIBRARY[resourceId]);
  const progress = (currentStep / (DEMO_BEATS.length - 1)) * 100;
  const usageValue = 24 + currentStep * 7;
  const hasAnchors = currentStep >= 1;

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    if (currentStep >= DEMO_BEATS.length - 1) {
      setIsPlaying(false);
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setCurrentStep((step) => Math.min(step + 1, DEMO_BEATS.length - 1));
    }, currentStep === 7 ? 5200 : 4200);

    return () => window.clearTimeout(timeout);
  }, [currentStep, isPlaying]);

  return (
    <div className="nolme-demo min-h-dvh bg-[radial-gradient(circle_at_top_left,_#ffffff_0%,_#f5f1ff_38%,_#ebe9ff_100%)] px-3 py-4 text-[#22222e] sm:px-4 xl:h-dvh xl:overflow-hidden">
      <div className="nolme-demo__shell mx-auto max-w-[1500px] xl:h-full">
{/*        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#d6d0ff] bg-white/80 px-4 py-3 shadow-[0_28px_80px_rgba(79,62,214,0.08)] backdrop-blur-xl">
           <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8470ff]">Nolme Demo</p>
            <h1 className="text-[28px] font-bold tracking-[-0.03em] text-[#13131a]">Animated SPA Walkthrough</h1>
          </div>
           <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#ddd8ff] bg-[#f6f3ff] px-3 py-1 text-[13px] font-medium text-[#4f3ed6]">
              {beat.label} of {DEMO_BEATS.length}
            </span>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[#d8d2ff] bg-white px-4 py-2 text-[14px] font-medium text-[#3c2eb8] transition hover:border-[#8470ff] hover:bg-[#f7f5ff]"
              to="/"
            >
              Open main app
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
*/}
        <div className="grid gap-3 xl:h-full xl:grid-cols-[64px_minmax(0,1fr)]">
          <nav className="demo-float rounded-[18px] border border-[#ddd8ff] bg-white/90 p-2 shadow-[0_14px_36px_rgba(79,62,214,0.08)] backdrop-blur xl:flex xl:min-h-0 xl:flex-col">
            <div className="flex h-full flex-row items-center gap-1.5 xl:min-h-0 xl:flex-col xl:items-center xl:justify-start">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#c4bbff] bg-[#f0eeff] text-[#4f3ed6]">
                <span className="text-[20px] font-bold">N</span>
              </div>
              <div className="grid flex-1 grid-cols-5 gap-1.5 xl:mt-4 xl:flex-none xl:grid-cols-1 xl:content-start xl:gap-2">
                {[Search, House, UserCog, MessageCircle, ListTodo].map((Icon, index) => {
                  const isActive = index === 3;
                  return (
                    <div
                      className={cn(
                        'flex h-9 w-full items-center justify-center rounded-[10px] border transition',
                        isActive
                          ? 'border-[#8470ff] bg-[#f0eeff] text-[#4f3ed6]'
                          : 'border-transparent bg-white text-[#54546a] hover:border-[#ddd8ff] hover:bg-[#faf9ff]',
                      )}
                      key={Icon.displayName ?? String(index)}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  );
                })}
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ddd8ff] text-[11px] font-medium text-[#4f3ed6] xl:mt-auto">
                CM
              </div>
            </div>
          </nav>

          <main className="flex min-w-0 flex-col gap-2 rounded-[22px] border border-[#ddd8ff] bg-[#f0f0f5] p-2 shadow-[0_28px_90px_rgba(60,46,184,0.12)] sm:p-3 xl:h-full xl:min-h-0">
            <section className="shrink-0 rounded-[18px] border border-white/80 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(79,62,214,0.06)] sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#13131a]">Workflow Phases:</span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[#22222e]">
                    <strong className="font-medium">Reviewing</strong>
                    {beat.reviewLine}
                    <span className="demo-live-dot h-2 w-2 rounded-full bg-[#f59e0b]" />
                  </span>
                </div>
                <button className="text-[13px] font-medium text-[#3c2eb8] hover:underline" type="button">
                  Edit
                </button>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {WORKFLOW_PHASES.map((phase, index) => {
                  const status = phaseStatuses[index];
                  const isActive = status === 'active';
                  const isComplete = status === 'complete';

                  return (
                    <div
                      className={cn(
                        'rounded-[10px] border px-3 py-2 transition',
                        isActive && 'demo-phase-active border-[#8470ff] bg-[#f0eeff]',
                        isComplete && 'border-[#d0c9ff] bg-[#f7f5ff]',
                        status === 'idle' && 'border-[#c8c8d6] bg-[#f5f5f8]',
                      )}
                      key={phase.label}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'text-[11px] font-semibold uppercase tracking-[0.08em]',
                            isActive ? 'text-[#3c2eb8]' : 'text-[#54546a]',
                          )}
                        >
                          {phase.label}
                        </span>
                        {isActive && (
                          <span className="rounded-full border border-[#8f80ff] px-2 py-0.5 text-[10px] font-semibold text-[#4f3ed6]">
                            Active
                          </span>
                        )}
                        {isComplete && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f9f1] px-2 py-0.5 text-[10px] font-semibold text-[#108d61]">
                            <Check className="h-3 w-3" />
                            Done
                          </span>
                        )}
                      </div>
                      <p className={cn('mt-1 text-[13px] leading-[1.3] font-medium', status === 'idle' ? 'text-[#767690]' : 'text-[#22222e]')}>
                        {phase.title}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid min-h-0 flex-1 gap-4 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_260px] xl:overflow-hidden">
              <section className="flex min-h-0 flex-col gap-3 xl:min-h-0 xl:overflow-hidden">
                <div className="demo-rise-in rounded-[20px] border border-[#ddd8ff] bg-white shadow-[0_12px_36px_rgba(79,62,214,0.06)]" key={beat.id}>
                  <div className="flex flex-wrap items-center gap-3 rounded-t-[20px] bg-[#f8f8fa] px-4 py-3 sm:px-5">
                    <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[#22222e]">{beat.taskHeading}</h2>
                    <span className="text-[14px] text-[#54546a]">{beat.statusLabel}</span>
                  </div>
                  <div className="space-y-3 px-4 py-3 sm:px-5">
                    <p className="max-w-[72ch] text-[14px] leading-[1.6] text-[#22222e]">{beat.assistantCopy}</p>
                    {beat.mode === 'empty' ? (
                      <div className="demo-fade-in rounded-[18px] border border-dashed border-[#d6d0ff] bg-[linear-gradient(135deg,rgba(240,238,255,0.9),rgba(255,255,255,0.95))] p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                          <div className="max-w-[32rem]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8470ff]">Starting state</p>
                            <h3 className="mt-1.5 text-[22px] font-bold tracking-[-0.02em] text-[#13131a]">
                              The workspace is empty until the user starts the conversation.
                            </h3>
                            <p className="mt-2 text-[13px] leading-[1.55] text-[#54546a]">
                              This makes the transformation obvious. The value is not the chrome, it is the live assembly of plan, outputs, and approvals after the first ask.
                            </p>
                          </div>
                          <div className="rounded-[14px] border border-[#ddd8ff] bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(79,62,214,0.06)]">
                            <div className="flex items-center gap-2 text-[13px] font-medium text-[#22222e]">
                              <Sparkles className="h-3.5 w-3.5 text-[#4f3ed6]" />
                              Quick action starter
                            </div>
                            <p className="mt-1.5 text-[12px] text-[#767690]">Choose one to bring the dashboard to life.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'grid gap-3',
                          beat.mode === 'venues' ? 'md:grid-cols-2' : beat.outputs.length > 2 ? 'md:grid-cols-2' : 'md:grid-cols-2',
                        )}
                      >
                        {beat.outputs.map((output, index) => (
                          <article
                            className={cn(
                              'demo-resource-enter rounded-[14px] border p-3.5 shadow-[0_6px_18px_rgba(79,62,214,0.04)]',
                              beat.mode === 'venues' ? 'border-[#e8e4d8] bg-[#fdfcf9]' : toneClasses(output.tone),
                              beat.mode === 'venues' && index === 2 && 'md:col-span-1',
                            )}
                            key={output.id}
                            style={{ ['--demo-delay' as string]: `${index * 80}ms` }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                {beat.mode !== 'venues' && (
                                  <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#6550f0]">
                                    {outputIcon(output.icon)}
                                    Output
                                  </div>
                                )}
                                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#13131a]">{output.title}</h3>
                                <p className="text-[13px] text-[#54546a]">{output.subtitle}</p>
                              </div>
                              {output.cta && (
                                <button
                                  className="inline-flex items-center gap-2 rounded-full border border-[#ddd8ff] bg-white px-3 py-1.5 text-[12px] font-medium text-[#4f3ed6]"
                                  type="button"
                                >
                                  {output.cta}
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="mt-2 text-[12px] leading-[1.5] text-[#22222e]">{output.description}</p>
                            {typeof output.rating === 'number' && (
                              <div className="mt-4 flex items-center gap-2 text-[14px] text-[#22222e]">
                                <span>{output.rating.toFixed(1)}</span>
                                <div className="flex items-center gap-1 text-[#f59e0b]">
                                  {Array.from({ length: 5 }).map((_, starIndex) => (
                                    <Star className="h-4 w-4 fill-current" key={`${output.id}-${starIndex}`} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {beat.userMessage && (
                  <div className="demo-rise-in ml-auto max-w-[30rem] rounded-[14px] bg-[#3a3a4e] px-4 py-3 text-[14px] leading-[1.55] text-white" key={`${beat.id}-user`}>
                    {beat.userMessage}
                  </div>
                )}

                {beat.thinkingLabel && (
                  <div className="demo-rise-in inline-flex items-center gap-2.5 rounded-full bg-[#f9a832] px-3.5 py-1.5 text-[13px] font-medium text-[#22222e]" key={`${beat.id}-thinking`}>
                    <span className="demo-live-dot flex h-5 w-5 items-center justify-center rounded-full bg-[#4f3ed6]">
                      <span className="text-[9px] font-bold text-white">N</span>
                    </span>
                    {beat.thinkingLabel}
                  </div>
                )}

                <div className="mt-auto space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {beat.approvals.map((approval) => (
                      <button
                        className="rounded-full bg-[#ddd8ff] px-3 py-1.5 text-[12px] font-medium text-[#4f3ed6] transition hover:bg-[#d4ceff]"
                        key={approval}
                        type="button"
                      >
                        {approval}
                      </button>
                    ))}
                    {!!beat.approvals.length && (
                      <button
                        className="rounded-full bg-[#feefd0] px-3 py-1.5 text-[11px] font-medium text-[#e8900a]"
                        type="button"
                      >
                        Ask question while working
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {beat.quickActions.map((action) => (
                      <button
                        className="rounded-full border border-[#d9d3ff] bg-white px-3 py-1.5 text-[12px] font-medium text-[#54546a] transition hover:border-[#8470ff] hover:text-[#3c2eb8]"
                        key={action}
                        type="button"
                      >
                        {action}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-[12px] border border-[#c8c8d6] bg-[#f8f8fa] px-3 py-3 shadow-[0_8px_20px_rgba(79,62,214,0.04)]">
                    <div className="min-h-6 text-[14px] text-[#a0a0b4]">Type your response...</div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ddd8ff] bg-white text-[#22222e]" type="button">
                        <Plus className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1 rounded-full bg-[#3c2eb8] px-3 py-1.5 text-[12px] font-medium text-white"
                          type="button"
                        >
                          Opus 4.7
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ddd8ff] bg-white text-[#22222e]" type="button">
                          <AudioLines className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-3 xl:min-h-0 xl:overflow-hidden">
                <div className="rounded-[16px] border border-[#c4bbff] bg-white p-3 shadow-[0_8px_20px_rgba(79,62,214,0.05)]">
                  <div className="flex items-center gap-3">
                    <div className="relative h-11 w-11 shrink-0">
                      <img
                        alt="Aria"
                        className="h-11 w-11 rounded-full object-cover ring-2 ring-[#10b981]"
                        src="https://i.pravatar.cc/150?img=32"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#10b981]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-semibold text-[#22222e]">Aria</p>
                      <p className="text-[13px] text-[#54546a]">Community Lead</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#10b981] bg-[#10b981]/10">
                      <span className="text-[10px] font-semibold text-[#10b981]">Usage</span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="rounded-full border-[1.5px] border-[#6550f0] px-3 py-1.5 text-[12px] font-medium text-[#6550f0]" type="button">
                      Job Description
                    </button>
                    <button className="rounded-full border-[1.5px] border-[#6550f0] px-3 py-1.5 text-[12px] font-medium text-[#6550f0]" type="button">
                      Guidelines
                    </button>
                  </div>
                </div>

                <div className="rounded-[16px] border border-[#c4bbff] bg-white p-3 shadow-[0_8px_20px_rgba(79,62,214,0.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#13131a]">Skills</p>
                    <Sparkles className="h-3.5 w-3.5 text-[#54546a]" />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {['Deep research', 'Marketing', 'Community', 'Social', 'Events'].map((skill) => (
                      <span
                        className="rounded-full border border-[rgba(56,56,76,0.4)] px-2.5 py-1 text-[11px] font-medium text-[#38384c]"
                        key={skill}
                      >
                        {skill}
                      </span>
                    ))}
                    <button className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-[#c4bbff] text-[#8470ff]" type="button">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="rounded-[16px] border border-[#c4bbff] bg-white p-3 shadow-[0_8px_20px_rgba(79,62,214,0.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#13131a]">Integrations</p>
                    <Plus className="h-3.5 w-3.5 text-[#54546a]" />
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    {/* Luma */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="#FF6B00"/><path d="M12 7l-5 3v4l5 3 5-3v-4l-5-3z" fill="#fff"/></svg>
                    {/* Gmail */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" fill="#EA4335"/><path d="M2 6l10 7 10-7" stroke="#fff" strokeWidth="1.5" fill="none"/><rect x="2" y="4" width="20" height="16" rx="2" stroke="none" fill="none"/><path d="M2 6v12a2 2 0 002 2h16a2 2 0 002-2V6" fill="none"/></svg>
                    {/* Google Sheets */}
                    <svg width="18" height="22" viewBox="0 0 18 22" fill="none"><rect x="0" y="0" width="18" height="22" rx="2" fill="#34A853"/><rect x="3" y="5" width="12" height="12" rx="1" fill="#fff"/><line x1="9" y1="5" x2="9" y2="17" stroke="#34A853" strokeWidth="1"/><line x1="3" y1="11" x2="15" y2="11" stroke="#34A853" strokeWidth="1"/></svg>
                    {/* Linear */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#5E6AD2"/><path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {/* Slack */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9.5 4a1.5 1.5 0 000 3H11V5.5A1.5 1.5 0 009.5 4z" fill="#E01E5A"/><path d="M4 9.5a1.5 1.5 0 013 0V11H5.5A1.5 1.5 0 014 9.5z" fill="#36C5F0"/><path d="M9.5 20a1.5 1.5 0 000-3H8v1.5A1.5 1.5 0 009.5 20z" fill="#2EB67D"/><path d="M20 9.5a1.5 1.5 0 00-3 0V11h1.5A1.5 1.5 0 0020 9.5z" fill="#ECB22E"/><path d="M14.5 4a1.5 1.5 0 010 3H13V5.5A1.5 1.5 0 0114.5 4z" fill="#36C5F0"/><path d="M20 14.5a1.5 1.5 0 00-3 0V16h1.5a1.5 1.5 0 001.5-1.5z" fill="#E01E5A"/><path d="M14.5 20a1.5 1.5 0 010-3H16v1.5a1.5 1.5 0 01-1.5 1.5z" fill="#ECB22E"/><path d="M4 14.5a1.5 1.5 0 013 0V16H5.5A1.5 1.5 0 014 14.5z" fill="#2EB67D"/><rect x="8" y="8" width="3" height="3" rx="0.5" fill="#E01E5A"/><rect x="13" y="8" width="3" height="3" rx="0.5" fill="#36C5F0"/><rect x="8" y="13" width="3" height="3" rx="0.5" fill="#2EB67D"/><rect x="13" y="13" width="3" height="3" rx="0.5" fill="#ECB22E"/></svg>
                  </div>
                </div>

                <div className="rounded-[16px] border border-[#c4bbff] bg-white p-3 shadow-[0_8px_20px_rgba(79,62,214,0.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#13131a]">Resources</p>
                    <ChevronDown className="h-3.5 w-3.5 text-[#54546a]" />
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {resources.length ? (
                      resources.map((resource, index) => (
                        <div
                          className="demo-resource-enter flex items-start gap-3 rounded-[14px] border border-[#efecff] px-3 py-3"
                          key={resource.title}
                          style={{ ['--demo-delay' as string]: `${index * 90}ms` }}
                        >
                          <div
                            className={cn(
                              'mt-0.5 flex h-5 w-5 items-center justify-center rounded-[4px] text-[10px] font-medium text-white',
                              resource.tone === 'emerald' && 'bg-[#10b981]',
                              resource.tone === 'iris' && 'bg-[#8470ff]',
                              resource.tone === 'gold' && 'bg-[#e8900a]',
                            )}
                          >
                            {resource.badge}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] text-[#13131a]">{resource.title}</p>
                            <p className="text-[10px] text-[#767690]">{resource.subtitle}</p>
                          </div>
                          {resource.action === 'download' ? (
                            <Download className="h-4 w-4 text-[#54546a]" />
                          ) : (
                            <Link2 className="h-4 w-4 text-[#54546a]" />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[16px] border border-dashed border-[#d9d3ff] bg-[#faf9ff] px-4 py-5 text-[14px] leading-[1.6] text-[#767690]">
                        Resources appear here as the workflow produces artifacts. The empty state is part of the story.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <section className="shrink-0 rounded-[12px] border border-[#d9d3ff] bg-white/90 px-3 py-2 shadow-[0_10px_30px_rgba(79,62,214,0.06)] backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#3c2eb8] px-3 py-1.5 text-[12px] font-medium text-white"
                  onClick={() => setIsPlaying((playing) => !playing)}
                  type="button"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <CirclePlay className="h-4 w-4" />}
                  {isPlaying ? 'Pause autoplay' : 'Resume autoplay'}
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd8ff] px-3 py-1.5 text-[12px] font-medium text-[#4f3ed6]"
                  onClick={() => {
                    setCurrentStep(0);
                    setIsPlaying(true);
                  }}
                  type="button"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </button>
                <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#f7f4ff] px-2.5 py-1 text-[11px] font-medium text-[#4f3ed6]">
                  <CheckCheck className="h-3.5 w-3.5" />
                  Beat {currentStep + 1} / {DEMO_BEATS.length}
                </div>
              </div>

              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#ece8ff]">
                <div
                  className="demo-progress-bar h-full rounded-full bg-[linear-gradient(90deg,#4f3ed6_0%,#8470ff_60%,#f9a832_100%)]"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {DEMO_BEATS.map((item, index) => (
                  <button
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                      currentStep === index
                        ? 'bg-[#ddd8ff] text-[#4f3ed6]'
                        : 'border border-[#e8e4ff] bg-white text-[#54546a] hover:border-[#cfc6ff] hover:text-[#3c2eb8]',
                    )}
                    key={item.id}
                    onClick={() => {
                      setCurrentStep(index);
                      setIsPlaying(false);
                    }}
                    type="button"
                  >
                    {index + 1}. {item.title}
                  </button>
                ))}
              </div>
            </section>
          </main>

          <aside className="xl:hidden">
            {hasAnchors && (
              <div className="rounded-[24px] border border-[#ddd8ff] bg-white px-4 py-3 text-[14px] text-[#54546a] shadow-[0_16px_40px_rgba(79,62,214,0.06)]">
                Context anchors are attached. On mobile, the profile and resources stack below the main panel rather than living in a separate rail.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
