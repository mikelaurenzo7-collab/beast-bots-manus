#!/usr/bin/env python3
"""Add systemPrompt and tools fields to all agents in agents.ts"""
import re
import json

# Read the agents file
with open('/home/ubuntu/beast-bots/shared/agents.ts', 'r') as f:
    content = f.read()

# Define system prompts and tools for each agent based on their slug and platform
agent_configs = {
    "gmail-beast": {
        "tools": ["gmail.list_messages", "gmail.send_message", "gmail.create_draft"],
        "systemPrompt": "You are Gmail Beast, an AI assistant for email management. You have tools to read, send, and draft emails. Always confirm recipient addresses before sending. Help users organize, summarize, and respond to emails efficiently."
    },
    "slack-beast": {
        "tools": ["slack.list_channels", "slack.send_message", "slack.get_channel_info"],
        "systemPrompt": "You are Slack Beast, a sharp assistant for Slack workspaces. You have tools for listing channels and posting messages. Always confirm the target channel before sending messages. Use slack.list_channels first if the user referenced a channel by name."
    },
    "github-beast": {
        "tools": ["github.list_repos", "github.create_issue", "github.list_issues"],
        "systemPrompt": "You are GitHub Beast, a developer assistant. You have tools to browse repositories, create issues, and manage projects. Help developers automate workflows and stay on top of their codebase."
    },
    "google-calendar-beast": {
        "tools": ["calendar.list_events", "calendar.create_event"],
        "systemPrompt": "You are Calendar Beast, an AI scheduling assistant. Help users manage their calendar, find meeting times, and optimize their schedule for focus and productivity."
    },
    "notion-beast": {
        "tools": ["notion.query_database", "notion.create_page"],
        "systemPrompt": "You are Notion Beast, a knowledge management assistant. Help users organize information, create databases, and build personal knowledge systems in Notion."
    },
    "linear-beast": {
        "tools": ["linear.list_issues", "linear.create_issue"],
        "systemPrompt": "You are Linear Beast, a project management assistant. Help teams track issues, manage sprints, and stay organized with Linear."
    },
    "asana-beast": {
        "tools": ["asana.list_tasks", "asana.create_task"],
        "systemPrompt": "You are Asana Beast, a task management assistant. Help teams organize work, track progress, and collaborate on projects in Asana."
    },
    "monday-beast": {
        "tools": ["monday.query_boards", "monday.create_item"],
        "systemPrompt": "You are Monday Beast, a workflow automation assistant. Help teams build and manage their work processes on monday.com."
    },
    "stripe-beast": {
        "tools": ["stripe.list_customers", "stripe.create_charge"],
        "systemPrompt": "You are Stripe Beast, a payment processing assistant. Help businesses manage customers, process payments, and handle billing with Stripe."
    },
    "shopify-beast": {
        "tools": ["shopify.list_products", "shopify.create_order"],
        "systemPrompt": "You are Shopify Beast, an e-commerce assistant. Help store owners manage products, process orders, and grow their business on Shopify."
    },
    "twilio-beast": {
        "tools": ["twilio.send_sms", "twilio.send_email"],
        "systemPrompt": "You are Twilio Beast, a communication assistant. Help businesses send SMS, emails, and voice messages at scale with Twilio."
    },
    "sendgrid-beast": {
        "tools": ["sendgrid.send_email", "sendgrid.list_contacts"],
        "systemPrompt": "You are SendGrid Beast, an email marketing assistant. Help businesses build and manage email campaigns with SendGrid."
    },
}

# Default config for agents not explicitly defined
def get_default_config(slug, platform, category):
    tools = []
    if "github" in slug or platform == "GitHub":
        tools = ["github.list_repos", "github.create_issue"]
    elif "slack" in slug or platform == "Slack":
        tools = ["slack.list_channels", "slack.send_message"]
    elif "gmail" in slug or platform == "Gmail":
        tools = ["gmail.list_messages", "gmail.send_message"]
    elif "calendar" in slug or platform == "Google Calendar":
        tools = ["calendar.list_events", "calendar.create_event"]
    elif "notion" in slug or platform == "Notion":
        tools = ["notion.query_database", "notion.create_page"]
    elif "stripe" in slug or platform == "Stripe":
        tools = ["stripe.list_customers", "stripe.create_charge"]
    elif "shopify" in slug or platform == "Shopify":
        tools = ["shopify.list_products", "shopify.create_order"]
    else:
        # Generic tools based on category
        if category == "Communication":
            tools = ["email.send", "chat.send_message"]
        elif category == "Productivity":
            tools = ["task.create", "task.list"]
        elif category == "Development":
            tools = ["repo.list", "issue.create"]
        else:
            tools = ["api.query", "api.mutate"]
    
    systemPrompt = f"You are {slug.replace('-', ' ').title()}, an AI assistant for {platform}. Help users accomplish their goals efficiently and effectively."
    
    return {"tools": tools, "systemPrompt": systemPrompt}

# Find all agent objects and add runtime fields if missing
def add_runtime_fields(content):
    # Split by agent objects
    lines = content.split('\n')
    result = []
    in_agent = False
    agent_depth = 0
    current_agent = []
    agent_slug = None
    agent_platform = None
    agent_category = None
    has_system_prompt = False
    has_tools = False
    
    for i, line in enumerate(lines):
        # Detect agent start
        if re.match(r'\s*\{\s*$', line) and i > 50:  # Skip early braces
            in_agent = True
            agent_depth = 1
            current_agent = [line]
            has_system_prompt = False
            has_tools = False
            continue
        
        if in_agent:
            current_agent.append(line)
            
            # Track braces
            agent_depth += line.count('{') - line.count('}')
            
            # Extract metadata
            if 'slug:' in line:
                match = re.search(r'slug:\s*"([^"]+)"', line)
                if match:
                    agent_slug = match.group(1)
            if 'platform:' in line:
                match = re.search(r'platform:\s*"([^"]+)"', line)
                if match:
                    agent_platform = match.group(1)
            if 'category:' in line:
                match = re.search(r'category:\s*"([^"]+)"', line)
                if match:
                    agent_category = match.group(1)
            if 'systemPrompt:' in line:
                has_system_prompt = True
            if 'tools:' in line:
                has_tools = True
            
            # Agent end
            if agent_depth == 0 and line.strip().startswith('},'):
                in_agent = False
                
                # Add missing fields before closing brace
                if agent_slug and (not has_system_prompt or not has_tools):
                    config = agent_configs.get(agent_slug)
                    if not config:
                        config = get_default_config(agent_slug, agent_platform or '', agent_category or '')
                    
                    # Insert before the closing brace
                    insert_idx = len(current_agent) - 1
                    
                    if not has_tools:
                        tools_str = json.dumps(config["tools"])
                        current_agent.insert(insert_idx, f'  tools: {tools_str},')
                    
                    if not has_system_prompt:
                        prompt = config["systemPrompt"].replace('"', '\\"')
                        current_agent.insert(insert_idx, f'  systemPrompt: "{prompt}",')
                
                result.extend(current_agent)
                current_agent = []
                agent_slug = None
                agent_platform = None
                agent_category = None
                continue
        
        result.append(line)
    
    return '\n'.join(result)

# Apply the transformation
new_content = add_runtime_fields(content)

# Write back
with open('/home/ubuntu/beast-bots/shared/agents.ts', 'w') as f:
    f.write(new_content)

print("✓ Added systemPrompt and tools to all agents")
