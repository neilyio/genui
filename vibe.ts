import {
  sendChatRequest,
  type Result,
  type ChatPayload,
  type Json,
  type ChatMessage,
  parseChatResponse,
} from "./chat.js";
import config from "./config.toml";

const MODEL = config.model;
function chatPayload(
  { name, messages }:
    {
      name: string,
      messages: unknown,
    }
): { [key: string]: unknown } {
  return {
    model: MODEL,
    temperature: 1,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: name,
        strict: true,
        schema: {
          type: "object",
          properties: {
            "words": {
              type: "array",
              items: {
                type: "string",
              },
            }
          },
          required: ["words"],
          additionalProperties: false,
        },
      }
    }
  }
}
const messages = [
  { "role": "system", "content": "Respond with a list of 10 colors describing the color palette of the requested theme." },
  { "role": "user", "content": "Make it Mario-themed." },
];


const payload = chatPayload({ name: "theme-words", messages });

const response = await sendChatRequest(payload);
if (!response.ok) throw new Error(JSON.stringify(response.error));
console.log(JSON.parse(response.value.choices[0].message.content).words);
