#!/usr/bin/env bun
/**
 * multi_agent_ui_generator.ts
 *
 * A TypeScript version of the multi-agent UI generation script originally
 * in fish shell. It makes use of the "chat.ts" helper for sending requests
 * to the OpenAI Chat API via a typed interface.
 *
 * Usage:
 *   bun run multi_agent_ui_generator.ts "Make it look like a Mario theme 🍄"
 *
 * Ensure you have OPENAI_API_KEY set in your environment.
 */

import {
  sendChatRequest,
  type ChatResult,
  type ChatPayload,
  type Json,
} from "./chat.js";

// --------------------------------
// 0) Setup & Parameters
// --------------------------------

// Retrieve user prompt from command line args
if (process.argv.length < 3) {
  console.error("Usage: bun run multi_agent_ui_generator.ts \"Your user prompt...\"");
  process.exit(1);
}
const USER_PROMPT = process.argv[2] || "";

// Example: you might embed your CSS_VAR_MAP as JSON so the model can see or manipulate it.
const CSS_VAR_MAP_JSON = `{
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
}`;

// Model to use for all requests
const MODEL = "gpt-4o-2024-08-06";

// --------------------------------
// 1) Define System Prompts
// --------------------------------

const TRIAGE_AGENT_PROMPT = `You are a Triage Agent for a UI Generation tool. The user wants a themed UI. Possible sub-agents:
- Design Agent: Chooses color palette, fonts, spacing, etc.
- Accessibility Agent: Ensures color contrast, layout best practices.
- Tone Agent: Crafts playful or on-brand language and emojis.

Analyze the user's prompt. If it's about theming or styling, route it to 'Design Agent'. If you need accessibility checks, include 'Accessibility Agent'. If the user wants a fun or thematic style of writing, route to 'Tone Agent'.

We have a shared CSS_VAR_MAP: ${CSS_VAR_MAP_JSON}

Decide which sub-agents to call, then produce a JSON with:
{
  "agents": [ ... ],
  "query": "...the relevant query...maybe including CSS_VAR_MAP..."
}

Use send_query_to_agents for the final answer. Make sure to pass along the CSS_VAR_MAP and user prompt.`;

const DESIGN_AGENT_PROMPT = `You are the Design Agent. You create or modify a UI theme. The user wants a certain style. You have a JSON map of CSS variables. Output the 'ui_changes' keys and color/font values that match the theme. Provide partial JSON with design suggestions. Do not finalize tone or accessibility—just propose the raw design choices.`;

const ACCESSIBILITY_AGENT_PROMPT = `You are the Accessibility Agent. You ensure colors meet contrast guidelines, font sizes are readable, etc. You receive partially completed 'ui_changes' from the Design Agent. Adjust them if necessary to ensure best practices. Output updated 'ui_changes' partial JSON if changes are needed.`;

const TONE_AGENT_PROMPT = `You are the Tone Agent. Your task is to wrap the final user response in a playful style consistent with the theme. You might add emojis and on-brand references. Return a short 'content' string with a playful tone, referencing the newly proposed UI changes.`;

const AGGREGATOR_PROMPT = `You are the Aggregator. Combine the design data, accessibility data, and tone content into a final structured JSON:
{
  "type": "ui_update",
  "content": "...fun text...",
  "ui_changes": { ...final UI variables... },
  "currentState": { ...mirror of final UI variables... }
}
Return only valid JSON.`;

// --------------------------------
// 2) JSON Schemas
// --------------------------------

// Triage Agent expects a single function call "send_query_to_agents" with "agents" and "query".
const TRIAGE_SCHEMA = {
  name: "send_query_to_agents",
  strict: true,
  schema: {
    type: "object",
    properties: {
      agents: {
        type: "array",
        items: { type: "string" },
      },
      query: {
        type: "string",
      },
    },
    required: ["agents", "query"],
    additionalProperties: false,
  },
};

// Sub-agents can each have a simpler or custom schema.
const SUBAGENT_SCHEMA = {
  name: "partial_ui_update",
  strict: true,
  schema: {
    type: "object",
    properties: {
      ui_changes: {
        type: "object",
      },
      content: {
        type: "string",
      },
    },
    additionalProperties: true,
  },
};

// Aggregator final schema that returns the complete "ui_update" object
const AGGREGATOR_SCHEMA = {
  name: "ui_update",
  strict: true,
  schema: {
    type: "object",
    properties: {
      type: { type: "string" },
      content: { type: "string" },
      ui_changes: {
        type: "object",
      },
      currentState: {
        type: "object",
      },
    },
    required: ["type", "content", "ui_changes", "currentState"],
    additionalProperties: false,
  },
};

