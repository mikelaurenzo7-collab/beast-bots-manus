#!/usr/bin/env python3
"""
Enrichment script: adds workflowSteps and useCases to all 80 Beast Bots agents.
Reads the current agents.ts, finds each agent by slug, and injects the enrichment
data right before the closing `},` of each agent block.
"""

import re

ENRICHMENTS = {
    "gmail-beast": {
        "workflowSteps": [
            "1. Connect your Google account via OAuth (Gmail scope)",
            "2. Beast scans your inbox every 5 minutes for new messages",
            "3. AI classifies each email: priority, topic, sender type",
            "4. High-priority emails get flagged; routine ones are auto-labeled",
            "5. For emails matching reply patterns, a draft is generated and queued",
            "6. Daily digest summarizes all unread threads at your chosen time",
        ],
        "useCases": [
            "Auto-reply to customer support inquiries with templated responses",
            "Summarize 50+ unread emails into a 2-minute morning briefing",
            "Auto-unsubscribe from newsletters matching keywords",
            "Forward invoices to accounting@ automatically",
            "Schedule follow-up reminders when no reply arrives within 48h",
        ],
    },
    "slack-beast": {
        "workflowSteps": [
            "1. Connect Slack workspace via OAuth",
            "2. Beast monitors selected channels in real-time",
            "3. At standup time, it DMs each team member with prompt questions",
            "4. Responses are collected and posted as a summary in #standup",
            "5. Unread channel activity is summarized every 4 hours",
            "6. Smart reminders are set based on action items detected in messages",
        ],
        "useCases": [
            "Run automated daily standups across distributed teams",
            "Summarize #general activity for async team members in different timezones",
            "Auto-respond to common questions in #support channel",
            "Detect action items in meeting notes and create Jira tickets",
            "Send weekly channel digest to stakeholders via email",
        ],
    },
    "discord-beast": {
        "workflowSteps": [
            "1. Add Beast Bot to your Discord server via OAuth bot invite",
            "2. Configure moderation rules, welcome messages, and auto-roles",
            "3. Beast monitors all channels for rule violations 24/7",
            "4. Violations trigger warnings, timeouts, or bans per your config",
            "5. New members receive a personalized welcome message and role assignment",
            "6. Weekly community digest is posted to your announcements channel",
        ],
        "useCases": [
            "Auto-moderate toxic messages and spam in gaming communities",
            "Welcome new members with role selection menus",
            "Run community polls and collect structured feedback",
            "Announce events and track RSVPs automatically",
            "Sync Discord roles with Patreon subscription tiers",
        ],
    },
    "teams-beast": {
        "workflowSteps": [
            "1. Connect Microsoft 365 account via OAuth",
            "2. Beast joins your Teams meetings as a silent note-taker",
            "3. Meeting transcript is processed by AI in real-time",
            "4. Action items, decisions, and follow-ups are extracted",
            "5. Summary is posted to the Teams channel within 2 minutes of meeting end",
            "6. Action items are synced to Planner or assigned via email",
        ],
        "useCases": [
            "Auto-generate meeting notes for all recurring standups",
            "Extract action items and assign them to team members in Planner",
            "Summarize Teams channels for executives who missed discussions",
            "Translate meeting notes into multiple languages for global teams",
            "Archive all meeting transcripts to SharePoint automatically",
        ],
    },
    "zoom-beast": {
        "workflowSteps": [
            "1. Connect Zoom account via OAuth",
            "2. Beast attaches to scheduled meetings as a cloud recording listener",
            "3. After the meeting, transcript is fetched from Zoom's API",
            "4. AI generates summary, action items, and key quotes",
            "5. Summary is emailed to all participants within 5 minutes",
            "6. Recording link and notes are saved to your connected Notion or Drive",
        ],
        "useCases": [
            "Send automatic post-meeting summaries to all attendees",
            "Extract sales call insights and log them to CRM",
            "Create searchable archive of all company meetings",
            "Generate training materials from recorded onboarding sessions",
            "Identify recurring blockers across weekly team syncs",
        ],
    },
    "notion-beast": {
        "workflowSteps": [
            "1. Connect Notion workspace via OAuth",
            "2. Configure which databases and pages Beast should monitor",
            "3. Beast watches for new entries, updates, and status changes",
            "4. When a task is marked Done, Beast triggers downstream actions",
            "5. AI generates weekly project summaries from your databases",
            "6. New content is auto-tagged, linked, and organized by topic",
        ],
        "useCases": [
            "Auto-create project pages from a template when a new client is added",
            "Generate weekly status reports from your project database",
            "Sync Notion tasks to GitHub Issues bidirectionally",
            "Auto-tag and organize meeting notes by project and date",
            "Build a personal knowledge base that self-organizes as you write",
        ],
    },
    "google-calendar-beast": {
        "workflowSteps": [
            "1. Connect Google Calendar via OAuth",
            "2. Beast analyzes your calendar for conflicts, gaps, and patterns",
            "3. Meeting prep briefs are generated 30 minutes before each event",
            "4. Post-meeting, Beast creates follow-up tasks in your task manager",
            "5. Focus blocks are automatically protected based on your work patterns",
            "6. Weekly schedule is optimized and conflicts are flagged proactively",
        ],
        "useCases": [
            "Get AI-generated briefs before every meeting with attendee context",
            "Automatically block focus time based on your productivity patterns",
            "Reschedule conflicts intelligently based on priority and attendee availability",
            "Create recurring event templates for standups, 1:1s, and reviews",
            "Sync calendar events to Notion, Slack, and email automatically",
        ],
    },
    "todoist-beast": {
        "workflowSteps": [
            "1. Connect Todoist account via API key",
            "2. Beast analyzes your task backlog and due dates",
            "3. AI prioritizes tasks using Eisenhower matrix logic",
            "4. Daily plan is generated each morning with top 3 focus tasks",
            "5. Overdue tasks are rescheduled or escalated automatically",
            "6. Weekly review report shows completion rate and bottlenecks",
        ],
        "useCases": [
            "Auto-prioritize your backlog every morning based on deadlines",
            "Break large projects into subtasks automatically using AI",
            "Sync tasks from email, Slack messages, and meeting notes",
            "Generate weekly productivity reports with completion trends",
            "Escalate overdue tasks to your manager via Slack",
        ],
    },
    "linear-beast": {
        "workflowSteps": [
            "1. Connect Linear workspace via OAuth",
            "2. Beast monitors issue updates, PRs, and cycle progress",
            "3. When a PR is merged, linked issues are auto-closed",
            "4. Sprint planning suggestions are generated from backlog priority",
            "5. Blockers are detected and flagged to the team lead",
            "6. Weekly engineering report is posted to Slack automatically",
        ],
        "useCases": [
            "Auto-close Linear issues when linked GitHub PRs are merged",
            "Generate sprint planning recommendations from backlog velocity",
            "Create issues automatically from Slack messages tagged with #bug",
            "Post weekly engineering progress reports to leadership",
            "Detect and escalate issues that have been blocked for 3+ days",
        ],
    },
    "jira-beast": {
        "workflowSteps": [
            "1. Connect Jira via API key or OAuth",
            "2. Beast monitors your project boards for status changes",
            "3. Stale tickets (no update in 5+ days) are flagged automatically",
            "4. Sprint velocity is calculated and reported each Friday",
            "5. Bug reports from Sentry/Datadog are auto-converted to Jira issues",
            "6. Release notes are auto-generated from completed sprint tickets",
        ],
        "useCases": [
            "Auto-create Jira tickets from Sentry error alerts",
            "Generate sprint retrospective reports from completed issues",
            "Sync Jira status with Slack channel topics in real-time",
            "Auto-assign tickets based on team member expertise and workload",
            "Create release notes from all tickets closed in a sprint",
        ],
    },
    "github-beast": {
        "workflowSteps": [
            "1. Connect GitHub account via OAuth",
            "2. Beast monitors repos for PRs, issues, and CI failures",
            "3. New PRs trigger an AI code review within 2 minutes",
            "4. Review comments highlight bugs, security issues, and style violations",
            "5. Failing CI runs are analyzed and root cause is posted to the PR",
            "6. Weekly repo health report covers coverage, open PRs, and tech debt",
        ],
        "useCases": [
            "Get instant AI code reviews on every pull request",
            "Auto-label issues by type (bug, feature, docs) using AI classification",
            "Generate changelogs from merged PRs for each release",
            "Alert on-call engineer when CI fails on main branch",
            "Detect secrets accidentally committed to public repos",
        ],
    },
    "vercel-beast": {
        "workflowSteps": [
            "1. Connect Vercel account via API token",
            "2. Beast monitors all deployments for build failures and performance regressions",
            "3. On deployment, Lighthouse scores are measured and compared to baseline",
            "4. If performance drops >10%, a Slack alert is sent with diff",
            "5. Preview deployment URLs are posted to the linked PR automatically",
            "6. Monthly deployment analytics are compiled and sent to the team",
        ],
        "useCases": [
            "Alert team when a deployment causes a Lighthouse score regression",
            "Post preview deployment URLs to GitHub PRs automatically",
            "Roll back a deployment when error rate spikes above threshold",
            "Track build time trends and identify slow builds",
            "Generate monthly deployment health reports for stakeholders",
        ],
    },
    "aws-beast": {
        "workflowSteps": [
            "1. Connect AWS account via IAM role with read/write permissions",
            "2. Beast continuously monitors CloudWatch metrics and billing",
            "3. Anomalies in cost, latency, or error rates trigger instant alerts",
            "4. Right-sizing recommendations are generated weekly for EC2/RDS",
            "5. Security Hub findings are triaged and assigned to the right team",
            "6. Monthly cost optimization report identifies top savings opportunities",
        ],
        "useCases": [
            "Alert on unexpected AWS cost spikes before the bill arrives",
            "Auto-scale ECS services based on custom business metrics",
            "Identify and terminate unused EC2 instances and idle RDS clusters",
            "Generate weekly security posture reports from Security Hub",
            "Enforce tagging policies and flag untagged resources automatically",
        ],
    },
    "docker-beast": {
        "workflowSteps": [
            "1. Connect Docker Hub or private registry via API token",
            "2. Beast scans all images for CVEs using Trivy on each push",
            "3. Critical vulnerabilities trigger a Slack alert with remediation steps",
            "4. Base image updates are detected and PRs are auto-created",
            "5. Image size regressions are flagged in CI pipeline",
            "6. Weekly security report covers all images and their vulnerability status",
        ],
        "useCases": [
            "Scan Docker images for CVEs on every push to registry",
            "Auto-create PRs when base images have security updates",
            "Monitor container resource usage and alert on anomalies",
            "Enforce image signing policies across your registry",
            "Generate weekly container security posture reports",
        ],
    },
    "postgres-beast": {
        "workflowSteps": [
            "1. Connect PostgreSQL via connection string (SSL enforced)",
            "2. Beast monitors query performance, locks, and connection pool",
            "3. Slow queries (>500ms) are captured and analyzed automatically",
            "4. Index recommendations are generated from query patterns",
            "5. Daily backup verification ensures restores will succeed",
            "6. Weekly performance report covers top slow queries and growth trends",
        ],
        "useCases": [
            "Get instant alerts when query performance degrades",
            "Receive AI-generated index recommendations based on query patterns",
            "Monitor replication lag and alert before it becomes critical",
            "Auto-vacuum and analyze tables based on bloat metrics",
            "Generate database health reports for engineering reviews",
        ],
    },
    "mongodb-beast": {
        "workflowSteps": [
            "1. Connect MongoDB Atlas via API key",
            "2. Beast monitors collection growth, index usage, and slow queries",
            "3. Unindexed queries are detected and flagged with index suggestions",
            "4. Atlas alerts are enriched with context and routed to Slack",
            "5. Schema drift is detected when new fields appear unexpectedly",
            "6. Monthly performance report covers top collections and growth trends",
        ],
        "useCases": [
            "Alert when a collection grows beyond its storage tier limit",
            "Detect and flag queries that perform collection scans",
            "Monitor Atlas cluster health and auto-scale when needed",
            "Generate data model documentation from live collection schemas",
            "Track schema drift across environments (dev/staging/prod)",
        ],
    },
    "s3-beast": {
        "workflowSteps": [
            "1. Connect AWS S3 via IAM role",
            "2. Beast monitors bucket policies, public access settings, and costs",
            "3. Public buckets trigger an immediate security alert",
            "4. Lifecycle policies are suggested based on object access patterns",
            "5. Large uploads are detected and cost impact is estimated",
            "6. Monthly storage cost report identifies optimization opportunities",
        ],
        "useCases": [
            "Alert immediately when an S3 bucket is accidentally made public",
            "Auto-apply lifecycle policies to move cold data to Glacier",
            "Monitor S3 costs and identify buckets with unexpected growth",
            "Enforce encryption at rest across all buckets",
            "Generate compliance reports for SOC 2 and HIPAA audits",
        ],
    },
    "dropbox-beast": {
        "workflowSteps": [
            "1. Connect Dropbox account via OAuth",
            "2. Beast monitors shared folders for new files and changes",
            "3. New files are auto-tagged and organized by type and date",
            "4. Large files are compressed and archived automatically",
            "5. Shared link expiry dates are enforced for security",
            "6. Weekly storage report shows usage trends and large files",
        ],
        "useCases": [
            "Auto-organize client deliverables into dated folders",
            "Notify team when a shared folder receives new files",
            "Enforce expiry dates on all external shared links",
            "Sync Dropbox files to Google Drive for backup",
            "Generate weekly storage usage reports for billing",
        ],
    },
    "salesforce-beast": {
        "workflowSteps": [
            "1. Connect Salesforce org via OAuth",
            "2. Beast monitors deal stage changes, activity gaps, and pipeline health",
            "3. Deals with no activity in 7+ days trigger a follow-up reminder",
            "4. New leads are scored and assigned to reps based on ICP match",
            "5. Forecast is updated automatically from stage probabilities",
            "6. Weekly pipeline report is sent to sales leadership",
        ],
        "useCases": [
            "Auto-assign inbound leads to reps based on territory and ICP score",
            "Alert reps when a deal has been stale for more than 7 days",
            "Generate weekly pipeline health reports for sales leadership",
            "Sync Salesforce contacts to Mailchimp for nurture campaigns",
            "Auto-create follow-up tasks when a deal moves to Proposal stage",
        ],
    },
    "hubspot-beast": {
        "workflowSteps": [
            "1. Connect HubSpot account via OAuth",
            "2. Beast monitors contact activity, deal stages, and email opens",
            "3. Hot leads (3+ page views + email open) are flagged for immediate follow-up",
            "4. Deal stage changes trigger automated email sequences",
            "5. Contact records are enriched with LinkedIn and Clearbit data",
            "6. Monthly revenue attribution report is generated automatically",
        ],
        "useCases": [
            "Alert sales reps when a lead visits the pricing page 3+ times",
            "Auto-enroll contacts in nurture sequences based on behavior",
            "Enrich contact records with company size and industry data",
            "Generate monthly MQL-to-SQL conversion reports",
            "Sync HubSpot deals to Slack for real-time pipeline visibility",
        ],
    },
    "pipedrive-beast": {
        "workflowSteps": [
            "1. Connect Pipedrive via API token",
            "2. Beast monitors deal activity, rotting deals, and won/lost rates",
            "3. Rotting deals (no activity in N days) trigger alerts to the rep",
            "4. Won deals trigger onboarding sequences automatically",
            "5. Lost deals are analyzed for common objection patterns",
            "6. Weekly win/loss analysis is posted to the sales Slack channel",
        ],
        "useCases": [
            "Alert reps when deals are about to rot based on stage age",
            "Auto-trigger onboarding workflows when a deal is marked Won",
            "Analyze lost deal reasons and surface patterns to management",
            "Sync Pipedrive contacts to your email marketing platform",
            "Generate weekly sales velocity and conversion rate reports",
        ],
    },
    "intercom-beast": {
        "workflowSteps": [
            "1. Connect Intercom workspace via OAuth",
            "2. Beast monitors new conversations and response time SLAs",
            "3. Incoming messages are classified by intent (support, sales, billing)",
            "4. High-priority conversations are escalated to the right team",
            "5. AI drafts suggested replies based on your knowledge base",
            "6. Weekly CSAT and response time report is generated automatically",
        ],
        "useCases": [
            "Auto-route support tickets to the right team based on topic",
            "Draft AI-powered reply suggestions from your help docs",
            "Alert on-call when response SLA is about to be breached",
            "Identify churning customers from support conversation patterns",
            "Generate weekly support volume and CSAT trend reports",
        ],
    },
    "zendesk-beast": {
        "workflowSteps": [
            "1. Connect Zendesk via API token",
            "2. Beast monitors ticket queue, SLA timers, and CSAT scores",
            "3. New tickets are auto-tagged and routed to the correct queue",
            "4. SLA breach warnings are sent 30 minutes before deadline",
            "5. Similar past tickets are surfaced to agents as suggested solutions",
            "6. Weekly support health report covers volume, CSAT, and resolution time",
        ],
        "useCases": [
            "Auto-tag and route tickets by product area and severity",
            "Alert agents 30 minutes before an SLA breach",
            "Suggest solutions from past tickets using semantic search",
            "Generate weekly support performance dashboards for managers",
            "Auto-close tickets resolved via chat without agent follow-up",
        ],
    },
    "mailchimp-beast": {
        "workflowSteps": [
            "1. Connect Mailchimp account via OAuth",
            "2. Beast monitors campaign performance and list health",
            "3. Subscribers who haven't opened in 90 days are flagged for re-engagement",
            "4. A/B test results are analyzed and winning variants are auto-selected",
            "5. New subscribers are enrolled in the right welcome sequence automatically",
            "6. Monthly email performance report covers opens, clicks, and revenue",
        ],
        "useCases": [
            "Auto-enroll new subscribers in segmented welcome sequences",
            "Re-engage inactive subscribers with personalized win-back campaigns",
            "Analyze A/B test results and auto-select winning subject lines",
            "Sync Mailchimp segments to Facebook Custom Audiences",
            "Generate monthly email ROI reports for marketing leadership",
        ],
    },
    "sendgrid-beast": {
        "workflowSteps": [
            "1. Connect SendGrid via API key",
            "2. Beast monitors deliverability, bounce rates, and spam complaints",
            "3. Bounce rate spikes trigger immediate alerts and list cleaning",
            "4. Transactional email templates are versioned and tested automatically",
            "5. IP warm-up schedules are managed and optimized by Beast",
            "6. Weekly deliverability report covers inbox placement and reputation",
        ],
        "useCases": [
            "Alert when bounce rate exceeds 2% before it damages sender reputation",
            "Auto-clean email lists by removing hard bounces and spam complaints",
            "Monitor transactional email delivery rates for critical flows",
            "Manage IP warm-up schedules for new sending domains",
            "Generate weekly deliverability health reports",
        ],
    },
    "twitter-beast": {
        "workflowSteps": [
            "1. Connect X/Twitter account via OAuth",
            "2. Beast monitors mentions, DMs, and trending topics in your niche",
            "3. Brand mentions are classified as positive, neutral, or negative",
            "4. Negative mentions trigger alerts for immediate response",
            "5. Scheduled posts are published at optimal engagement times",
            "6. Weekly analytics report covers reach, engagement, and follower growth",
        ],
        "useCases": [
            "Monitor brand mentions and alert on negative sentiment spikes",
            "Schedule tweets at AI-optimized posting times for maximum reach",
            "Auto-reply to common questions using your FAQ knowledge base",
            "Track competitor mentions and engagement rates",
            "Generate weekly social media performance reports",
        ],
    },
    "instagram-beast": {
        "workflowSteps": [
            "1. Connect Instagram Business account via OAuth",
            "2. Beast analyzes your audience activity patterns and content performance",
            "3. Optimal posting times are calculated from your engagement data",
            "4. New posts are auto-captioned with AI-generated copy and hashtags",
            "5. Story replies and DMs are monitored for urgent messages",
            "6. Weekly content performance report covers reach, saves, and profile visits",
        ],
        "useCases": [
            "Generate AI captions and hashtag sets for every new post",
            "Schedule posts at peak engagement times for your specific audience",
            "Monitor DMs and auto-reply to common questions",
            "Track competitor content performance and identify trends",
            "Generate weekly Instagram analytics reports for clients",
        ],
    },
    "linkedin-beast": {
        "workflowSteps": [
            "1. Connect LinkedIn account via OAuth",
            "2. Beast monitors your network activity and content performance",
            "3. New connection requests are filtered and prioritized by ICP match",
            "4. AI drafts personalized connection messages based on profile data",
            "5. Content ideas are generated from trending topics in your industry",
            "6. Weekly engagement report covers post reach and profile views",
        ],
        "useCases": [
            "Draft personalized outreach messages for new connection requests",
            "Generate LinkedIn post ideas from industry news and trends",
            "Monitor company page engagement and alert on viral posts",
            "Track profile view trends and identify warm leads",
            "Auto-comment on posts from target accounts to increase visibility",
        ],
    },
    "youtube-beast": {
        "workflowSteps": [
            "1. Connect YouTube channel via OAuth",
            "2. Beast monitors video performance, comments, and subscriber trends",
            "3. New video uploads trigger auto-generated titles, descriptions, and tags",
            "4. Comment sentiment is analyzed and toxic comments are flagged",
            "5. Optimal upload times are calculated from audience activity data",
            "6. Monthly channel analytics report covers views, watch time, and revenue",
        ],
        "useCases": [
            "Auto-generate SEO-optimized titles and descriptions for new videos",
            "Moderate comments and auto-hide toxic or spam content",
            "Identify your best-performing video topics for content planning",
            "Generate chapter markers from video transcripts automatically",
            "Track subscriber growth trends and alert on unusual drops",
        ],
    },
    "tiktok-beast": {
        "workflowSteps": [
            "1. Connect TikTok Business account via OAuth",
            "2. Beast monitors trending sounds, hashtags, and content formats",
            "3. Your video performance is benchmarked against trending content",
            "4. Optimal posting windows are identified from your audience data",
            "5. Auto-captions and hashtag sets are generated for each video",
            "6. Weekly trend report highlights emerging sounds and formats to use",
        ],
        "useCases": [
            "Identify trending sounds before they peak for maximum reach",
            "Generate AI captions and hashtag sets for every TikTok",
            "Schedule posts at optimal times for your specific audience",
            "Monitor competitor content strategies and engagement rates",
            "Generate weekly TikTok performance reports for brand clients",
        ],
    },
    "buffer-beast": {
        "workflowSteps": [
            "1. Connect Buffer account via OAuth",
            "2. Beast analyzes your posting history and engagement patterns",
            "3. Optimal posting schedule is generated for each connected platform",
            "4. Content queue is automatically filled from your RSS feeds and sources",
            "5. Low-performing posts are identified and removed from the queue",
            "6. Weekly cross-platform analytics report is generated automatically",
        ],
        "useCases": [
            "Auto-fill your Buffer queue from blog RSS feeds and news sources",
            "Optimize posting schedules across all platforms simultaneously",
            "Repurpose top-performing content for different platforms",
            "Generate cross-platform social media reports for clients",
            "Alert when your content queue drops below 3 days of posts",
        ],
    },
    "wordpress-beast": {
        "workflowSteps": [
            "1. Connect WordPress site via REST API key",
            "2. Beast monitors content performance, SEO scores, and plugin updates",
            "3. New posts are analyzed for SEO gaps and improvement suggestions",
            "4. Plugin and theme updates are staged and tested before applying",
            "5. Broken links are detected and flagged for repair",
            "6. Monthly SEO performance report covers rankings and traffic trends",
        ],
        "useCases": [
            "Get AI-powered SEO recommendations for every new post",
            "Auto-update plugins in staging before pushing to production",
            "Monitor site uptime and alert on downtime immediately",
            "Generate monthly content performance reports with ranking data",
            "Detect and fix broken internal links automatically",
        ],
    },
    "stripe-beast": {
        "workflowSteps": [
            "1. Connect Stripe account via OAuth",
            "2. Beast monitors payments, subscriptions, and failed charges",
            "3. Failed payments trigger smart retry sequences with dunning emails",
            "4. Churn risk is detected from subscription cancellation signals",
            "5. Revenue anomalies (spikes or drops) trigger immediate alerts",
            "6. Monthly MRR, churn, and LTV report is generated automatically",
        ],
        "useCases": [
            "Recover failed payments with intelligent retry and dunning sequences",
            "Alert on revenue anomalies before they impact monthly targets",
            "Identify at-risk subscriptions before they churn",
            "Generate monthly MRR and churn reports for investors",
            "Sync new customers to HubSpot and Mailchimp automatically",
        ],
    },
    "quickbooks-beast": {
        "workflowSteps": [
            "1. Connect QuickBooks Online via OAuth",
            "2. Beast monitors transactions, invoices, and cash flow",
            "3. Overdue invoices trigger automated reminder sequences",
            "4. Expenses are auto-categorized using AI and past patterns",
            "5. Cash flow forecast is updated daily and alerts on shortfalls",
            "6. Monthly P&L and cash flow report is generated automatically",
        ],
        "useCases": [
            "Auto-send invoice reminders for overdue accounts receivable",
            "Categorize expenses automatically using AI and historical patterns",
            "Generate monthly P&L reports for accountants and investors",
            "Alert when cash runway drops below 60 days",
            "Reconcile bank transactions with QuickBooks entries automatically",
        ],
    },
    "xero-beast": {
        "workflowSteps": [
            "1. Connect Xero account via OAuth",
            "2. Beast monitors bank feeds, invoices, and payroll",
            "3. Bank transactions are auto-reconciled with invoices and bills",
            "4. Payroll runs are verified against timesheets before submission",
            "5. GST/VAT returns are prepared and flagged for review",
            "6. Monthly financial health report covers cash flow and profitability",
        ],
        "useCases": [
            "Auto-reconcile bank transactions with Xero invoices daily",
            "Prepare GST/VAT returns with AI-assisted categorization",
            "Alert on overdue bills and cash flow shortfalls",
            "Generate monthly management accounts for board reporting",
            "Sync Xero contacts to your CRM for unified customer records",
        ],
    },
    "airtable-beast": {
        "workflowSteps": [
            "1. Connect Airtable workspace via API key",
            "2. Beast monitors base changes, view filters, and automation triggers",
            "3. New records trigger downstream workflows (emails, Slack, tasks)",
            "4. Data quality issues (missing fields, duplicates) are flagged",
            "5. Views are auto-updated with filtered and sorted data",
            "6. Weekly base activity report shows record counts and change velocity",
        ],
        "useCases": [
            "Trigger Slack notifications when a new record is added to a base",
            "Auto-populate fields using AI from text in other columns",
            "Detect and merge duplicate records across large bases",
            "Generate weekly project status reports from Airtable data",
            "Sync Airtable records to Google Sheets for stakeholder access",
        ],
    },
    "google-sheets-beast": {
        "workflowSteps": [
            "1. Connect Google Sheets via OAuth",
            "2. Beast monitors sheets for new rows, formula errors, and data changes",
            "3. New rows trigger configurable downstream actions (email, Slack, webhook)",
            "4. Formula errors are detected and flagged with suggested fixes",
            "5. Data validation rules are enforced and violations are highlighted",
            "6. Weekly data quality report covers errors, blanks, and anomalies",
        ],
        "useCases": [
            "Trigger email notifications when a new row is added to a tracker",
            "Auto-clean and validate data as it's entered into sheets",
            "Generate charts and dashboards from sheet data automatically",
            "Sync Google Sheets data to your database or CRM",
            "Alert on formula errors in critical financial models",
        ],
    },
    "openai-beast": {
        "workflowSteps": [
            "1. Connect OpenAI via API key",
            "2. Configure your preferred model, temperature, and system prompt",
            "3. Beast routes tasks to the appropriate model (GPT-4o for complex, GPT-4o-mini for fast)",
            "4. Responses are cached to reduce API costs on repeated queries",
            "5. Token usage is monitored and alerts fire when budget is exceeded",
            "6. Monthly usage report covers tokens, cost, and model distribution",
        ],
        "useCases": [
            "Build a custom AI assistant trained on your company knowledge base",
            "Auto-generate product descriptions from SKU data at scale",
            "Classify customer feedback into categories automatically",
            "Generate code documentation from source files",
            "Monitor and optimize OpenAI API costs across your organization",
        ],
    },
    "anthropic-beast": {
        "workflowSteps": [
            "1. Connect Anthropic API via API key",
            "2. Configure Claude model version and system prompt",
            "3. Beast routes long-context tasks (200K tokens) to Claude automatically",
            "4. Document analysis, code review, and research tasks are queued",
            "5. Responses are streamed for real-time display in your interface",
            "6. Usage and cost tracking is updated after every API call",
        ],
        "useCases": [
            "Analyze entire codebases or legal documents in a single prompt",
            "Generate comprehensive research reports from multiple sources",
            "Review and improve long-form content with detailed feedback",
            "Build AI pipelines that require nuanced reasoning and safety",
            "Process customer support tickets with Claude's nuanced understanding",
        ],
    },
    "perplexity-beast": {
        "workflowSteps": [
            "1. Connect Perplexity API via API key",
            "2. Configure search depth (quick vs. deep research mode)",
            "3. Beast submits research queries with source citation requirements",
            "4. Results are returned with inline citations and source URLs",
            "5. Research reports are formatted and saved to Notion or Drive",
            "6. Fact-checking runs compare claims against current web sources",
        ],
        "useCases": [
            "Research competitors with cited, up-to-date web sources",
            "Fact-check content before publishing to avoid misinformation",
            "Generate market research reports with live data citations",
            "Monitor industry news and summarize daily briefings",
            "Answer customer questions with verified, sourced responses",
        ],
    },
    "midjourney-beast": {
        "workflowSteps": [
            "1. Connect Midjourney via Discord bot token",
            "2. Configure default style, aspect ratio, and quality settings",
            "3. Beast submits image generation prompts to Midjourney's Discord bot",
            "4. Generated images are fetched and saved to your connected storage",
            "5. Variations and upscales are triggered automatically based on rules",
            "6. Image library is organized by project, date, and style",
        ],
        "useCases": [
            "Generate product mockup images from text descriptions at scale",
            "Create consistent brand imagery with saved style presets",
            "Auto-generate social media visuals from post copy",
            "Build an organized image library from all generated assets",
            "Create variations of top-performing ad creatives automatically",
        ],
    },
    "elevenlabs-beast": {
        "workflowSteps": [
            "1. Connect ElevenLabs via API key",
            "2. Configure default voice, stability, and clarity settings",
            "3. Beast converts text content to speech using your chosen voice",
            "4. Audio files are saved to S3 or your connected storage",
            "5. Podcast episodes are auto-generated from blog posts",
            "6. Voice clones are managed and versioned in your library",
        ],
        "useCases": [
            "Convert blog posts to podcast episodes automatically",
            "Generate voiceovers for video content at scale",
            "Create audio versions of newsletters for accessibility",
            "Build interactive voice responses for customer support",
            "Generate multilingual audio content from a single text source",
        ],
    },
    "pinecone-beast": {
        "workflowSteps": [
            "1. Connect Pinecone via API key",
            "2. Configure index dimensions, metric, and pod type",
            "3. Beast embeds your documents and stores vectors in Pinecone",
            "4. Semantic search queries return the most relevant results",
            "5. Index is updated automatically when source documents change",
            "6. Query performance and index health are monitored continuously",
        ],
        "useCases": [
            "Build a semantic search engine over your company knowledge base",
            "Power a RAG chatbot that answers questions from your docs",
            "Find similar products in a catalog using vector similarity",
            "Detect duplicate content across a large document corpus",
            "Build recommendation systems based on content similarity",
        ],
    },
    "shopify-beast": {
        "workflowSteps": [
            "1. Connect Shopify store via OAuth",
            "2. Beast monitors orders, inventory, and product performance",
            "3. Low inventory triggers purchase order suggestions automatically",
            "4. New orders are fulfilled and tracking numbers are sent to customers",
            "5. Product descriptions are optimized with AI for SEO",
            "6. Weekly store performance report covers revenue, AOV, and conversion",
        ],
        "useCases": [
            "Auto-reorder inventory when stock drops below threshold",
            "Generate SEO-optimized product descriptions from product data",
            "Alert on abandoned carts and trigger recovery sequences",
            "Sync Shopify orders to your fulfillment system automatically",
            "Generate weekly ecommerce performance reports for stakeholders",
        ],
    },
    "woocommerce-beast": {
        "workflowSteps": [
            "1. Connect WooCommerce store via REST API key",
            "2. Beast monitors orders, products, and customer activity",
            "3. New orders trigger fulfillment workflows and customer emails",
            "4. Inventory alerts fire when stock drops below reorder point",
            "5. Product performance is analyzed weekly for optimization",
            "6. Monthly revenue report covers sales by product, category, and channel",
        ],
        "useCases": [
            "Auto-send order confirmation and shipping update emails",
            "Alert when products go out of stock before customers notice",
            "Generate monthly sales reports by product category",
            "Sync WooCommerce customers to your email marketing platform",
            "Identify and promote best-selling products automatically",
        ],
    },
    "amazon-seller-beast": {
        "workflowSteps": [
            "1. Connect Amazon Seller Central via MWS/SP-API credentials",
            "2. Beast monitors listings, BSR, reviews, and Buy Box status",
            "3. Negative reviews trigger alerts for immediate seller response",
            "4. Pricing is adjusted dynamically to maintain Buy Box competitiveness",
            "5. FBA inventory levels are monitored and reorder alerts are sent",
            "6. Weekly seller performance report covers sales, reviews, and rankings",
        ],
        "useCases": [
            "Monitor and respond to negative reviews within 24 hours",
            "Adjust prices dynamically to win the Buy Box",
            "Alert when FBA inventory drops below 30 days of supply",
            "Optimize listing titles and bullets with AI for search ranking",
            "Generate weekly Amazon performance reports for brand owners",
        ],
    },
    "klaviyo-beast": {
        "workflowSteps": [
            "1. Connect Klaviyo account via API key",
            "2. Beast monitors flow performance, list health, and revenue attribution",
            "3. Underperforming flows are flagged with improvement suggestions",
            "4. New subscribers are automatically segmented and enrolled in flows",
            "5. A/B test results are analyzed and winning variants are promoted",
            "6. Monthly email revenue report covers flow performance and ROI",
        ],
        "useCases": [
            "Auto-segment new subscribers based on acquisition source and behavior",
            "Identify and fix underperforming email flows with AI suggestions",
            "Generate monthly email revenue attribution reports",
            "Sync Klaviyo segments to Facebook and Google Ads for retargeting",
            "Alert when email deliverability drops below acceptable thresholds",
        ],
    },
    "plaid-beast": {
        "workflowSteps": [
            "1. Connect bank accounts via Plaid Link OAuth flow",
            "2. Beast syncs transactions daily from all connected accounts",
            "3. Transactions are auto-categorized using AI and Plaid's taxonomy",
            "4. Budget thresholds trigger alerts when categories are exceeded",
            "5. Recurring charges are detected and flagged for review",
            "6. Monthly financial summary covers spending by category and trends",
        ],
        "useCases": [
            "Track all business expenses across multiple bank accounts",
            "Alert when spending in any category exceeds monthly budget",
            "Detect and flag recurring SaaS subscriptions for audit",
            "Generate monthly cash flow reports for financial planning",
            "Identify unusual transactions that may indicate fraud",
        ],
    },
    "alpaca-beast": {
        "workflowSteps": [
            "1. Connect Alpaca account via API key (paper or live trading)",
            "2. Configure trading strategy, risk limits, and position sizing",
            "3. Beast monitors market data and evaluates entry/exit signals",
            "4. Trades are executed automatically when strategy conditions are met",
            "5. Portfolio is rebalanced on schedule or when drift exceeds threshold",
            "6. Daily P&L report and trade log are generated automatically",
        ],
        "useCases": [
            "Execute algorithmic trading strategies without manual intervention",
            "Backtest strategies against historical data before going live",
            "Rebalance portfolio automatically to maintain target allocations",
            "Set stop-loss and take-profit orders across all positions",
            "Generate daily trading performance reports with P&L analysis",
        ],
    },
    "coinbase-beast": {
        "workflowSteps": [
            "1. Connect Coinbase account via OAuth",
            "2. Configure DCA schedule, target assets, and allocation percentages",
            "3. Beast executes DCA purchases on your configured schedule",
            "4. Price alerts fire when assets hit your target levels",
            "5. Portfolio rebalancing is triggered when allocations drift >5%",
            "6. Monthly crypto portfolio report covers P&L and tax lots",
        ],
        "useCases": [
            "Automate dollar-cost averaging into Bitcoin and Ethereum",
            "Set price alerts for any crypto asset and get instant notifications",
            "Rebalance crypto portfolio automatically to target allocations",
            "Generate tax reports with cost basis for each lot",
            "Monitor portfolio performance against BTC benchmark",
        ],
    },
    "polygon-beast": {
        "workflowSteps": [
            "1. Connect Polygon.io via API key",
            "2. Configure watchlists, technical indicators, and alert thresholds",
            "3. Beast streams real-time quotes and calculates indicators",
            "4. Price and volume alerts fire instantly via Slack or email",
            "5. Options flow data is monitored for unusual activity",
            "6. Daily market summary covers your watchlist performance",
        ],
        "useCases": [
            "Get instant alerts when stocks in your watchlist hit price targets",
            "Monitor unusual options activity for potential trade signals",
            "Calculate technical indicators (RSI, MACD, Bollinger) in real-time",
            "Generate daily market briefings for your investment thesis",
            "Track earnings announcements and analyst upgrades/downgrades",
        ],
    },
    "datadog-beast": {
        "workflowSteps": [
            "1. Connect Datadog account via API key",
            "2. Beast monitors your dashboards, monitors, and log streams",
            "3. Alert storms are deduplicated and correlated into incidents",
            "4. On-call engineer is notified with full context and runbook links",
            "5. Incident timeline is built automatically from correlated events",
            "6. Post-mortem template is generated after incident resolution",
        ],
        "useCases": [
            "Deduplicate alert storms and route to the right on-call engineer",
            "Auto-generate incident timelines from correlated log events",
            "Monitor SLO burn rates and alert before SLA breach",
            "Generate post-mortem reports automatically after incidents",
            "Track deployment impact on key metrics in real-time",
        ],
    },
    "pagerduty-beast": {
        "workflowSteps": [
            "1. Connect PagerDuty via API key",
            "2. Beast monitors active incidents and escalation policies",
            "3. New incidents are triaged and enriched with runbook context",
            "4. Escalations are managed automatically if no acknowledgment",
            "5. Post-mortem is drafted from incident timeline and chat logs",
            "6. Weekly incident report covers MTTR, volume, and top causes",
        ],
        "useCases": [
            "Auto-enrich incidents with runbook links and past similar incidents",
            "Manage escalations when on-call doesn't acknowledge within SLA",
            "Generate post-mortem drafts from incident timelines",
            "Track MTTR trends and identify recurring incident patterns",
            "Sync PagerDuty incidents to Jira for engineering follow-up",
        ],
    },
    "cloudflare-beast": {
        "workflowSteps": [
            "1. Connect Cloudflare account via API token",
            "2. Beast monitors DNS health, WAF events, and DDoS attacks",
            "3. DDoS attacks trigger automatic mitigation rules",
            "4. DNS changes are validated and deployed with rollback capability",
            "5. Worker deployments are monitored for errors and performance",
            "6. Weekly security report covers WAF blocks and threat intelligence",
        ],
        "useCases": [
            "Auto-mitigate DDoS attacks with dynamic firewall rules",
            "Monitor DNS propagation after changes and alert on failures",
            "Deploy Cloudflare Workers with automated testing and rollback",
            "Generate weekly security posture reports for compliance",
            "Alert on SSL certificate expiry 30 days in advance",
        ],
    },
    "terraform-beast": {
        "workflowSteps": [
            "1. Connect Terraform Cloud or state backend via API token",
            "2. Beast monitors workspace runs, state changes, and drift",
            "3. New PRs trigger automated terraform plan with cost estimation",
            "4. Infrastructure drift is detected and reported daily",
            "5. Apply runs require approval and are logged for audit",
            "6. Monthly cost report covers resource changes and optimization",
        ],
        "useCases": [
            "Auto-run terraform plan on every infrastructure PR",
            "Detect and alert on infrastructure drift from desired state",
            "Estimate cost impact of infrastructure changes before applying",
            "Generate infrastructure change audit logs for compliance",
            "Identify unused resources and generate cleanup recommendations",
        ],
    },
    "kubernetes-beast": {
        "workflowSteps": [
            "1. Connect Kubernetes cluster via kubeconfig or service account",
            "2. Beast monitors pod health, resource usage, and events",
            "3. CrashLoopBackOff and OOMKilled pods trigger instant alerts",
            "4. Resource requests and limits are analyzed for right-sizing",
            "5. Deployments are monitored for rollout progress and failures",
            "6. Weekly cluster health report covers resource utilization and costs",
        ],
        "useCases": [
            "Alert instantly when pods enter CrashLoopBackOff state",
            "Right-size container resource requests based on actual usage",
            "Monitor deployment rollouts and auto-rollback on failure",
            "Identify and clean up unused namespaces and resources",
            "Generate weekly Kubernetes cost optimization reports",
        ],
    },
    "google-analytics-beast": {
        "workflowSteps": [
            "1. Connect Google Analytics 4 via OAuth",
            "2. Beast monitors traffic, conversions, and user behavior",
            "3. Traffic anomalies (spikes or drops) trigger instant alerts",
            "4. Conversion funnel drop-offs are identified and reported",
            "5. Weekly performance summary is sent to stakeholders",
            "6. Monthly SEO and traffic trend report is generated automatically",
        ],
        "useCases": [
            "Alert when organic traffic drops more than 20% week-over-week",
            "Identify conversion funnel drop-offs and prioritize fixes",
            "Generate weekly traffic reports for marketing stakeholders",
            "Monitor campaign performance and alert on underperforming ads",
            "Track goal completions and alert when targets are missed",
        ],
    },
    "mixpanel-beast": {
        "workflowSteps": [
            "1. Connect Mixpanel project via API key",
            "2. Beast monitors funnels, retention, and user segments",
            "3. Funnel drop-off changes trigger alerts for product team",
            "4. Retention cohorts are analyzed weekly for trends",
            "5. Power user segments are identified and exported to CRM",
            "6. Monthly product analytics report covers activation and retention",
        ],
        "useCases": [
            "Alert when a key funnel conversion rate drops significantly",
            "Identify power users and route them to sales for expansion",
            "Track feature adoption rates after each product release",
            "Generate monthly retention cohort reports for investors",
            "Detect churning users early and trigger re-engagement flows",
        ],
    },
    "amplitude-beast": {
        "workflowSteps": [
            "1. Connect Amplitude project via API key",
            "2. Beast monitors behavioral funnels, retention, and feature adoption",
            "3. Anomalies in key product metrics trigger instant alerts",
            "4. User paths are analyzed to identify friction and drop-off points",
            "5. A/B test results are monitored for statistical significance",
            "6. Weekly product health report is generated and sent to stakeholders",
        ],
        "useCases": [
            "Monitor feature adoption rates after every product release",
            "Identify the user paths that lead to highest retention",
            "Alert when A/B test reaches statistical significance",
            "Predict churn risk from behavioral signals in real-time",
            "Generate weekly product analytics reports for leadership",
        ],
    },
    "looker-beast": {
        "workflowSteps": [
            "1. Connect Looker instance via API credentials",
            "2. Beast monitors dashboard load times and query performance",
            "3. Scheduled reports are verified and delivered on time",
            "4. Data freshness is monitored and alerts fire on stale data",
            "5. Query cost analysis identifies expensive queries for optimization",
            "6. Weekly BI health report covers usage, performance, and errors",
        ],
        "useCases": [
            "Alert when scheduled Looker reports fail to deliver",
            "Monitor dashboard query performance and alert on regressions",
            "Identify and optimize expensive queries that slow dashboards",
            "Generate weekly BI platform usage reports for IT teams",
            "Verify data freshness and alert when ETL jobs fail",
        ],
    },
    "tableau-beast": {
        "workflowSteps": [
            "1. Connect Tableau Server or Cloud via API token",
            "2. Beast monitors workbook performance and data source freshness",
            "3. Extract refresh failures trigger instant alerts to data team",
            "4. Slow workbooks are identified and optimization tips are provided",
            "5. Published dashboards are tested for broken views automatically",
            "6. Monthly Tableau usage report covers views, users, and performance",
        ],
        "useCases": [
            "Alert when Tableau extract refresh jobs fail",
            "Monitor workbook load times and alert on performance regressions",
            "Identify unused workbooks and data sources for cleanup",
            "Generate monthly Tableau adoption reports for IT governance",
            "Verify published dashboards are accessible after deployments",
        ],
    },
    "dbt-beast": {
        "workflowSteps": [
            "1. Connect dbt Cloud or Core via API key",
            "2. Beast monitors job runs, test failures, and model performance",
            "3. Failed dbt tests trigger alerts with failing row samples",
            "4. Model run times are tracked and regressions are flagged",
            "5. Data lineage is visualized and documented automatically",
            "6. Weekly data quality report covers test pass rates and freshness",
        ],
        "useCases": [
            "Alert when dbt tests fail with sample failing rows for debugging",
            "Monitor model run times and alert on performance regressions",
            "Generate data lineage documentation automatically",
            "Track data freshness SLAs across all critical models",
            "Generate weekly data quality reports for data governance",
        ],
    },
    "zapier-beast": {
        "workflowSteps": [
            "1. Connect Zapier account via API key",
            "2. Beast monitors Zap run history and error rates",
            "3. Failed Zaps trigger alerts with error context and retry options",
            "4. High-volume Zaps are analyzed for optimization opportunities",
            "5. Task usage is monitored against your plan limits",
            "6. Weekly automation report covers runs, errors, and task usage",
        ],
        "useCases": [
            "Alert when critical Zaps fail and auto-retry with context",
            "Monitor task usage and alert before plan limits are hit",
            "Identify and optimize high-cost Zaps to reduce task consumption",
            "Generate weekly automation health reports for operations teams",
            "Discover redundant Zaps that can be consolidated",
        ],
    },
    "make-beast": {
        "workflowSteps": [
            "1. Connect Make (Integromat) account via API key",
            "2. Beast monitors scenario runs, errors, and data consumption",
            "3. Failed scenarios trigger alerts with error details and module context",
            "4. Data usage is tracked against your plan limits",
            "5. Slow scenarios are identified and optimization tips are provided",
            "6. Weekly automation report covers runs, errors, and operations used",
        ],
        "useCases": [
            "Alert when Make scenarios fail with detailed error context",
            "Monitor operations usage and alert before plan limits are hit",
            "Identify bottleneck modules that slow down scenario execution",
            "Generate weekly automation performance reports",
            "Discover and consolidate redundant scenarios across your account",
        ],
    },
    "n8n-beast": {
        "workflowSteps": [
            "1. Connect n8n instance via API key",
            "2. Beast monitors workflow executions, errors, and queue depth",
            "3. Failed executions trigger alerts with node-level error context",
            "4. Queue depth spikes indicate bottlenecks and trigger scaling alerts",
            "5. Workflow performance is benchmarked and regressions are flagged",
            "6. Weekly execution report covers success rates and error patterns",
        ],
        "useCases": [
            "Alert when n8n workflows fail with node-level error details",
            "Monitor queue depth and scale workers when backlogs build up",
            "Track workflow execution times and alert on regressions",
            "Generate weekly automation health reports for DevOps teams",
            "Identify and fix the most common workflow failure patterns",
        ],
    },
    "figma-beast": {
        "workflowSteps": [
            "1. Connect Figma account via OAuth",
            "2. Beast monitors design files for changes and version updates",
            "3. New component versions trigger notifications to developers",
            "4. Design tokens are extracted and synced to your codebase",
            "5. Handoff specs are generated automatically for new frames",
            "6. Weekly design system health report covers component usage",
        ],
        "useCases": [
            "Notify developers when design components are updated in Figma",
            "Extract and sync design tokens to your CSS/Tailwind config",
            "Generate developer handoff specs automatically from frames",
            "Track design system adoption across all product files",
            "Alert when production UI diverges from Figma designs",
        ],
    },
    "posthog-beast": {
        "workflowSteps": [
            "1. Connect PostHog project via API key",
            "2. Beast monitors feature flag rollouts and experiment results",
            "3. Experiment results are analyzed for statistical significance",
            "4. Feature flags are managed and rolled out on schedule",
            "5. Session recordings are analyzed for UX friction patterns",
            "6. Weekly product analytics report covers events and experiments",
        ],
        "useCases": [
            "Monitor A/B experiment results and alert on significance",
            "Manage feature flag rollouts with automated gradual releases",
            "Identify UX friction from session recording analysis",
            "Alert when error rates spike after a feature flag is enabled",
            "Generate weekly product analytics reports for product teams",
        ],
    },
    "redis-beast": {
        "workflowSteps": [
            "1. Connect Redis instance via connection string",
            "2. Beast monitors memory usage, hit rates, and eviction rates",
            "3. Memory pressure triggers alerts before OOM conditions",
            "4. Slow commands are identified and optimization tips are provided",
            "5. Key expiry patterns are analyzed for TTL optimization",
            "6. Weekly Redis health report covers performance and memory trends",
        ],
        "useCases": [
            "Alert when Redis memory usage exceeds 80% of available RAM",
            "Identify slow commands that impact application performance",
            "Monitor cache hit rates and alert on significant drops",
            "Optimize TTL settings based on key access patterns",
            "Generate weekly Redis performance reports for infrastructure teams",
        ],
    },
    "supabase-beast": {
        "workflowSteps": [
            "1. Connect Supabase project via API key",
            "2. Beast monitors database performance, auth, and storage",
            "3. Slow queries are detected and index recommendations are generated",
            "4. Auth errors and rate limit hits trigger instant alerts",
            "5. Storage usage is monitored and cleanup recommendations are made",
            "6. Weekly project health report covers all Supabase services",
        ],
        "useCases": [
            "Get index recommendations based on slow query patterns",
            "Alert when auth error rates spike (potential attack)",
            "Monitor database connection pool and alert on exhaustion",
            "Track storage usage and alert before limits are reached",
            "Generate weekly Supabase project health reports",
        ],
    },
    "resend-beast": {
        "workflowSteps": [
            "1. Connect Resend account via API key",
            "2. Beast monitors email delivery rates, bounces, and complaints",
            "3. Delivery failures trigger alerts with recipient and error context",
            "4. Bounce rate spikes trigger automatic list cleaning",
            "5. Email templates are versioned and tested before deployment",
            "6. Weekly deliverability report covers inbox placement and reputation",
        ],
        "useCases": [
            "Alert when transactional email delivery rates drop below 98%",
            "Auto-clean bounce lists before they damage sender reputation",
            "Monitor complaint rates and identify problematic email content",
            "Version and A/B test email templates before production deployment",
            "Generate weekly email deliverability reports for engineering teams",
        ],
    },
    "linear-pro-beast": {
        "workflowSteps": [
            "1. Connect Linear workspace via OAuth",
            "2. Beast monitors all projects, cycles, and team velocity",
            "3. Cycle planning is assisted with AI-powered effort estimation",
            "4. Blocked issues are detected and escalated automatically",
            "5. Engineering metrics (velocity, cycle time) are tracked weekly",
            "6. Quarterly roadmap report is generated from completed cycles",
        ],
        "useCases": [
            "Auto-estimate issue effort based on similar past issues",
            "Generate sprint planning recommendations from team velocity",
            "Detect and escalate blocked issues before they miss deadlines",
            "Create quarterly engineering roadmap reports from cycle data",
            "Sync Linear milestones to stakeholder-facing project trackers",
        ],
    },
    "claude-beast": {
        "workflowSteps": [
            "1. Connect Anthropic Claude via API key",
            "2. Configure model version (Sonnet/Opus), system prompt, and context",
            "3. Beast routes tasks requiring deep reasoning to Claude Opus",
            "4. Long documents (up to 200K tokens) are processed in single requests",
            "5. Responses are streamed and cached for performance",
            "6. Usage and cost are tracked per task type and team member",
        ],
        "useCases": [
            "Analyze entire legal contracts or technical specifications in one pass",
            "Generate comprehensive code reviews with security analysis",
            "Build AI assistants with nuanced, safety-conscious responses",
            "Process and summarize large datasets of customer feedback",
            "Create detailed competitive analysis reports from multiple sources",
        ],
    },
    "cohere-beast": {
        "workflowSteps": [
            "1. Connect Cohere via API key",
            "2. Configure embedding model and classification endpoints",
            "3. Beast embeds your documents for semantic search",
            "4. Classification models are trained on your labeled data",
            "5. Rerank API improves search result quality automatically",
            "6. Usage and latency are monitored per endpoint",
        ],
        "useCases": [
            "Build semantic search over your product catalog or knowledge base",
            "Classify customer support tickets by topic and urgency",
            "Improve search result relevance with Cohere's reranking API",
            "Generate embeddings for recommendation systems",
            "Train custom text classifiers on your domain-specific data",
        ],
    },
    "brex-beast": {
        "workflowSteps": [
            "1. Connect Brex account via OAuth",
            "2. Beast monitors card transactions, budgets, and expense reports",
            "3. Transactions are auto-categorized and matched to receipts",
            "4. Budget overages trigger alerts to the budget owner",
            "5. Expense reports are auto-generated from categorized transactions",
            "6. Monthly spend analysis covers categories, vendors, and trends",
        ],
        "useCases": [
            "Auto-categorize all Brex transactions and match receipts",
            "Alert budget owners when team spending exceeds limits",
            "Generate automated expense reports for accounting",
            "Identify recurring vendor charges for contract review",
            "Generate monthly spend analysis reports for finance teams",
        ],
    },
    "plaid-connect-beast": {
        "workflowSteps": [
            "1. Connect bank accounts via Plaid Link OAuth",
            "2. Beast syncs transactions from all connected accounts daily",
            "3. Cash flow is analyzed and runway is calculated automatically",
            "4. Unusual transactions are flagged for review",
            "5. Budget categories are tracked and alerts fire on overages",
            "6. Monthly financial health report covers cash flow and trends",
        ],
        "useCases": [
            "Track business cash flow across multiple bank accounts",
            "Alert when cash runway drops below 90 days",
            "Detect unusual or potentially fraudulent transactions",
            "Generate monthly cash flow reports for investors and board",
            "Monitor budget categories and alert on overspending",
        ],
    },
    "twitch-beast": {
        "workflowSteps": [
            "1. Connect Twitch account via OAuth",
            "2. Beast monitors stream health, viewer count, and chat activity",
            "3. Chat moderation rules are enforced automatically",
            "4. Stream highlights are clipped based on viewer reaction spikes",
            "5. Subscriber milestones trigger automated celebrations",
            "6. Weekly stream analytics report covers viewership and growth",
        ],
        "useCases": [
            "Auto-moderate Twitch chat and ban toxic users",
            "Create stream highlights automatically from peak engagement moments",
            "Alert when stream goes offline unexpectedly",
            "Track subscriber growth and alert on milestone achievements",
            "Generate weekly streaming analytics reports for sponsors",
        ],
    },
    "discord-pro-beast": {
        "workflowSteps": [
            "1. Add Discord Pro Beast to your server via OAuth bot invite",
            "2. Configure advanced moderation rules, role hierarchies, and automations",
            "3. Beast monitors all channels with ML-powered moderation",
            "4. Role assignments are automated based on activity and verification",
            "5. Community events are announced and tracked automatically",
            "6. Monthly community health report covers growth and engagement",
        ],
        "useCases": [
            "Run advanced ML-powered moderation across large Discord servers",
            "Automate role assignments based on member activity levels",
            "Manage community events with automated announcements and RSVPs",
            "Generate monthly community growth and engagement reports",
            "Sync Discord membership with external platforms (Patreon, Memberful)",
        ],
    },
    "segment-beast": {
        "workflowSteps": [
            "1. Connect Segment workspace via API key",
            "2. Beast monitors event volume, schema violations, and destination health",
            "3. Schema violations trigger alerts before they break downstream tools",
            "4. Destination failures are detected and retried automatically",
            "5. Event volume anomalies indicate tracking issues or bugs",
            "6. Weekly data quality report covers schema health and destination status",
        ],
        "useCases": [
            "Alert on schema violations before they break analytics dashboards",
            "Monitor destination health and retry failed event deliveries",
            "Detect tracking gaps when event volume drops unexpectedly",
            "Generate weekly data quality reports for data engineering teams",
            "Validate new event schemas before deploying to production",
        ],
    },
    "webflow-beast": {
        "workflowSteps": [
            "1. Connect Webflow site via OAuth",
            "2. Beast monitors CMS content, form submissions, and deployments",
            "3. New form submissions trigger notifications and CRM sync",
            "4. CMS content is updated automatically from connected data sources",
            "5. Site deployments are monitored for errors and performance",
            "6. Weekly site analytics report covers traffic and form conversions",
        ],
        "useCases": [
            "Sync Webflow form submissions to HubSpot or Airtable automatically",
            "Update Webflow CMS content from Google Sheets or Airtable",
            "Alert when Webflow site deployments fail or cause errors",
            "Monitor site performance and alert on Core Web Vitals regressions",
            "Generate weekly website analytics reports for marketing teams",
        ],
    },
}

