---
date: 2026-04-26T10:23:46-04:00
researcher: maceo
git_commit: b53fe98a6f87adbd63c09ff8045559e5c9142e59
branch: main
repository: cc-agent-ui
topic: "How the supplied Figma chat-stream node maps onto the actual cc-agent-ui interface under src/"
tags: [research, codebase, cc-agent-ui, figma, chat, root-app, ui]
status: complete
last_updated: 2026-04-26
last_updated_by: maceo
last_updated_note: "Added Figma AI Response/Questions mapping for AskUserQuestion surfaces"
---

# Research: cc-agent-ui Figma Surface Map

**Date**: 2026-04-26T10:23:46-04:00
**Researcher**: maceo
**Git Commit**: `b53fe98a6f87adbd63c09ff8045559e5c9142e59`
**Branch**: `main`
**Repository**: `cc-agent-ui`
**Scope**: actual `cc-agent-ui` interface under `src/`

## Research Question

Use the supplied Figma design specs to research how the actual `cc-agent-ui` interface would be re-skinned, focusing on the UI components that currently render, and the UI elements that correspond to components that would change, be added, or be replaced. This note excludes `nolme-ui`.

## Summary

The actual `cc-agent-ui` interface is the root React app under `src/`, mounted by `App` and `AppContent`, not the separate `nolme-ui` bundle. The visible shell is:

- a left sidebar for projects and sessions
- a top header with title, tabs, and an `Open in Nolme` button
- a main content area whose `chat` tab mounts `ChatInterface`
- an optional editor sidebar and a floating quick-settings drawer

The supplied Figma node `9103:3847` is only the center chat stream. Its metadata and design context describe:

- a muted chat canvas
- a right-aligned user bubble with time and delivery status
- a thin in-stream AI thinking row
- a bottom input card with agent identity, usage progress, quick-action pills, a multiline prompt field, an inline model pill, token estimate, and send button

Inside the actual root app, that Figma node maps primarily to `ChatMessagesPane`, `MessageComponent`, `AssistantThinkingIndicator`, `ChatComposer`, `ClaudeStatus`, `ChatInputControls`, `PermissionRequestsBanner`, and `ProviderSelectionEmptyState`. The surrounding root shell components remain visible in `cc-agent-ui` but are outside the supplied Figma node.

Follow-up research on the supplied Figma `right-panel` node shows that the current root app has no mounted chat-time phases or deliverables rail under `src/`. The nearest mounted task and artifact surfaces live in the separate `tasks` and `files` tabs, with `EditorSidebar` and `QuickSettingsPanelView` as the only right-side panes currently rendered by the root app.

Follow-up research on the supplied Figma `AI Response / Questions` node shows that the root `src/` app already renders agent questions through the Claude permission-request path. In the root app, pending `AskUserQuestion` requests render above the composer through `PermissionRequestsBanner` and `AskUserQuestionPanel`, while historical answered question tool calls render through `ToolRenderer` and `QuestionAnswerContent`. The separate `nolme-ui` bundle already contains a Figma-like `AiResponseQuestionsCard`, bound by `AiResponseQuestionsCardBound`, and mounted above the Nolme composer.

## Figma Node Coverage

**Supplied Figma node**: `https://www.figma.com/design/hQmruZnjNWlxE3FLYA5cJv/nolme?node-id=9103-3847&t=m8XR8qsbrSdp7xPZ-0`

The Figma MCP metadata for node `9103:3847` identifies this structure:

| Figma region | Figma detail | Current root-app equivalent |
| --- | --- | --- |
| `chat-stream` | `1008 x 1024` muted background frame | `ChatInterface` chat tab surface |
| `chat-messages` | bottom-aligned conversation area with wide side insets | `ChatMessagesPane` |
| `Chat Bubble` | right-aligned user bubble with `status-row` | `MessageComponent` user branch |
| `ai thinking` | avatar plus one-line progress copy | `AssistantThinkingIndicator` |
| `input-zone` | lower chat input area | `ChatComposer` |
| `input-container` | white rounded card with shadow | `ChatComposer` form shell |
| `agent details` | avatar, role label, progress bar | closest mounted surfaces are `ClaudeStatus` and token/status controls |
| `quick-actions` | three compact pills | no mounted equivalent row in the active session composer |
| `input-field` | textarea plus model pill, token count, send | `ChatComposer` textarea/send plus partial controls elsewhere |

## Actual cc-agent-ui Surface

### 1. Root app mount and shell

The real `cc-agent-ui` route tree lives in [src/App.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/App.tsx:24). Both `/` and `/session/:sessionId` render `AppContent`, while `/demo/nolme` is a separate route and outside this note's scope.

