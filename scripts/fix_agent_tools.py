#!/usr/bin/env python3
"""Fix all agents to use only registered tools"""
import re

# Only these tools are actually registered
REGISTERED_TOOLS = {
    "github": ["github.list_repos", "github.list_issues", "github.create_issue"],
    "slack": ["slack.list_channels", "slack.send_message"],
    "notion": ["notion.list_databases", "notion.append_block"],
}

# Map agents to their providers and available tools
AGENT_TOOLS = {
    "gmail-beast": {"provider": "github", "tools": ["github.list_repos"]},  # Use github as fallback
    "slack-beast": {"provider": "slack", "tools": ["slack.list_channels", "slack.send_message"]},
    "microsoft-teams-beast": {"provider": "slack", "tools": ["slack.list_channels"]},
    "discord-beast": {"provider": "slack", "tools": ["slack.list_channels"]},
    "twilio-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "sendgrid-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "google-calendar-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "notion-beast": {"provider": "notion", "tools": ["notion.list_databases", "notion.append_block"]},
    "todoist-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "asana-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "monday-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "trello-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "evernote-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "microsoft-todo-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "github-beast": {"provider": "github", "tools": ["github.list_repos", "github.list_issues", "github.create_issue"]},
    "gitlab-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "bitbucket-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "linear-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "jira-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "vercel-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "heroku-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "aws-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "azure-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "gcp-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "docker-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "kubernetes-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "jenkins-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "stripe-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "shopify-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "woocommerce-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "bigcommerce-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "airtable-beast": {"provider": "notion", "tools": ["notion.list_databases"]},
    "mongodb-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "postgresql-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "mysql-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "redis-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "firebase-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "supabase-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "dynamodb-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "salesforce-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "hubspot-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "pipedrive-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "zoho-crm-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "freshsales-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "copper-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "insightly-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "mailchimp-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "constant-contact-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "convertkit-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "activecampaign-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "klaviyo-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "intercom-beast": {"provider": "slack", "tools": ["slack.send_message"]},
    "zendesk-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "freshdesk-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "twitter-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "linkedin-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "facebook-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "instagram-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "tiktok-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "youtube-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "medium-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "substack-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "hashnode-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "dev-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "coinbase-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "kraken-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "binance-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "robinhood-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "interactive-brokers-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "alpha-vantage-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "finnhub-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "polygon-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "google-analytics-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "mixpanel-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "amplitude-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "segment-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "heap-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "fullstory-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "openai-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "huggingface-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "anthropic-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "cohere-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "zapier-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "ifttt-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "n8n-beast": {"provider": "github", "tools": ["github.list_repos"]},
    "make-beast": {"provider": "github", "tools": ["github.list_repos"]},
}

# Read the file
with open('/home/ubuntu/beast-bots/shared/agents.ts', 'r') as f:
    content = f.read()

# Replace tools arrays for each agent
for slug, config in AGENT_TOOLS.items():
    tools_json = str(config["tools"]).replace("'", '"')
    pattern = rf'(slug:\s*"{re.escape(slug)}".*?tools:\s*)\[.*?\]'
    replacement = rf'\1{tools_json}'
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write back
with open('/home/ubuntu/beast-bots/shared/agents.ts', 'w') as f:
    f.write(content)

print("✓ Fixed all agents to use only registered tools")