// -----------------------------------
// 3) Helper: single OpenAI call
// -----------------------------------
async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  schema: Json,
  temperature = 0
): Promise<any> {
  // Prepare messages array
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  // Build payload
  const payload: ChatPayload = {
    model: MODEL,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: schema, // Corrected to use the provided schema directly
    },
    temperature,
  };

  // Make request
  const result: ChatResult<unknown> = await sendChatRequest(payload);
  if (!result.ok) {
    // If there's an error from fetch or HTTP, handle it
    throw new Error(
      `OpenAI request error: ${JSON.stringify(result.error, null, 2)}`
    );
  }

  // The API response is in `result.value`
  const data: any = result.value;

  // We expect a single JSON output in data.choices[0].message.content
  // since we're using the JSON schema format, let's parse it:
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No message content returned from OpenAI.");
  }

  try {
    // The content should be valid JSON (given the JSON schema response format)
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Could not parse JSON from response: ${content}`);
  }
}

// -----------------------------------
// 4) Triage Agent Request
// -----------------------------------

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set.");
    process.exit(1);
  }

  console.log("===== TRIAGE AGENT CALL =====");
  const triageUserQuery = `User prompt: ${USER_PROMPT}\n\nWe also have CSS_VAR_MAP:\n${CSS_VAR_MAP_JSON}`;

  let triageResponse: any;
  try {
    triageResponse = await callOpenAI(
      TRIAGE_AGENT_PROMPT,
      triageUserQuery,
      TRIAGE_SCHEMA,
      0
    );
  } catch (err) {
    console.error("Error calling Triage Agent:", err);
    process.exit(1);
  }

  console.log("----- RAW TRIAGE RESPONSE -----");
  console.dir(triageResponse, { depth: null });

  // Parse out agents array and the query
  const triagedAgents: string[] = triageResponse.agents ?? [];
  const triagedQuery: string = triageResponse.query ?? "";

  if (!triagedAgents.length) {
    console.log("No sub-agents returned or invalid JSON. Exiting.");
    process.exit(0);
  }

  console.log("AGENTS identified:", triagedAgents);
  console.log("Sub-query:\n", triagedQuery);
  console.log();

  // --------------------------------------------
  // 5) Call the Sub-Agents & Collect Their Output
  // --------------------------------------------
  let designJson: any = {};
  let accessibilityJson: any = {};
  let toneJson: any = {};

  for (const agent of triagedAgents) {
    switch (agent) {
      case "Design Agent": {
        console.log("===== CALLING DESIGN AGENT =====");
        try {
          const resp = await callOpenAI(
            DESIGN_AGENT_PROMPT,
            triagedQuery,
            SUBAGENT_SCHEMA,
            0
          );
          console.dir(resp, { depth: null });
          designJson = resp;
        } catch (err) {
          console.error("Error calling Design Agent:", err);
        }
        break;
      }
      case "Accessibility Agent": {
        console.log("===== CALLING ACCESSIBILITY AGENT =====");
        try {
          const resp = await callOpenAI(
            ACCESSIBILITY_AGENT_PROMPT,
            triagedQuery,
            SUBAGENT_SCHEMA,
            0
          );
          console.dir(resp, { depth: null });
          accessibilityJson = resp;
        } catch (err) {
          console.error("Error calling Accessibility Agent:", err);
        }
        break;
      }
      case "Tone Agent": {
        console.log("===== CALLING TONE AGENT =====");
        try {
          const resp = await callOpenAI(
            TONE_AGENT_PROMPT,
            triagedQuery,
            SUBAGENT_SCHEMA,
            0
          );
          console.dir(resp, { depth: null });
          toneJson = resp;
        } catch (err) {
          console.error("Error calling Tone Agent:", err);
        }
        break;
      }
      default:
        console.log(`Unknown agent: ${agent}`);
    }
  }

  // -----------------------------------
  // 6) Build a single aggregator prompt
  // -----------------------------------
  // We'll parse out ui_changes and content from the sub-agent responses
  const designUiChanges = designJson.ui_changes || {};
  const accessUiChanges = accessibilityJson.ui_changes || {};
  const toneContent = toneJson.content || "";

  // Naive merge: design changes => accessibility changes
  const mergedUiChanges = {
    ...designUiChanges,
    ...accessUiChanges,
  };

  // Build aggregator user message
  const aggregatorUserMsg = `
Partial design changes:
${JSON.stringify(designUiChanges, null, 2)}

Accessibility updates:
${JSON.stringify(accessUiChanges, null, 2)}

Tone content:
${toneContent}

Please produce final JSON.
`;

  console.log("===== CALLING AGGREGATOR =====");
  let aggregatorResponse: any;
  try {
    aggregatorResponse = await callOpenAI(
      AGGREGATOR_PROMPT,
      aggregatorUserMsg,
      AGGREGATOR_SCHEMA,
      0
    );
  } catch (err) {
    console.error("Error calling Aggregator:", err);
    process.exit(1);
  }

  console.log("----- RAW AGGREGATOR RESPONSE -----");
  console.dir(aggregatorResponse, { depth: null });

  // -----------------------------------
  // 7) Final Output
  // -----------------------------------
  console.log();
  console.log("===== FINAL UI_UPDATE JSON =====");
  console.dir(aggregatorResponse, { depth: null });
  console.log();
  console.log("Multi-Agent UI Generation Complete!");
}

// Run main
await main();
