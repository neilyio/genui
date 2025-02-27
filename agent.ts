// #!/usr/bin/env bun
// /**
//  * multi_agent_ui_generator.ts
//  *
//  * A TypeScript version of the multi-agent UI generation script originally
//  * in fish shell. It makes use of the "chat.ts" helper for sending requests
//  * to the OpenAI Chat API via a typed interface.
//  *
//  * Usage:
//  *   bun run multi_agent_ui_generator.ts "Make it look like a Mario theme 🍄"
//  *
//  * Ensure you have OPENAI_API_KEY set in your environment.
//  */

// import {
//   sendChatRequest,
//   type ChatResult,
//   type ChatPayload,
//   type Json,
//   type ChatMessage,
//   parseChatResponse,
// } from "./chat.js";
// import CSS_VAR_MAP_JSON from "./varmap.json";

// // --------------------------------
// // 0) Setup & Parameters
// // --------------------------------

// // Retrieve user prompt from command line args
// if (process.argv.length < 3) {
//   console.error("Usage: bun run multi_agent_ui_generator.ts \"Your user prompt...\"");
//   process.exit(1);
// }
// const USER_PROMPT = process.argv[2] || "";

// // Model to use for all requests
// const MODEL = "gpt-4o-2024-08-06";

// // --------------------------------
// // 1) Define System Prompts
// // --------------------------------

// const TRIAGE_SYSTEM_PROMPT = `You are a Triage Agent for a UI Generation tool. The user wants a themed UI. Possible sub-agents:
// - Design Agent: Chooses color palette, fonts, spacing, etc.
// - Accessibility Agent: Ensures color contrast, layout best practices.
// - Tone Agent: Crafts playful or on-brand language and emojis.

// Analyze the user's prompt. If it's about theming or styling, route it to 'Design Agent'. If you need accessibility checks, include 'Accessibility Agent'. If the user wants a fun or thematic style of writing, route to 'Tone Agent'.

// We have a shared CSS_VAR_MAP: ${CSS_VAR_MAP_JSON}

// Decide which sub-agents to call, then produce a JSON with:
// {
//   "agents": [ ... ],
//   "query": "...the relevant query...maybe including CSS_VAR_MAP..."
// }

// Use send_query_to_agents for the final answer. Make sure to pass along the CSS_VAR_MAP and user prompt.`;

// const TRIAGE_USER_PROMPT = `User prompt: ${USER_PROMPT}\n\nWe also have CSS_VAR_MAP:\n${CSS_VAR_MAP_JSON}`;

// const DESIGN_AGENT_PROMPT = `You are the Design Agent.You create or modify a UI theme.The user wants a certain style.You have a JSON map of CSS variables.Output the 'ui_changes' keys and color / font values that match the theme.Provide partial JSON with design suggestions.Do not finalize tone or accessibility—just propose the raw design choices.`;

// const ACCESSIBILITY_AGENT_PROMPT = `You are the Accessibility Agent.You ensure colors meet contrast guidelines, font sizes are readable, etc.You receive partially completed 'ui_changes' from the Design Agent.Adjust them if necessary to ensure best practices.Output updated 'ui_changes' partial JSON if changes are needed.`;

// const TONE_AGENT_PROMPT = `You are the Tone Agent.Your task is to wrap the final user response in a playful style consistent with the theme.You might add emojis and on - brand references.Return a short 'content' string with a playful tone, referencing the newly proposed UI changes.`;

// const AGGREGATOR_PROMPT = `You are the Aggregator.Combine the design data, accessibility data, and tone content into a final structured JSON:
// {
//   "type": "ui_update",
//     "content": "...fun text...",
//       "ui_changes": { ...final UI variables... },
//   "currentState": { ...mirror of final UI variables... }
// }
// Return only valid JSON.`;

// // --------------------------------
// // 2) JSON Schemas
// // --------------------------------


// // Aggregator final schema that returns the complete "ui_update" object
// const AGGREGATOR_SCHEMA = {
//   name: "ui_update",
//   strict: true,
//   schema: {
//     type: "object",
//     properties: {
//       type: { type: "string" },
//       content: { type: "string" },
//       ui_changes: {
//         type: "object",
//       },
//       currentState: {
//         type: "object",
//       },
//     },
//     required: ["type", "content", "ui_changes", "currentState"],
//     additionalProperties: false,
//   },
// };

// // -----------------------------------
// // 4) Triage Agent Request
// // -----------------------------------
// //
// function agentPayload(
//   { name, messages, properties }:
//     {
//       name: string,
//       messages: ChatMessage[],
//       properties: {
//         [key: string]: Json
//       }
//     }
// ): ChatPayload {
//   let required = Object.keys(properties);
//   return {
//     model: MODEL,
//     messages,
//     response_format: {
//       type: "json_schema",
//       json_schema: {
//         name: name,
//         strict: true,
//         schema: {
//           type: "object",
//           properties,
//           required,
//           additionalProperties: false,
//         },
//       }
//     }
//   }
// }

// async function main() {
//   if (!process.env.OPENAI_API_KEY) {
//     console.error("Error: OPENAI_API_KEY environment variable is not set.");
//     process.exit(1);
//   }

//   console.log("===== TRIAGE AGENT CALL =====");
//   const triagePayload = agentPayload({
//     name: "send_query_to_agents",
//     messages: [
//       { role: "system", content: TRIAGE_SYSTEM_PROMPT },
//       { role: "user", content: TRIAGE_USER_PROMPT }
//     ],
//     properties: {
//       agents: { type: "array", items: { type: "string" } },
//       query: { type: "string" },
//     }
//   })