`AppContent` is the full-screen shell in [src/components/app/AppContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/app/AppContent.tsx:127). It renders:

- desktop sidebar at [src/components/app/AppContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/app/AppContent.tsx:129)
- mobile slide-over sidebar at [src/components/app/AppContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/app/AppContent.tsx:134)
- main content column at [src/components/app/AppContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/app/AppContent.tsx:162)
- bottom mobile nav at [src/components/app/AppContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/app/AppContent.tsx:187)

### 2. Shell surfaces that remain visible around the chat stream

The main pane is [src/components/main-content/view/MainContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/MainContent.tsx:105). It mounts:

- `MainContentHeader` at [src/components/main-content/view/MainContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/MainContent.tsx:107)
- the chat tab's `ChatInterface` at [src/components/main-content/view/MainContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/MainContent.tsx:120)
- `EditorSidebar` beside the tab body at [src/components/main-content/view/MainContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/MainContent.tsx:187)

The header itself is [src/components/main-content/view/subcomponents/MainContentHeader.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/subcomponents/MainContentHeader.tsx:38). It includes:

- current session or tab title via `MainContentTitle` at [src/components/main-content/view/subcomponents/MainContentHeader.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/subcomponents/MainContentHeader.tsx:43)
- the visible `Open in Nolme` button at [src/components/main-content/view/subcomponents/MainContentHeader.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/subcomponents/MainContentHeader.tsx:52)
- the tab strip via `MainContentTabSwitcher` at [src/components/main-content/view/subcomponents/MainContentHeader.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/subcomponents/MainContentHeader.tsx:74)

The title surface is [src/components/main-content/view/subcomponents/MainContentTitle.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/subcomponents/MainContentTitle.tsx:57). In the chat tab, it shows the provider icon, session title, and project name.

The tab strip is [src/components/main-content/view/subcomponents/MainContentTabSwitcher.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/subcomponents/MainContentTabSwitcher.tsx:68). It uses the shared pill primitives in [src/shared/view/ui/PillBar.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/shared/view/ui/PillBar.tsx:10).

The left navigation surface is the sidebar stack:

- `Sidebar` chooser: [src/components/sidebar/view/Sidebar.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/sidebar/view/Sidebar.tsx:21)
- expanded `SidebarContent`: [src/components/sidebar/view/subcomponents/SidebarContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/sidebar/view/subcomponents/SidebarContent.tsx:65)
- `SidebarHeader`: [src/components/sidebar/view/subcomponents/SidebarHeader.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/sidebar/view/subcomponents/SidebarHeader.tsx:53)
- `SidebarProjectList`: [src/components/sidebar/view/subcomponents/SidebarProjectList.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/sidebar/view/subcomponents/SidebarProjectList.tsx:94)
- `SidebarSessionItem`: [src/components/sidebar/view/subcomponents/SidebarSessionItem.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/sidebar/view/subcomponents/SidebarSessionItem.tsx:127)
- `SidebarFooter`: [src/components/sidebar/view/subcomponents/SidebarFooter.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/sidebar/view/subcomponents/SidebarFooter.tsx:32)

The right-side auxiliary surfaces that can still appear in the root app are:

- `EditorSidebar` in [src/components/code-editor/view/EditorSidebar.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/code-editor/view/EditorSidebar.tsx:25)
- `QuickSettingsPanelView` in [src/components/quick-settings-panel/view/QuickSettingsPanelView.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/quick-settings-panel/view/QuickSettingsPanelView.tsx:58)

These shell pieces are part of the visible `cc-agent-ui` interface but are not described by the supplied Figma `chat-stream` node.

## Components Mapped To The Supplied Figma Chat Stream

### 1. Conversation area

`ChatInterface` assembles the active chat surface in [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:370). It mounts:

- `ChatMessagesPane` at [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:373)
- `ChatComposer` at [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:420)
- `QuickSettingsPanelView` at [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:491)

The scrollable message surface is [src/components/chat/view/subcomponents/ChatMessagesPane.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatMessagesPane.tsx:133). It contains:

- provider-selection empty state when there are no messages at [src/components/chat/view/subcomponents/ChatMessagesPane.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatMessagesPane.tsx:147)
- message-history status and pagination controls at [src/components/chat/view/subcomponents/ChatMessagesPane.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatMessagesPane.tsx:170)
- rendered message rows through `MessageComponent` at [src/components/chat/view/subcomponents/ChatMessagesPane.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatMessagesPane.tsx:245)
- the live in-stream thinking row at [src/components/chat/view/subcomponents/ChatMessagesPane.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatMessagesPane.tsx:269)

