#!/usr/bin/env fish

# ------------------------------------------------------------
# Multi-Agent UI Generation Example (fish shell, macOS)
# ------------------------------------------------------------
#
# This script:
#   1. Reads a user prompt from the command line argument
#   2. Sends it (plus a CSS_VAR_MAP) to a Triage Agent
#   3. The Triage Agent decides which specialized sub-agents to call:
#      - Design Agent, Accessibility Agent, Tone Agent
#   4. Calls each sub-agent, capturing partial JSON output
#   5. Calls a final aggregator or simply merges results to produce:
#        {
#          "type": "ui_update",
#          "content": "...",
#          "ui_changes": {...},
#          "currentState": {...}
#        }
#   6. Prints the final JSON response
#
# Dependencies:
#   - fish shell (macOS)
#   - jq (for JSON parsing)
#   - OPENAI_API_KEY (environment variable)
#
# Usage:
#   ./multi_agent_ui_generator.fish "Make it look like a Mario theme 🍄"
#
# Adjust prompts, JSON schemas, etc. as needed for your real use case.

if test (count $argv) -lt 1
    echo "Usage: ./multi_agent_ui_generator.fish \"Your user prompt...\""
    exit 1
end

# ---------------------
# 0) Setup & Parameters
# ---------------------
set USER_PROMPT $argv[1]

if test -z "$OPENAI_API_KEY"
    echo "Error: OPENAI_API_KEY environment variable is not set."
    exit 1
end

# Example: you might embed your CSS_VAR_MAP as JSON so the model can see or manipulate it.
# In a real scenario, you could pass much more context about each variable’s usage/constraints.
set CSS_VAR_MAP_JSON '{
  "primary_color": "--primary-color",
  "secondary_color": "--secondary-color",
  "background_color": "--background-color",
  "text_color": "--text-color",
  "page_bg": "--page-bg",
  "bubble_size": "--bubble-size",
  "bubble_padding": "--bubble-padding",
  "bubble_radius": "--bubble-radius",
  "bubble_shadow": "--bubble-shadow",
  "bubble_max_width": "--bubble-max-width",
  "font_family": "--font-family",
  "font_size": "--font-size",
  "line_height": "--line-height",
  "spacing": "--spacing",
  "chat_container_max_width": "--chat-container-max-width",
  "animation_speed": "--animation-speed",
  "transition_effect": "--transition-effect",
  "border_width": "--border-width",
  "border_style": "--border-style",
  "border_color": "--border-color",
  "global_border_radius": "--global-border-radius",
  "input_background": "--input-background",
  "chat_background": "--chat-background",
  "header_background": "--header-background",
  "header_text_color": "--header-text-color",
  "user_message_background": "--user-message-background",
  "user_message_text_color": "--user-message-text-color",
  "assistant_message_background": "--assistant-message-background",
  "assistant_message_text_color": "--assistant-message-text-color",
  "message_margin_bottom": "--message-margin-bottom",
  "user_message_border_color": "--user-message-border-color",
  "assistant_message_border_color": "--assistant-message-border-color",
  "button_icon_color": "--button-icon-color",
  "send_button_bg": "--send-button-bg",
  "send_button_color": "--send-button-color",
  "attachment_button_bg": "--attachment-button-bg",
  "attachment_button_color": "--attachment-button-color",
  "info_button_color": "--info-button-color"
}'

# Choose an OpenAI model
set MODEL gpt-4o-2024-08-06

# ------------------------
# 1) Define System Prompts
# ------------------------

# Triaging Agent: Figures out which sub-agents we need
set TRIAGE_AGENT_PROMPT "You are a Triage Agent for a UI Generation tool. The user wants a themed UI. Possible sub-agents:
- Design Agent: Chooses color palette, fonts, spacing, etc.
- Accessibility Agent: Ensures color contrast, layout best practices.
- Tone Agent: Crafts playful or on-brand language and emojis.

Analyze the user's prompt. If it's about theming or styling, route it to 'Design Agent'. If you need accessibility checks, include 'Accessibility Agent'. If the user wants a fun or thematic style of writing, route to 'Tone Agent'.

We have a shared CSS_VAR_MAP: $CSS_VAR_MAP_JSON

Decide which sub-agents to call, then produce a JSON with:
{
  \"agents\": [ ... ],
  \"query\": \"...the relevant query...maybe including CSS_VAR_MAP...\"
}