def main():
    with open('/home/ubuntu/beast-bots/shared/agents.ts', 'r') as f:
        content = f.read()

    # For each agent, find its actions line and inject workflowSteps + useCases after it
    for slug, data in ENRICHMENTS.items():
        # Skip if already has workflowSteps
        if f'slug: "{slug}"' in content:
            # Check if this agent already has workflowSteps
            slug_pos = content.find(f'slug: "{slug}"')
            # Find the next agent's slug or end of array
            next_slug_pos = content.find('    slug: "', slug_pos + 1)
            agent_block = content[slug_pos:next_slug_pos if next_slug_pos > 0 else len(content)]
            
            if 'workflowSteps:' in agent_block:
                print(f"  SKIP {slug} (already has workflowSteps)")
                continue
            
            # Find the actions line within this agent block
            actions_pattern = f'    actions: ['
            actions_pos = content.find(actions_pattern, slug_pos)
            if actions_pos == -1 or (next_slug_pos > 0 and actions_pos > next_slug_pos):
                print(f"  WARN {slug}: actions not found")
                continue
            
            # Find the end of the actions line (the closing ],)
            actions_end = content.find('],\n', actions_pos)
            if actions_end == -1:
                print(f"  WARN {slug}: actions end not found")
                continue
            actions_end += 3  # include ],\n
            
            # Build the injection string
            steps = data['workflowSteps']
            cases = data['useCases']
            
            steps_str = '[\n' + ''.join(f'      "{s}",\n' for s in steps) + '    ]'
            cases_str = '[\n' + ''.join(f'      "{c}",\n' for c in cases) + '    ]'
            
            injection = f'    workflowSteps: {steps_str},\n    useCases: {cases_str},\n'
            
            content = content[:actions_end] + injection + content[actions_end:]
            print(f"  OK  {slug}")
        else:
            print(f"  MISS {slug}: slug not found in file")

    with open('/home/ubuntu/beast-bots/shared/agents.ts', 'w') as f:
        f.write(content)
    
    print("\nDone! Verifying...")
    with open('/home/ubuntu/beast-bots/shared/agents.ts', 'r') as f:
        final = f.read()
    count = final.count('workflowSteps:')
    print(f"Total agents with workflowSteps: {count}")

if __name__ == '__main__':
    main()