### 2. User bubble and assistant row rendering

The user bubble and assistant rows are both rendered by [src/components/chat/view/subcomponents/MessageComponent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/MessageComponent.tsx:115).

The user-message branch is at [src/components/chat/view/subcomponents/MessageComponent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/MessageComponent.tsx:121). The current mounted user row is:

- right-aligned
- blue filled
- rounded with a tighter bottom-right corner
- timestamped
- optionally copyable
- optionally accompanied by a `U` avatar badge

The assistant/tool/error branch begins at [src/components/chat/view/subcomponents/MessageComponent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/MessageComponent.tsx:163). It currently includes:

- provider or tool header when the row is not grouped
- tool input and tool result rendering for tool-use messages
- interactive prompt cards
- collapsible thinking-message blocks
- assistant footer controls including copy, Claude-only fork, and timestamp

### 3. Thinking indicator

The Figma node's `ai thinking` row maps most closely to [src/components/chat/view/subcomponents/AssistantThinkingIndicator.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/AssistantThinkingIndicator.tsx:9). The mounted root-app version is a left-aligned provider row with a provider logo, provider name, animated dots, and `Thinking...`.

### 4. Composer shell

The bottom composer surface is [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:171). It renders, in order:

- `ClaudeStatus` at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:175)
- `PermissionRequestsBanner` at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:184)
- `ChatInputControls` at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:191)
- the rounded input form shell at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:208)

The form shell contains:

- drag-and-drop overlay at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:209)
- attachment preview row at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:225)
- file mention dropdown at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:241)
- command menu at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:268)
- textarea at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:292)
- image attach button at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:308)
- send button at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:328)

### 5. Status, control, and permission surfaces around the input

The mounted status card above the composer is [src/components/chat/view/subcomponents/ClaudeStatus.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ClaudeStatus.tsx:111). It shows:

- provider logo
- live or paused badge
- animated status text
- elapsed time
- `Stop Generation` action when interruption is allowed

The compact control row is [src/components/chat/view/subcomponents/ChatInputControls.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatInputControls.tsx:40). It currently contains:

- permission-mode cycle button at [src/components/chat/view/subcomponents/ChatInputControls.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatInputControls.tsx:42)
- Claude-only `ThinkingModeSelector` at [src/components/chat/view/subcomponents/ChatInputControls.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatInputControls.tsx:77)
- `TokenUsagePie` at [src/components/chat/view/subcomponents/ChatInputControls.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatInputControls.tsx:81)
- slash-command button at [src/components/chat/view/subcomponents/ChatInputControls.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatInputControls.tsx:83)
- clear-input button at [src/components/chat/view/subcomponents/ChatInputControls.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatInputControls.tsx:106)
- scroll-to-bottom button at [src/components/chat/view/subcomponents/ChatInputControls.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatInputControls.tsx:124)

Pending approval UI is [src/components/chat/view/subcomponents/PermissionRequestsBanner.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/PermissionRequestsBanner.tsx:28). It renders:

- custom `AskUserQuestion` panels when registered
- otherwise an amber permission-request card with allow and deny actions

## Components That Correspond To "Change / Add / Replace" Work

### Existing mounted components with direct visual overlap

These current root-app components already occupy the same UI territory as the supplied Figma chat-stream and are the direct mounted surfaces that would visually change under a re-skin:

- `ChatMessagesPane`
- `MessageComponent`
- `AssistantThinkingIndicator`
- `ChatComposer`
- `ClaudeStatus`
- `ChatInputControls`
- `PermissionRequestsBanner`

### Existing mounted components adjacent to the supplied Figma node

These current root-app components stay visible in `cc-agent-ui`, but the supplied Figma node does not specify them:

- `Sidebar`
- `SidebarContent`
- `SidebarHeader`
- `SidebarProjectList`
- `SidebarSessionItem`
- `SidebarFooter`
- `MainContentHeader`
- `MainContentTitle`
- `MainContentTabSwitcher`
- `EditorSidebar`
- `QuickSettingsPanelView`
- `MobileNav`

### Figma elements without a one-to-one active mounted equivalent today

These Figma sub-elements do not have a single direct active-session counterpart in the current root app:

- **Agent profile row plus inline progress bar**: the nearest mounted surfaces are split across `ClaudeStatus`, `TokenUsagePie`, and the header title surface rather than a single inline composer row.
- **Quick-action pills inside the composer card**: there is no mounted quick-action chip row inside the active session composer.
- **Inline model pill in the active composer**: the current model selector is mounted in `ProviderSelectionEmptyState`, not inside the active composer.
- **User-bubble delivery label**: the mounted user row shows time and optional copy control, but no delivery-state text label.

