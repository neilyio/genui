#!/usr/bin/env fish

# ---------------------------------------------------------
# A Multi-Agent System Example using OpenAI Structured Outputs
# ---------------------------------------------------------
#
# This script:
#  1. Reads a user prompt from the command line argument
#  2. Sends it to a Triage Agent
#  3. Parses the function calls (tools) from the Triage Agent response
#  4. Calls specialized agents (Data Processing / Analysis / Visualization)
#  5. Prints final results
#
# Dependencies:
#   - fish shell (macOS)
#   - jq (for JSON parsing)
#   - OPENAI_API_KEY (environment variable)
#
# Usage:
#   ./multi_agent_system.fish "Some user prompt"
#
# Adjust the system prompts, function schemas, etc. as needed.

if test (count $argv) -lt 1
    echo "Usage: ./multi_agent_system.fish \"Your user prompt...\""
    exit 1
end

set USER_PROMPT $argv[1]

# Make sure OPENAI_API_KEY is set
if test -z "$OPENAI_API_KEY"
    echo "Error: OPENAI_API_KEY environment variable is not set."
    exit 1
end

# Model name
set MODEL gpt-4o-2024-08-06

# ---------------
# SYSTEM PROMPTS
# ---------------
set TRIAGING_SYSTEM_PROMPT "You are a Triaging Agent. Your role is to assess the user's query and route it to the relevant agents. The agents available are:
- Data Processing Agent: Cleans, transforms, and aggregates data.
- Analysis Agent: Performs statistical, correlation, and regression analysis.
- Visualization Agent: Creates bar charts, line charts, and pie charts.

Use the send_query_to_agents tool to forward the user's query to the relevant agents. Also, use the speak_to_user tool to get more information from the user if needed."

set PROCESSING_SYSTEM_PROMPT "You are a Data Processing Agent. Your role is to clean, transform, and aggregate data using the following tools:
- clean_data
- transform_data
- aggregate_data"

set ANALYSIS_SYSTEM_PROMPT "You are an Analysis Agent. Your role is to perform statistical, correlation, and regression analysis using the following tools:
- stat_analysis
- correlation_analysis
- regression_analysis"

set VISUALIZATION_SYSTEM_PROMPT "You are a Visualization Agent. Your role is to create bar charts, line charts, and pie charts using the following tools:
- create_bar_chart
- create_line_chart
- create_pie_chart"

# --------------------------------
# 1) CREATE TRIAGE REQUEST PAYLOAD
# --------------------------------
# We use a single JSON schema that *only* allows the 'send_query_to_agents' function call.
# In a real scenario, you may have multiple schemas or function definitions.
set TRIAGE_JSON_SCHEMA '{
  "name": "triage_schema",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "agents": {
        "type": "array",
        "items": { "type": "string" },
        "description": "An array of agent names to send the query to."
      },
      "query": {
        "type": "string",
        "description": "The user query to send."
      }
    },
    "required": ["agents", "query"],
    "additionalProperties": false
  }
}'

# The messages for the Triage step
set TRIAGE_MESSAGES (printf '[%s,%s]' \
  '{"role": "system", "content": "'$TRIAGING_SYSTEM_PROMPT'"}' \
  '{"role": "user", "content": "'$USER_PROMPT'"}')

# ------------
# 2) TRIAGE CALL
# ------------
echo "===== TRIAGE CALL ====="
set TRIAGE_RESPONSE (curl https://api.openai.com/v1/chat/completions \
  -s \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d @- << EOF
{
  "model": "$MODEL",
  "messages": [
    $TRIAGE_MESSAGES
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": $TRIAGE_JSON_SCHEMA
  }
}
EOF
)

echo "----- RAW TRIAGE RESPONSE -----"
echo $TRIAGE_RESPONSE | jq .

# Extract the "agents" array and "query" from triage response
set TRIAGED_AGENTS (echo $TRIAGE_RESPONSE | jq -r '.agents | join(",")')
set TRIAGED_QUERY (echo $TRIAGE_RESPONSE | jq -r '.query')

echo "AGENTS identified: $TRIAGED_AGENTS"
echo "QUERY for them: $TRIAGED_QUERY"
echo

# In real usage, you'd store the conversation in a structured way. We'll keep it simple here.
# We'll do "Data Processing" -> "Analysis" -> "Visualization", if listed.

# Helper function to perform a specialized agent call in fish:
function call_agent
    set agent_type $argv[1]   # e.g. "Data Processing Agent"
    set agent_prompt $argv[2] # e.g. $TRIAGED_QUERY

    switch $agent_type
        case "Data Processing Agent"
            set SYSTEM_PROMPT $PROCESSING_SYSTEM_PROMPT
        case "Analysis Agent"
            set SYSTEM_PROMPT $ANALYSIS_SYSTEM_PROMPT
        case "Visualization Agent"
            set SYSTEM_PROMPT $VISUALIZATION_SYSTEM_PROMPT
        case '*'
            echo "Unknown agent: $agent_type"
            return
    end

    # For each agent, you might define a different function schema. Here we use a single minimal schema
    set AGENT_SCHEMA '{
      "name": "agent_tool_call",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "data": {"type": "string"},
          "x":    {"type": "string"},
          "y":    {"type": "string"}
        },
        "required": []
      }
    }'

    set AGENT_MESSAGES (printf '[%s,%s]' \
      '{"role": "system", "content": "'$SYSTEM_PROMPT'"}' \
      '{"role": "user", "content": "'$agent_prompt'"}')

    echo "===== CALLING AGENT: $agent_type ====="
    set AGENT_RESPONSE (curl https://api.openai.com/v1/chat/completions \
      -s \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $OPENAI_API_KEY" \
      -d @- << EOF
{
  "model": "$MODEL",
  "messages": [
    $AGENT_MESSAGES
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": $AGENT_SCHEMA
  },
  "temperature": 0
}
EOF
    )

    echo "----- RAW $agent_type RESPONSE -----"
    echo $AGENT_RESPONSE | jq .
    echo

    # In practice: parse the function calls, do your data cleaning or chart creation, etc.
    # We'll just echo a placeholder tool execution:
    echo "(Mock) Executing Tools for: $agent_type..."
end

# ----------------------
# 3) LOOP OVER AGENTS
# ----------------------
# Suppose the triaging step gave us "Data Processing Agent,Analysis Agent,Visualization Agent".
# We'll split them on commas and call them in order:
for agent in (echo $TRIAGED_AGENTS | sed 's/,/ /g')
    call_agent "$agent" "$TRIAGED_QUERY"
end

echo "===== MULTI-AGENT FLOW COMPLETE ====="
