import { sendChatRequest, parseChatResponse, type ChatMessage } from "./chat.js";
import config from "./config.toml";
import type { Json, Result } from "./utils.js";

/**
 * Preprocesses chat messages to extract keywords from user input.
 * 
 * @param message - A single ChatMessage object.
 * @returns {Promise<ChatMessage>} - A promise resolving to a new ChatMessage object with text replaced by keywords.
 */
export async function preprocessPipeline(message: ChatMessage): Promise<ChatMessage> {
  if (message.role === "user") {
    const keywordsResult = await extractKeywords(message.content.map(c => c.type === "text" ? c.text : "").join(" "));
    if (!keywordsResult.ok) throw keywordsResult.error;

    return {
      ...message,
      content: [{ type: "text", text: keywordsResult.value.keywords?.toString?.() ?? "" }]
    };
  }
  return message;
}

/**
 * Sends a request to the chat model to extract keywords from a string prompt.
 * 
 * @param prompt - The user prompt for which keywords are desired.
 * @returns {Promise<ChatResult<{ keywords: string }>>} - A promise resolving to the extracted keywords.
 */
async function extractKeywords(prompt: string): Promise<Result<{ [key: string]: Json }>> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: config.prompt.keywords, // or any system-level instructions
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt,
        },
      ],
    },
  ];

  const payload = {
    model: config.model,
    temperature: 0,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "keywords_query",
        strict: true,
        schema: {
          type: "object",
          properties: {
            keywords: { type: "string" },
          },
          required: ["keywords"],
          additionalProperties: false,
        },
      },
    },
  };

  return sendChatRequest(payload as { [key: string]: Json }).then(parseChatResponse);
}