//   const triageResponse = await sendChatRequest(triagePayload)
//     .then(parseChatResponse).then(r => {
//       if (!r.ok) throw new Error(
//         `OpenAI request error: ${JSON.stringify(r.error, null, 2)} `
//       );
//       return r.value;
//     });


//   console.log("----- RAW TRIAGE RESPONSE -----");
//   console.dir(triageResponse, { depth: null });

//   // Parse out agents array and the query
//   const triagedAgents: string[] = [];
//   if (Array.isArray(triageResponse.agents)) {
//     for (const agent of triageResponse.agents.filter(a => typeof a === "string")) {
//       triagedAgents.push(agent);
//     }
//   }
//   const triagedQuery: string = triageResponse.query?.toString() ?? "";

//   if (!triagedAgents.length) {
//     console.log("No sub-agents returned or invalid JSON. Exiting.");
//     process.exit(0);
//   }

//   console.log("AGENTS identified:", triagedAgents);
//   console.log("Sub-query:\n", triagedQuery);
//   console.log();


//   // --------------------------------------------
//   // 5) Call the Sub-Agents & Collect Their Output
//   // --------------------------------------------
//   let [designJson, accessibilityJson, toneJson]:
//     { [key: string]: Json }[] = [{}, {}, {}];

//   for (const agent of triagedAgents) {
//     switch (agent) {
//       case "Design Agent": {
//         console.log("===== CALLING DESIGN AGENT =====");
//         const designPayload = agentPayload({
//           name: "partial_ui_update",
//           messages: [
//             { role: "system", content: DESIGN_AGENT_PROMPT },
//             { role: "user", content: triagedQuery }
//           ],
//           properties: {
//             ui_changes: {
//               type: "object",
//             },
//             content: {
//               type: "string",
//             },
//           },

//         })
//         designJson = await sendChatRequest(designPayload)
//           .then(parseChatResponse).then(r => {
//             if (!r.ok) throw new Error(
//               `OpenAI request error: ${JSON.stringify(r.error, null, 2)} `
//             );
//             return r.value;
//           });
//         break;
//       }
//       case "Accessibility Agent": {
//         console.log("===== CALLING ACCESSIBILITY AGENT =====");
//         const accessibilityPayload = agentPayload({
//           name: "partial_ui_update",
//           messages: [
//             { role: "system", content: ACCESSIBILITY_AGENT_PROMPT },
//             { role: "user", content: triagedQuery }
//           ],
//           properties: {
//             ui_changes: {
//               type: "object",
//             },
//             content: {
//               type: "string",
//             },
//           },

//         })
//         accessibilityJson = await sendChatRequest(accessibilityPayload)
//           .then(parseChatResponse).then(r => {
//             if (!r.ok) throw new Error(
//               `OpenAI request error: ${JSON.stringify(r.error, null, 2)} `
//             );
//             return r.value;
//           });
//         break;
//       }
//       case "Tone Agent": {
//         console.log("===== CALLING TONE AGENT =====");
//         const tonePayload = agentPayload({
//           name: "partial_ui_update",
//           messages: [
//             { role: "system", content: TONE_AGENT_PROMPT },
//             { role: "user", content: triagedQuery }
//           ],
//           properties: {
//             ui_changes: {
//               type: "object",
//             },
//             content: {
//               type: "string",
//             },
//           },

//         })
//         toneJson = await sendChatRequest(tonePayload)
//           .then(parseChatResponse).then(r => {
//             if (!r.ok) throw new Error(
//               `OpenAI request error: ${JSON.stringify(r.error, null, 2)} `
//             );
//             return r.value;
//           });
//         break;
//       }
//       default:
//         console.log(`Unknown agent: ${agent} `);
//     }
//   }

//   if (process.argv.length > 0) {
//     process.exit()
//   }
//   // -----------------------------------
//   // 6) Build a single aggregator prompt
//   // -----------------------------------
//   // We'll parse out ui_changes and content from the sub-agent responses
//   const designUiChanges = designJson.ui_changes || {};
//   const accessUiChanges = accessibilityJson.ui_changes || {};
//   const toneContent = toneJson.content || "";

//   // Naive merge: design changes => accessibility changes
//   // const mergedUiChanges = {
//   //   ...designUiChanges,
//   //   ...accessUiChanges,
//   // };

//   // Build aggregator user message
//   const aggregatorUserMsg = `
// Partial design changes:
// ${JSON.stringify(designUiChanges, null, 2)}

// Accessibility updates:
// ${JSON.stringify(accessUiChanges, null, 2)}

// Tone content:
// ${toneContent}

// Please produce final JSON.
// `;

//   console.log("===== CALLING AGGREGATOR =====");
//   const aggregatorPayload = agentPayload({
//     name: "ui_update",
//     messages: [
//       { role: "system", content: AGGREGATOR_PROMPT },
//       { role: "user", content: aggregatorUserMsg }
//     ],
//     properties: {
//       type: { type: "string" },
//       content: { type: "string" },
//       ui_changes: {
//         type: "object",
//       },
//       currentState: {
//         type: "object",
//       },
//     },
//   });
//   const aggregatorResponse = await sendChatRequest(aggregatorPayload)
//     .then(parseChatResponse).then(r => {
//       if (!r.ok) throw new Error(
//         `OpenAI request error: ${JSON.stringify(r.error, null, 2)} `
//       );
//       return r.value;
//     });

//   console.log("----- RAW AGGREGATOR RESPONSE -----");
//   console.dir(aggregatorResponse, { depth: null });

//   // -----------------------------------
//   // 7) Final Output
//   // -----------------------------------
//   console.log();
//   console.log("===== FINAL UI_UPDATE JSON =====");
//   console.dir(aggregatorResponse, { depth: null });
//   console.log();
//   console.log("Multi-Agent UI Generation Complete!");
// }

// // Run main
// await main();