Use send_query_to_agents for the final answer. Make sure to pass along the CSS_VAR_MAP and user prompt."

# Design Agent: Proposes color palette, fonts, etc.
set DESIGN_AGENT_PROMPT "You are the Design Agent. You create or modify a UI theme. The user wants a certain style. You have a JSON map of CSS variables. Output the 'ui_changes' keys and color/font values that match the theme. Provide partial JSON with design suggestions. Do not finalize tone or accessibility—just propose the raw design choices."

# Accessibility Agent: Validates contrast, adjusts style if needed
set ACCESSIBILITY_AGENT_PROMPT "You are the Accessibility Agent. You ensure colors meet contrast guidelines, font sizes are readable, etc. You receive partially completed 'ui_changes' from the Design Agent. Adjust them if necessary to ensure best practices. Output updated 'ui_changes' partial JSON if changes are needed."

# Tone Agent: Provides a fun thematic response
set TONE_AGENT_PROMPT "You are the Tone Agent. Your task is to wrap the final user response in a playful style consistent with the theme. You might add emojis and on-brand references. Return a short 'content' string with a playful tone, referencing the newly proposed UI changes."

# Final Aggregator: merges the partial results into a final 'ui_update' JSON
set AGGREGATOR_PROMPT "You are the Aggregator. Combine the design data, accessibility data, and tone content into a final structured JSON:
{
  \"type\": \"ui_update\",
  \"content\": \"...fun text...\",
  \"ui_changes\": { ...final UI variables... },
  \"currentState\": { ...mirror of final UI variables... }
}
Return only valid JSON."

# ---------------
# 2) JSON Schemas
# ---------------
#
# a) Triage Agent expects a single function call "send_query_to_agents" with "agents" and "query".
#
set TRIAGE_SCHEMA '{
  "name": "send_query_to_agents",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "agents": {
        "type": "array",
        "items": { "type": "string" }
      },
      "query": {
        "type": "string"
      }
    },
    "required": ["agents", "query"],
    "additionalProperties": false
  }
}'

# b) Design / Accessibility / Tone Agents can each have a simpler or custom schema.
#   For example, we might define a "partial_ui_updates" schema with a single property "ui_partial" (object).
#   Or we can define more detailed ones with explicit color keys. For brevity, we keep it minimal.
set SUBAGENT_SCHEMA '{
  "name": "partial_ui_update",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "ui_changes": {
        "type": "object"
      },
      "content": {
        "type": "string"
      }
    },
    "additionalProperties": true
  }
}'

# c) Aggregator final schema that returns the complete "ui_update" object
set AGGREGATOR_SCHEMA '{
  "name": "ui_update",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "type": { "type": "string" },
      "content": { "type": "string" },
      "ui_changes": {
        "type": "object"
      },
      "currentState": {
        "type": "object"
      }
    },
    "required": ["type", "content", "ui_changes", "currentState"],
    "additionalProperties": false
  }
}'

# ----------------------------
# 3) Helper: single OpenAI call
# ----------------------------
function call_openai
    # Usage: call_openai <system_prompt> <user_content> <json_schema_object> <temperature> -> outputs raw JSON
    set sys_prompt $argv[1]
    set user_msg $argv[2]
    set schema $argv[3]
    set temp $argv[4]

    if test -z "$temp"
        set temp 0
    end

    # Convert system prompt + user message into an array of messages
    set MESSAGES (printf '[{"role": "system", "content": "%s"},{"role": "user", "content": "%s"}]' \
        (echo $sys_prompt | sed 's/"/\\"/g') \
        (echo $user_msg   | sed 's/"/\\"/g'))

    echo '{
  "model": "'$MODEL'",
  "messages": '$MESSAGES',
  "response_format": {
    "type": "json_schema",
    "json_schema": '$schema'
  },
  "temperature": '$temp'
}' | curl -s \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -d @- \
        https://api.openai.com/v1/chat/completions
end

# -----------------------
# 4) Triage Agent Request
# -----------------------
echo "===== TRIAGE AGENT CALL ====="
set triage_user_query "User prompt: $USER_PROMPT\n\nWe also have CSS_VAR_MAP:\n$CSS_VAR_MAP_JSON"
set TRIAGE_RESPONSE (call_openai "$TRIAGE_AGENT_PROMPT" "$triage_user_query" "$TRIAGE_SCHEMA" 0)

