import {
  sendChatRequest,
  type ChatResult,
  type ChatPayload,
  type Json,
  type ChatMessage,
  parseChatResponse,
  type ChatMessageContent,
} from "./chat.js";
import config from "./config.toml";
import { fetchToBase64 } from "./images.js";

const MODEL = config.model;
const COLOR_PROPERTIES = Object
  .keys(config.variables.color as Record<string, unknown>)
  .reduce(
    (acc, key) => { acc[key] = { type: "string" }; return acc; },
    {} as Record<string, { type: string }>
  );
const COLOR_REQUIRED = Object.keys(COLOR_PROPERTIES);


function chatPayload(
  { name, messages, properties }:
    {
      name: string,
      messages: ChatMessage[],
      properties: {
        [key: string]: Json
      }
    }
): { [key: string]: unknown } {
  let required = Object.keys(properties);
  return {
    model: MODEL,
    temperature: 0,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: name,
        strict: true,
        schema: {
          type: "object",
          properties,
          required,
          additionalProperties: false,
        },
      }
    }
  }
}


export async function sendPaletteRequest(contents: ChatMessageContent[]):
  Promise<ChatResult<{ ui_changes: Json }>> {
  const prompt = config.prompt.palette;
  let text: ChatMessageContent[] = [];
  let urls: Promise<ChatMessageContent>[] = [];
  for (const content of contents) {
    if (content.type === "text") {
      text.push(content);
    } else {
      let url = typeof content.image_url === 'string'
        ? content.image_url
        : content.image_url.url;

      urls.push(fetchToBase64(url)
        .then(b => ({ type: "image_url", image_url: { url: b, detail: "low" } })));
    }
  }

  const b64s: ChatMessageContent[] =
    await Promise.allSettled(urls)
      .then(rs => rs.filter(r => r.status === 'fulfilled').map(r => r.value));

  const payload = chatPayload({
    name: "send_query",
    messages: [
      { role: "system", content: [{ type: "text", text: prompt }] },
      {
        role: "user", content: [
          ...text, ...b64s
        ]
      }
    ],
    properties: {
      ui_changes: {
        type: "object",
        properties: COLOR_PROPERTIES,
        required: COLOR_REQUIRED,
        additionalProperties: false
      }
    },
  })

  return await sendChatRequest(payload).then(parseChatResponse)
    .then(p => p.ok ? { ok: true, value: { ui_changes: p.value["ui_changes"] } } : p);
}