The empty-state provider/model chooser that currently contains the root app's visible model selector is [src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx:153), with the model `select` at [src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx:212).

## Styling And Token Baseline In The Actual Root App

The root app styling baseline lives in [src/index.css](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/index.css:24). It defines:

- HSL-backed semantic tokens such as `--background`, `--foreground`, `--card`, `--primary`, and `--border` at [src/index.css](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/index.css:25)
- dark-theme overrides at [src/index.css](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/index.css:87)
- the global root/body font stack at [src/index.css](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/index.css:129)

The current root app therefore uses the repo's existing semantic Tailwind token system and a system-font stack, while the supplied Figma node encodes Satoshi typography and a different token set inside the design context returned by Figma MCP.

## Follow-up Research 2026-04-26T10:40:44-04:00

### Additional Figma node

**Supplied follow-up node**: `https://www.figma.com/design/hQmruZnjNWlxE3FLYA5cJv/nolme?node-id=9103-3870&t=m8XR8qsbrSdp7xPZ-0`

The Figma MCP metadata for node `9103:3870` identifies a `right-panel` made of two stacked sections:

- `phase-timeline` at the top
- `deliverables-section` below it

The `phase-timeline` section contains:

- a `Phases` header
- an `Edit` action
- a phase pill strip with `P1` highlighted and `P2` through `P4` inactive
- an active phase card showing a phase title, a `Waiting` badge, `Task 5 of 5`, a one-line task summary, and a `View tasks` action

The `deliverables-section` contains:

- a `Deliverables` header
- a phase artifact subgroup label
- a divider
- a list of deliverable rows with icons, file names, and `last edited` dates

### Current root-app mapping for the Figma right panel

There is no mounted chat-time right rail in the actual `src/` chat interface. The chat tab still mounts only:

- `ChatMessagesPane` at [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:373)
- `ChatComposer` at [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:420)
- `QuickSettingsPanelView` at [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:491)

The closest root-app equivalents for the Figma `right-panel` are distributed across separate surfaces:

| Figma right-panel region | Current root-app equivalent |
| --- | --- |
| `right-panel` | no mounted chat-time right rail in the `chat` tab |
| `phase-timeline` | no equivalent side section in `ChatInterface`; task workflow is surfaced through the separate `tasks` tab |
| `phases` pill strip | no mounted phase pill strip in the root chat tab |
| active phase card | closest equivalents are `NextTaskBanner` and `TaskCard` |
| `View tasks` action | closest equivalents are `NextTaskBanner`'s task CTA and the `tasks` tab |
| `deliverables-section` | no mounted deliverables rail in the root chat tab |
| deliverable rows with `last edited` metadata | closest equivalents are `FileTree` rows in detailed mode and the optional `EditorSidebar` for the currently open file |

### Closest current equivalents for the phases section

The actual task workflow surface in the root app is the separate `tasks` tab:

- the `tasks` tab is defined in [src/components/main-content/view/subcomponents/MainContentTabSwitcher.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/subcomponents/MainContentTabSwitcher.tsx:39)
- `MainContent` mounts `TaskMasterPanel` only when the `tasks` tab is active at [src/components/main-content/view/MainContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/MainContent.tsx:172)

`TaskMasterPanel` is a full-page task workspace rather than a side rail. It mounts `TaskBoard`, `TaskDetailModal`, and `PRDEditor` in [src/components/task-master/view/TaskMasterPanel.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/TaskMasterPanel.tsx:79).

`TaskBoard` provides the current task workspace in [src/components/task-master/view/TaskBoard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/TaskBoard.tsx:132). It mounts:

- `TaskBoardToolbar` at [src/components/task-master/view/TaskBoard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/TaskBoard.tsx:134)
- `TaskBoardContent` at [src/components/task-master/view/TaskBoard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/TaskBoard.tsx:168)

The closest task-card analogue to the Figma active phase card is [src/components/task-master/view/TaskCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/TaskCard.tsx:138). Its mounted task rows show:

- task ID and title
- dependency indicator
- status badge
- subtask progress bar with completed and total counts

The only current chat-adjacent task-summary surface is `NextTaskBanner`, which appears in `ProviderSelectionEmptyState` before an active message transcript is shown:

- new-session empty state mount at [src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx:260)
- continue-session prompt mount at [src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx:285)

`NextTaskBanner` itself is [src/components/task-master/view/NextTaskBanner.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/NextTaskBanner.tsx:49). When a next task exists, it shows:

- task ID and title
- priority indicator
- `Start Task` action
- detail-view action
- optional `View all tasks` action

