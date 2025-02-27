import { sendChatRequest, parseChatResponse, type Result, type ChatMessage, type Json } from "./chat.js";
import config from "./config.toml";

/**
 * Generates a playful and friendly response message with puns and jokes.
 * 
 * @param theme - The theme to base the response on.
 * @returns {Promise<string>} - A promise resolving to the playful response message.
 */
export async function textPipeline(theme: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: config.prompt.chat,
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: theme,
        },
      ],
    },
  ];

  const payload = {
    model: config.model,
    temperature: 0.7,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "text_response",
        strict: true,
        schema: {
          type: "object",
          properties: {
            response: { type: "string" },
          },
          required: ["response"],
          additionalProperties: false,
        },
      },
    },
  };

  const result = await sendChatRequest(payload).then(parseChatResponse);
  if (!result.ok) throw result.error;

  return result.value.response?.toString?.() ?? "";
}
