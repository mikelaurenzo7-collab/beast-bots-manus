# Beast Bots — Project TODO

## Database & Backend
- [x] Extended schema: oauth_connections, installations, agent_runs, notifications, chat_messages tables
- [x] tRPC routers: agents, installations, connections, activity, notifications, chat
- [x] AES-256-GCM token encryption helpers
- [x] OAuth flow: initiate + callback for 36 providers
- [x] LLM chat assistant procedure (invokeLLM)
- [x] Notification system (run complete, run error, new bot)
- [x] Agent run execution (stub + log)

## Data Layer
- [x] All 80 agents data with full metadata (slug, name, category, mascot, OAuth, customizations)
- [x] 14+ categories complete (Communication, Productivity, Development, Data & Storage, Business, CRM & Sales, Marketing, Social & Content, Data APIs, AI, E-commerce, Finance & Trading, Infrastructure, Analytics)
- [x] Deterministic SVG mascot generator (slug hash → unique creature)
- [x] OAuth provider configs (36 providers)

## Frontend Pages
- [x] Global design system: cream paper theme, pop shadows, Fraunces font, beast palette
- [x] Marketing landing page (hero with floating mascots, stats strip, featured agents, CTA)
- [x] Marketplace page (search, category rail, grouped grid of all 80 agents)
- [x] Agent detail page (mascot, tagline, capabilities, permissions, install flow, customization panel)
- [x] Dashboard page (installed bots, activity feed, connections overview)
- [x] Activity logs page (run history, status filters, stats)
- [x] Notifications page (in-app notification center, mark all read)
- [x] BeastBot AI chat page (LLM-powered agent recommendations)
- [x] Settings page (OAuth connection management, API key storage, profile)

## UI Components
- [x] BeastCard (default, compact variants with mascot, badges, rating)
- [x] Mascot SVG component (deterministic from slug)
- [x] NavBar (desktop + mobile, notification bell, auth state)
- [x] Category rail + search bar
- [x] Pop-shadow card system
- [x] Shimmer loading skeletons

## Polish & Quality
- [x] Mobile-first responsive design
- [x] Protected routes (dashboard, settings, install, activity, notifications, chat)
- [x] Loading skeletons throughout
- [x] Vitest tests: 23 tests passing (auth.logout + beast-bots feature tests)
- [x] Zero TypeScript errors
- [x] Google Fonts (Fraunces + Inter) loaded in index.html


## Phase 2: Workflow Composer & Templates

### OAuth Credential Management
- [ ] Real OAuth provider credential input forms in Settings
- [ ] Encrypted credential storage (AES-256-GCM)
- [ ] Provider-specific scopes and permissions UI
- [ ] Credential validation and test connection button
- [ ] Revoke/disconnect functionality

### Workflow Composer
- [ ] Workflow canvas page with React Flow or similar
- [ ] Drag-and-drop agent nodes
- [ ] Connection lines between agents (output → input)
- [ ] Node configuration panels (agent selection, parameter mapping)
- [ ] Workflow save/load/delete operations
- [ ] Workflow execution engine (multi-agent orchestration)
- [ ] Workflow run history and status tracking

### Agent Templates Library
- [ ] 10+ pre-configured workflow templates (GitHub PR → Slack → Linear, etc.)
- [ ] Template preview cards with visual workflow diagram
- [ ] One-click template install on dashboard
- [ ] Template customization UI (agent selection, credential mapping)
- [ ] Template rating and usage stats
- [ ] Community template sharing (future)

### Testing & Polish
- [ ] Vitest tests for workflow execution
- [ ] Error handling and retry logic
- [ ] Loading states and animations
- [ ] Mobile-responsive canvas