### Closest current equivalents for the deliverables section

There is no mounted deliverables rail in the `chat` tab. The nearest current artifact/file surfaces are the `files` tab and the optional `EditorSidebar`.

The `files` tab is mounted from `MainContent` at [src/components/main-content/view/MainContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/MainContent.tsx:149), which renders `FileTree`.

`FileTree` is the root file surface in [src/components/file-tree/view/FileTree.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/file-tree/view/FileTree.tsx:123). In detailed mode it mounts the column header row from [src/components/file-tree/view/FileTreeDetailedColumns.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/file-tree/view/FileTreeDetailedColumns.tsx:7), which labels:

- `name`
- `size`
- `modified`
- `permissions`

Individual file rows are rendered in [src/components/file-tree/view/FileTreeNode.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/file-tree/view/FileTreeNode.tsx:144). In detailed mode they show:

- file name
- file size
- relative modified date
- permissions string

The only persistent right-side content pane in the root app is [src/components/code-editor/view/EditorSidebar.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/code-editor/view/EditorSidebar.tsx:104), which shows the currently open file in a resizable border-left sidebar. That surface corresponds more closely to focused document editing than to the Figma deliverables list.

`QuickSettingsPanelView` is also a right-side panel in the root app, but it is a slide-in settings drawer rather than a task or deliverables rail. It is implemented in [src/components/quick-settings-panel/view/QuickSettingsPanelView.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/quick-settings-panel/view/QuickSettingsPanelView.tsx:58).

## Follow-up Research 2026-04-26T13:04:43-04:00

### Additional Figma node

**Supplied follow-up node**: `https://www.figma.com/design/hQmruZnjNWlxE3FLYA5cJv/nolme?node-id=9121-1291&t=m8XR8qsbrSdp7xPZ-0`

The Figma MCP identifies node `9121:1291` as an `AI Response / Questions` instance sized `816 x 388`. The generated design context contains a single white question card with:

| Figma region | Figma detail |
| --- | --- |
| Card shell | white background, `#e2e2ea` border, `12px` radius, `20px` padding, `20px` vertical gap |
| Prompt block | intro copy plus main question copy |
| Options | four `32px` rows with `16px` square checkbox boxes and `#e2e2ea` dividers |
| Selected option | `Other (describe below)` selected with primary purple `#4f3ed6` and a check glyph |
| Free-text field | active `48px` input with `#6550f0` border and `8px` radius |
| CTA row | left `Skip for now` text action and right `Continue` primary pill |

The Figma variable definitions for this node include:

| Token | Value |
| --- | --- |
| `color/text/primary` | `#13131a` |
| `color/text/secondary` | `#54546a` |
| `color/background/default` | `#ffffff` |
| `color/border/default` / `neutral/200` | `#e2e2ea` |
| `color/interactive/primary/bg` | `#4f3ed6` |
| `color/interactive/secondary/border` | `#6550f0` |
| `Body/SM` | Satoshi Regular, `14px / 22px` |
| `Body/SM · Medium` | Satoshi Medium, `14px / 22px` |
| `Body/MD` | Satoshi Regular, `16px / 26px` |
| `Body/MD · Medium` | Satoshi Medium, `16px / 26px` |
| `Label/MD` | Satoshi Medium, `14px / 18px`, `1px` letter spacing |

### Current root-app rendering for agent questions

The root `src/` app models the pending question surface as permission state, not ordinary composer text. `PendingPermissionRequest`, `QuestionOption`, and `Question` are defined in [src/components/chat/types/types.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/types/types.ts:73). The `Question` shape is:

- `question`
- optional `header`
- `options`
- optional `multiSelect`

`useChatProviderState` owns `pendingPermissionRequests` in [src/components/chat/hooks/useChatProviderState.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/hooks/useChatProviderState.ts:13). Realtime `permission_request` frames are added to that list in [src/components/chat/hooks/useChatRealtimeHandlers.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/hooks/useChatRealtimeHandlers.ts:326). Session reconnect or session change also requests pending permissions from the backend in [src/components/app/AppContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/app/AppContent.tsx:109).

`ChatInterface` passes pending requests to `ChatComposer` in [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:420). Inside `ChatComposer`, an active `AskUserQuestion` request is detected in [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:161). While that panel is active, `ChatComposer` still renders `PermissionRequestsBanner` at [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:184), and hides the normal Claude status card, input controls, and input form around [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:171).

