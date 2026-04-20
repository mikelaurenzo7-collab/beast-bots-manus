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