echo "----- RAW TRIAGE RESPONSE -----"
echo $TRIAGE_RESPONSE | jq .

# Parse out agent array and the query
set TRIAGED_AGENTS (echo $TRIAGE_RESPONSE | jq -r '.agents | join(",")' 2>/dev/null)
set TRIAGED_QUERY (echo $TRIAGE_RESPONSE | jq -r '.query' 2>/dev/null)

if test -z "$TRIAGED_AGENTS" -o "$TRIAGED_AGENTS" = null
    echo "No sub-agents returned or invalid JSON. Exiting."
    exit 0
end

echo "AGENTS identified: $TRIAGED_AGENTS"
echo "Sub-query:\n$TRIAGED_QUERY"
echo

# ---------------------------------------------------------
# 5) Sequentially Call the Sub-Agents & Collect Their Output
# ---------------------------------------------------------
# We simulate that each sub-agent returns partial updates (e.g. "ui_changes") or "content" text.

set DESIGN_JSON ""
set ACCESSIBILITY_JSON ""
set TONE_JSON ""

for agent in (echo $TRIAGED_AGENTS | sed 's/,/ /g')
    switch $agent
        case "Design Agent"
            echo "===== CALLING DESIGN AGENT ====="
            set design_resp (call_openai "$DESIGN_AGENT_PROMPT" "$TRIAGED_QUERY" "$SUBAGENT_SCHEMA" 0)
            echo $design_resp | jq .
            set DESIGN_JSON $design_resp
        case "Accessibility Agent"
            echo "===== CALLING ACCESSIBILITY AGENT ====="
            set access_resp (call_openai "$ACCESSIBILITY_AGENT_PROMPT" "$TRIAGED_QUERY" "$SUBAGENT_SCHEMA" 0)
            echo $access_resp | jq .
            set ACCESSIBILITY_JSON $access_resp
        case "Tone Agent"
            echo "===== CALLING TONE AGENT ====="
            set tone_resp (call_openai "$TONE_AGENT_PROMPT" "$TRIAGED_QUERY" "$SUBAGENT_SCHEMA" 0)
            echo $tone_resp | jq .
            set TONE_JSON $tone_resp
        case '*'
            echo "Unknown agent: $agent"
    end
end

# -----------------------------------
# 6) Build a single aggregator prompt
# -----------------------------------
# We pass the partial design data, accessibility changes, and tone into the aggregator.
# Typically you'd parse each JSON for 'ui_changes' or 'content' to combine them. We'll do so with jq below.
set DESIGN_UI_CHANGES (echo $DESIGN_JSON | jq -r '.ui_changes // {}')
set ACCESS_UI_CHANGES (echo $ACCESSIBILITY_JSON | jq -r '.ui_changes // {}')
set TONE_CONTENT (echo $TONE_JSON | jq -r '.content // ""')

# A naive merge approach:
#  1. Start with design's 'ui_changes'
#  2. Overlay accessibility's 'ui_changes'
# In a real scenario, you'd do a more thorough merging approach if the same keys conflict.

set MERGED_UI_CHANGES (echo $DESIGN_UI_CHANGES | \
    jq --argjson a $ACCESS_UI_CHANGES '. * $a')

# Combine everything into aggregator user message
# The aggregator will produce the final "ui_update" JSON.
set aggregator_user_msg (printf 'Partial design changes:\n%s\n\nAccessibility updates:\n%s\n\nTone content:\n%s\n\nPlease produce final JSON.' \
    (echo $MERGED_UI_CHANGES | jq '.') \
    (echo $ACCESS_UI_CHANGES | jq '.') \
    "$TONE_CONTENT")

echo "===== CALLING AGGREGATOR ====="
set AGGREGATOR_RESPONSE (call_openai "$AGGREGATOR_PROMPT" "$aggregator_user_msg" "$AGGREGATOR_SCHEMA" 0)
echo "----- RAW AGGREGATOR RESPONSE -----"
echo $AGGREGATOR_RESPONSE | jq .

# ------------------------
# 7) Final Output
# ------------------------
echo
echo "===== FINAL UI_UPDATE JSON ====="
echo $AGGREGATOR_RESPONSE | jq .
echo
echo "Multi-Agent UI Generation Complete!"