`PermissionRequestsBanner` registers `AskUserQuestionPanel` for the `AskUserQuestion` tool in [src/components/chat/view/subcomponents/PermissionRequestsBanner.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/PermissionRequestsBanner.tsx:8). It dispatches custom panels through `getPermissionPanel()` in [src/components/chat/view/subcomponents/PermissionRequestsBanner.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/PermissionRequestsBanner.tsx:30). The registry contract is a `{ request, onDecision }` component in [src/components/chat/tools/configs/permissionPanelRegistry.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/configs/permissionPanelRegistry.ts:4).

`AskUserQuestionPanel` is the mounted root-app question UI in [src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx:5). It reads `request.input.questions` in [src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx:9), stores current step, selections, `Other` text, and `Other` activation state, then builds `answers: Record<string, string>` keyed by `q.question` in [src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx:71).

The root-app panel submits answers by calling `onDecision(request.requestId, { allow: true, updatedInput: { ...input, answers } })` in [src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx:83). Skip submits `{ ...input, answers: {} }` in [src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx:87). `handlePermissionDecision` sends the backend WebSocket message type `claude-permission-response` with `requestId`, `allow`, `updatedInput`, `message`, and `rememberEntry` in [src/components/chat/hooks/useChatComposerState.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/hooks/useChatComposerState.ts:987).

### Current root-app historical rendering for answered questions

Answered or historical `AskUserQuestion` tool calls render through the normal tool-history path. The `AskUserQuestion` tool config is in [src/components/chat/tools/configs/toolConfigs.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/configs/toolConfigs.ts:467). It exposes `questions` and `answers` to `ToolRenderer` as `contentType: 'question-answer'`.

`ToolRenderer` routes `question-answer` content to `QuestionAnswerContent` in [src/components/chat/tools/ToolRenderer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/ToolRenderer.tsx:182). `QuestionAnswerContent` renders question headers, prompts, selected labels, skipped states, option descriptions, and custom answer labels in [src/components/chat/tools/components/ContentRenderers/QuestionAnswerContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/components/ContentRenderers/QuestionAnswerContent.tsx:11).

The separate legacy `interactive_prompt` message kind is not the same as pending `AskUserQuestion`. `useChatMessages` converts `interactive_prompt` messages into assistant messages with `isInteractivePrompt: true` in [src/components/chat/hooks/useChatMessages.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/hooks/useChatMessages.ts:134). `MessageComponent` then parses menu-like text and renders a disabled amber prompt card in [src/components/chat/view/subcomponents/MessageComponent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/MessageComponent.tsx:303).

### Server path for question permissions

`AskUserQuestion` is treated as an interaction-required tool on the server in [server/claude-sdk.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/claude-sdk.js:35). When the Claude SDK asks to use that tool, the server sends a normalized `permission_request` containing `requestId`, `toolName`, `input`, `sessionId`, and `provider` in [server/claude-sdk.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/claude-sdk.js:560). When the UI responds, the backend resolves the in-flight request and returns `updatedInput` to the SDK in [server/claude-sdk.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/claude-sdk.js:594).

The chat WebSocket relays root-app `claude-permission-response` messages into `resolveToolApproval()` in [server/index.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/index.js:1645). The same WebSocket also answers `get-pending-permissions` requests in [server/index.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/index.js:1689). The Nolme HTTP surface exposes the same pending requests through `GET /api/nolme/pending-permissions/:sessionId` in [server/routes/nolme-state.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/routes/nolme-state.js:45), and resolves decisions through `POST /api/nolme/pending-permissions/:sessionId/:requestId/decision` in [server/routes/nolme-state.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/routes/nolme-state.js:66).

### Existing Nolme implementation of the Figma-like card

The separate `nolme-ui` bundle already has a direct card analogue for the supplied Figma node. `AiResponseQuestionsCard` renders a white `12px` radius question card in [nolme-ui/src/components/AiResponseQuestionsCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/AiResponseQuestionsCard.tsx:128). Its structure maps closely to the Figma node:

| Figma element | `nolme-ui` implementation |
| --- | --- |
| card shell | section wrapper in [nolme-ui/src/components/AiResponseQuestionsCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/AiResponseQuestionsCard.tsx:129) |
| intro/header/prompt | prompt block in [nolme-ui/src/components/AiResponseQuestionsCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/AiResponseQuestionsCard.tsx:133) |
| checkbox-style options | option button and custom square check in [nolme-ui/src/components/AiResponseQuestionsCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/AiResponseQuestionsCard.tsx:163) |
| active free-text field | conditional input in [nolme-ui/src/components/AiResponseQuestionsCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/AiResponseQuestionsCard.tsx:184) |
| dividers | per-option divider in [nolme-ui/src/components/AiResponseQuestionsCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/AiResponseQuestionsCard.tsx:198) |
| skip / continue CTA row | bottom action row in [nolme-ui/src/components/AiResponseQuestionsCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/AiResponseQuestionsCard.tsx:204) |

