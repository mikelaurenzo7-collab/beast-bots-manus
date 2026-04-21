#!/usr/bin/env python3
"""Enrich the 10 remaining agents that were missed in the first pass."""

ENRICHMENTS = {
    "outlook-beast": {
        "workflowSteps": [
            "1. Connect Microsoft 365 account via OAuth",
            "2. Beast monitors your Outlook inbox for new emails and calendar events",
            "3. AI classifies emails by priority, sender type, and required action",
            "4. Meeting requests are analyzed and conflicts are flagged",
            "5. Smart replies are drafted for routine emails",
            "6. Daily briefing summarizes unread emails and today's calendar",
        ],
        "useCases": [
            "Get AI-drafted replies for routine emails in your Outlook inbox",
            "Receive a daily briefing of unread emails and calendar events",
            "Auto-flag emails from VIP senders for immediate attention",
            "Sync Outlook calendar events to Google Calendar bidirectionally",
            "Generate weekly email volume and response time reports",
        ],
    },
    "twilio-beast": {
        "workflowSteps": [
            "1. Connect Twilio account via API key and Auth Token",
            "2. Configure phone numbers, messaging services, and webhooks",
            "3. Beast monitors SMS delivery rates, call logs, and error rates",
            "4. Failed message deliveries trigger retry logic automatically",
            "5. Inbound messages are classified and routed to the right handler",
            "6. Monthly usage report covers messages sent, calls made, and costs",
        ],
        "useCases": [
            "Send automated SMS notifications for order confirmations and alerts",
            "Build two-way SMS workflows for customer support",
            "Monitor Twilio costs and alert when usage exceeds budget",
            "Route inbound calls to the right team based on IVR responses",
            "Generate monthly communication analytics reports",
        ],
    },
    "trello-beast": {
        "workflowSteps": [
            "1. Connect Trello account via OAuth",
            "2. Beast monitors boards for card movements, due dates, and comments",
            "3. Overdue cards trigger reminders to assigned members",
            "4. Card movements between lists trigger downstream automations",
            "5. Weekly board summary is posted to the team Slack channel",
            "6. Monthly project completion report covers velocity and blockers",
        ],
        "useCases": [
            "Get reminders when Trello cards are approaching their due dates",
            "Trigger Slack notifications when cards move to Done",
            "Auto-create cards from email subjects or Slack messages",
            "Generate weekly project status reports from board activity",
            "Sync Trello cards to Linear or Jira for engineering teams",
        ],
    },
    "google-drive-beast": {
        "workflowSteps": [
            "1. Connect Google Drive via OAuth",
            "2. Beast monitors shared drives for new files and permission changes",
            "3. New files are auto-tagged and organized by type and project",
            "4. Permission changes to sensitive files trigger security alerts",
            "5. Large files are flagged for cleanup or archival",
            "6. Weekly storage report covers usage trends and shared file activity",
        ],
        "useCases": [
            "Alert when sensitive Drive files are shared externally",
            "Auto-organize uploaded files into project folders by type",
            "Monitor storage usage and alert before limits are reached",
            "Generate weekly file activity reports for team leads",
            "Sync Drive documents to Notion or Confluence automatically",
        ],
    },
    "snowflake-beast": {
        "workflowSteps": [
            "1. Connect Snowflake account via API credentials",
            "2. Beast monitors query performance, credit usage, and warehouse health",
            "3. Long-running queries trigger alerts with optimization suggestions",
            "4. Credit consumption is tracked against budget limits",
            "5. Data freshness SLAs are monitored across all critical tables",
            "6. Weekly cost and performance report covers top queries and warehouses",
        ],
        "useCases": [
            "Alert when Snowflake credit consumption exceeds daily budget",
            "Identify and optimize the most expensive queries in your account",
            "Monitor data freshness and alert when ETL jobs fail",
            "Generate weekly cost optimization reports for data engineering",
            "Track warehouse utilization and right-size for cost savings",
        ],
    },
    "apollo-beast": {
        "workflowSteps": [
            "1. Connect Apollo.io via API key",
            "2. Configure ICP filters: industry, company size, job title, tech stack",
            "3. Beast searches Apollo's database for matching prospects daily",
            "4. New prospects are enriched with contact data and LinkedIn profiles",
            "5. Prospects are exported to HubSpot or Salesforce automatically",
            "6. Weekly prospecting report covers new contacts found and enrichment quality",
        ],
        "useCases": [
            "Auto-find and enrich prospects matching your ICP every day",
            "Sync new Apollo contacts to HubSpot for immediate outreach",
            "Identify decision-makers at target accounts using AI filters",
            "Generate weekly lead generation reports for sales leadership",
            "Monitor contact data quality and flag outdated records",
        ],
    },
    "google-ads-beast": {
        "workflowSteps": [
            "1. Connect Google Ads account via OAuth",
            "2. Beast monitors campaign performance, Quality Scores, and budgets",
            "3. Underperforming keywords are flagged with pause recommendations",
            "4. Budget pacing is monitored and alerts fire on overspend risk",
            "5. Negative keyword suggestions are generated from search term reports",
            "6. Weekly PPC performance report covers ROAS, CPA, and conversion trends",
        ],
        "useCases": [
            "Alert when Google Ads budget is on track to overspend",
            "Identify underperforming keywords and get pause recommendations",
            "Generate negative keyword lists from search term reports",
            "Monitor Quality Scores and get ad copy improvement suggestions",
            "Generate weekly PPC performance reports for marketing teams",
        ],
    },
    "semrush-beast": {
        "workflowSteps": [
            "1. Connect SEMrush via API key",
            "2. Configure tracked keywords, competitors, and site audit schedule",
            "3. Beast monitors keyword rankings and alerts on significant changes",
            "4. Competitor ranking changes are tracked and reported weekly",
            "5. Site audit results are analyzed and prioritized action items are generated",
            "6. Monthly SEO performance report covers rankings, traffic, and backlinks",
        ],
        "useCases": [
            "Alert when target keywords drop more than 5 positions",
            "Monitor competitor rankings and alert on new content opportunities",
            "Generate prioritized SEO action items from site audit results",
            "Track backlink profile changes and alert on lost links",
            "Generate monthly SEO performance reports for clients",
        ],
    },
    "weather-beast": {
        "workflowSteps": [
            "1. Connect Weather API via API key",
            "2. Configure locations, alert thresholds, and notification preferences",
            "3. Beast monitors real-time weather conditions for your locations",
            "4. Severe weather alerts trigger immediate notifications",
            "5. Weather forecasts are integrated into scheduling and logistics workflows",
            "6. Historical weather data is used for demand forecasting and planning",
        ],
        "useCases": [
            "Alert field teams when severe weather is forecast for their location",
            "Adjust delivery routes based on weather conditions automatically",
            "Integrate weather data into demand forecasting for retail",
            "Send weather-based push notifications for outdoor event apps",
            "Generate weather impact reports for insurance and logistics",
        ],
    },
    "news-beast": {
        "workflowSteps": [
            "1. Connect News API via API key",
            "2. Configure topics, sources, keywords, and sentiment filters",
            "3. Beast monitors news feeds in real-time for matching stories",
            "4. Relevant articles are summarized and classified by topic",
            "5. Daily briefing is compiled and delivered to your inbox or Slack",
            "6. Trending topics in your industry are surfaced for content planning",
        ],
        "useCases": [
            "Get a daily AI-curated news briefing on your industry topics",
            "Monitor brand mentions in news and alert on negative coverage",
            "Track competitor news and surface strategic intelligence",
            "Generate content ideas from trending industry news",
            "Monitor regulatory news relevant to your business automatically",
        ],
    },
}