`AiResponseQuestionsCardBound` chooses live pending `AskUserQuestion` permission state before projected historical question state in [nolme-ui/src/components/bindings/AiResponseQuestionsCardBound.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/bindings/AiResponseQuestionsCardBound.tsx:16). When the question is a live permission request, it submits `{ allow: true, updatedInput: { ...questionCard.requestInput, answers } }` in [nolme-ui/src/components/bindings/AiResponseQuestionsCardBound.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/bindings/AiResponseQuestionsCardBound.tsx:37).

The Nolme question-card model is defined in [nolme-ui/src/lib/ai-working/types.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/lib/ai-working/types.ts:73). `buildAskUserQuestionCard` maps the root chat `AskUserQuestion` payload into that model in [nolme-ui/src/lib/ai-working/projectAssistantQuestion.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/lib/ai-working/projectAssistantQuestion.ts:74). `NolmeChatView` mounts `AiResponseQuestionsCardBound` above the Nolme input container in [nolme-ui/src/components/NolmeChatView.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/NolmeChatView.tsx:107).

### Current root-app mapping for the Figma question card

| Figma `AI Response / Questions` element | Current root `src/` equivalent |
| --- | --- |
| card shell | `AskUserQuestionPanel` card wrapper |
| intro line | root panel uses fixed `Claude needs your input` label and optional `q.header`; Figma intro is a visible sentence |
| main question | `q.question` in `AskUserQuestionPanel` |
| option rows | `q.options` buttons in `AskUserQuestionPanel` |
| selected state | root panel uses blue option highlighting, keyboard hints, and a check icon |
| `Other` field | root panel has a separate `Other...` option plus conditional text input |
| `Skip for now` | root panel uses `Skip` for one question and `Skip all` for multi-question |
| `Continue` | root panel uses `Submit` on the final step and `Next` on intermediate steps |
| answered-state transcript | `QuestionAnswerContent` inside `ToolRenderer` |
| already Figma-like implementation | `nolme-ui/src/components/AiResponseQuestionsCard.tsx` |

## Code References

- [src/App.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/App.tsx:24) - root route entry for the actual `cc-agent-ui` interface
- [src/components/app/AppContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/app/AppContent.tsx:127) - full-screen shell with sidebar, main content, and mobile nav
- [src/components/app/AppContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/app/AppContent.tsx:109) - pending-permission recovery request on WebSocket reconnect or session change
- [src/components/main-content/view/MainContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/MainContent.tsx:105) - main tab host and chat mount point
- [src/components/main-content/view/subcomponents/MainContentHeader.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/subcomponents/MainContentHeader.tsx:38) - header with title, tabs, and `Open in Nolme`
- [src/components/main-content/view/subcomponents/MainContentTabSwitcher.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/main-content/view/subcomponents/MainContentTabSwitcher.tsx:68) - root tab strip
- [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:370) - chat surface composition
- [src/components/chat/view/ChatInterface.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/ChatInterface.tsx:420) - passes pending permission requests into `ChatComposer`
- [src/components/chat/hooks/useChatProviderState.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/hooks/useChatProviderState.ts:13) - owns `pendingPermissionRequests`
- [src/components/chat/hooks/useChatRealtimeHandlers.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/hooks/useChatRealtimeHandlers.ts:326) - adds realtime `permission_request` frames to pending permission state
- [src/components/chat/hooks/useChatComposerState.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/hooks/useChatComposerState.ts:987) - sends `claude-permission-response` decisions
- [src/components/chat/hooks/useChatMessages.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/hooks/useChatMessages.ts:134) - maps legacy `interactive_prompt` messages to rendered chat messages
- [src/components/chat/types/types.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/types/types.ts:73) - `PendingPermissionRequest`, `QuestionOption`, and `Question` shapes
- [src/components/chat/view/subcomponents/ChatMessagesPane.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatMessagesPane.tsx:133) - message list surface
- [src/components/chat/view/subcomponents/MessageComponent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/MessageComponent.tsx:115) - user, assistant, tool, prompt, and thinking row rendering
- [src/components/chat/view/subcomponents/MessageComponent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/MessageComponent.tsx:303) - legacy amber `interactive_prompt` card rendering
- [src/components/chat/view/subcomponents/AssistantThinkingIndicator.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/AssistantThinkingIndicator.tsx:9) - in-stream thinking row
- [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:171) - input card and submit surface
- [src/components/chat/view/subcomponents/ChatComposer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatComposer.tsx:161) - detects active `AskUserQuestion` panels and suppresses normal composer controls
- [src/components/chat/view/subcomponents/ClaudeStatus.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ClaudeStatus.tsx:111) - status card above the composer
- [src/components/chat/view/subcomponents/ChatInputControls.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ChatInputControls.tsx:40) - compact control row
- [src/components/chat/view/subcomponents/PermissionRequestsBanner.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/PermissionRequestsBanner.tsx:28) - permission-request UI
- [src/components/chat/tools/configs/permissionPanelRegistry.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/configs/permissionPanelRegistry.ts:4) - custom permission panel contract
- [src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/components/InteractiveRenderers/AskUserQuestionPanel.tsx:5) - current root-app live `AskUserQuestion` panel
- [src/components/chat/tools/configs/toolConfigs.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/configs/toolConfigs.ts:467) - historical `AskUserQuestion` tool config
- [src/components/chat/tools/ToolRenderer.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/ToolRenderer.tsx:182) - routes question-answer content to `QuestionAnswerContent`
- [src/components/chat/tools/components/ContentRenderers/QuestionAnswerContent.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/tools/components/ContentRenderers/QuestionAnswerContent.tsx:11) - historical question/answer renderer
- [src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx:153) - provider/model selection empty state
- [src/components/task-master/view/TaskMasterPanel.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/TaskMasterPanel.tsx:79) - tasks workspace that currently holds task execution detail outside the chat tab
- [src/components/task-master/view/TaskBoard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/TaskBoard.tsx:132) - task board surface with toolbar and content
- [src/components/task-master/view/TaskCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/TaskCard.tsx:138) - task card with status and progress metadata
- [src/components/task-master/view/NextTaskBanner.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/task-master/view/NextTaskBanner.tsx:49) - chat-adjacent task summary banner used only in pre-transcript states
- [src/components/file-tree/view/FileTree.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/file-tree/view/FileTree.tsx:123) - file/artifact browser in the `files` tab
- [src/components/file-tree/view/FileTreeDetailedColumns.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/file-tree/view/FileTreeDetailedColumns.tsx:7) - file metadata header row
- [src/components/file-tree/view/FileTreeNode.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/file-tree/view/FileTreeNode.tsx:144) - file row with modified-date metadata
- [src/components/quick-settings-panel/view/QuickSettingsPanelView.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/components/quick-settings-panel/view/QuickSettingsPanelView.tsx:58) - floating quick settings drawer
- [server/claude-sdk.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/claude-sdk.js:35) - marks `AskUserQuestion` as interaction-required
- [server/claude-sdk.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/claude-sdk.js:560) - emits normalized `permission_request` events for tool approval
- [server/index.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/index.js:1645) - resolves root-app `claude-permission-response` messages
- [server/routes/nolme-state.js](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/server/routes/nolme-state.js:45) - exposes pending permissions to Nolme over HTTP
- [nolme-ui/src/components/AiResponseQuestionsCard.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/AiResponseQuestionsCard.tsx:128) - separate Nolme Figma-like question card
- [nolme-ui/src/components/bindings/AiResponseQuestionsCardBound.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/bindings/AiResponseQuestionsCardBound.tsx:16) - binds pending or projected question state to the Nolme card
- [nolme-ui/src/lib/ai-working/projectAssistantQuestion.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/lib/ai-working/projectAssistantQuestion.ts:74) - maps `AskUserQuestion` payloads into the Nolme question-card model
- [nolme-ui/src/components/NolmeChatView.tsx](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/nolme-ui/src/components/NolmeChatView.tsx:107) - mounts the Nolme question card above the composer
- [tests/generated/test_nolme_pending_permissions_route.spec.ts](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/tests/generated/test_nolme_pending_permissions_route.spec.ts:47) - pending-permission route tests for `AskUserQuestion`
- [src/index.css](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/src/index.css:24) - root app token and typography baseline

## Related Research

- [thoughts/shared/research/2026-04-26-open-in-nolme-session-hydration.md](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/thoughts/searchable/shared/research/2026-04-26-open-in-nolme-session-hydration.md:1) - adjacent research about the separate `Open in Nolme` flow; outside this note's scope
- [thoughts/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md](/home/maceo/Dev/cosmic-agent-memory/cc-agent-ui/thoughts/searchable/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md:74) - adjacent research about Nolme question and approval surfaces

## Open Questions

- The supplied Figma URL targets the center `chat-stream` node only. It does not specify the root app's sidebar, header, tabs, editor sidebar, or quick-settings drawer.
- The supplied node does not expose a separate design spec for the root app's current pagination controls, permission banners, or floating quick-settings handle.