def main():
    with open('/home/ubuntu/beast-bots/shared/agents.ts', 'r') as f:
        content = f.read()

    for slug, data in ENRICHMENTS.items():
        if f'slug: "{slug}"' not in content:
            print(f"  MISS {slug}: not found")
            continue
        
        slug_pos = content.find(f'slug: "{slug}"')
        next_slug_pos = content.find('    slug: "', slug_pos + 1)
        agent_block = content[slug_pos:next_slug_pos if next_slug_pos > 0 else len(content)]
        
        if 'workflowSteps:' in agent_block:
            print(f"  SKIP {slug}")
            continue
        
        actions_pos = content.find('    actions: [', slug_pos)
        if actions_pos == -1 or (next_slug_pos > 0 and actions_pos > next_slug_pos):
            print(f"  WARN {slug}: actions not found")
            continue
        
        actions_end = content.find('],\n', actions_pos)
        if actions_end == -1:
            print(f"  WARN {slug}: actions end not found")
            continue
        actions_end += 3
        
        steps = data['workflowSteps']
        cases = data['useCases']
        steps_str = '[\n' + ''.join(f'      "{s}",\n' for s in steps) + '    ]'
        cases_str = '[\n' + ''.join(f'      "{c}",\n' for c in cases) + '    ]'
        injection = f'    workflowSteps: {steps_str},\n    useCases: {cases_str},\n'
        
        content = content[:actions_end] + injection + content[actions_end:]
        print(f"  OK  {slug}")

    with open('/home/ubuntu/beast-bots/shared/agents.ts', 'w') as f:
        f.write(content)
    
    count = content.count('workflowSteps:')
    print(f"\nTotal agents with workflowSteps: {count}/80")

if __name__ == '__main__':
    main()
