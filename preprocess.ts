import { sendChatRequest, parseChatResponse, type ChatResult, type ChatMessage, type Json } from "./chat.js";
import config from "./config.toml";

/**
 * Preprocesses chat messages to extract keywords from user input.
 * 
 * @param messages - An array of ChatMessage objects.
 * @returns {Promise<ChatMessage[]>} - A promise resolving to a new array of ChatMessage objects with text replaced by keywords.
 */
export async function preprocessPipeline(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const processedMessages: ChatMessage[] = await Promise.all(messages.map(async (message) => {
    if (message.role === "user") {
      const keywordsResult = await extractKeywords(message.content.map(c => c.type === "text" ? c.text : "").join(" "));
      if (!keywordsResult.ok) throw keywordsResult.error;

      return {
        ...message,
        content: [{ type: "text", text: keywordsResult.value.keywords?.toString?.() ?? "" }]
      };
    }
    return message;
  }));

  return processedMessages;
}

/**
 * Sends a request to the chat model to extract keywords from a string prompt.
 * 
 * @param prompt - The user prompt for which keywords are desired.
 * @returns {Promise<ChatResult<{ keywords: string }>>} - A promise resolving to the extracted keywords.
 */
async function extractKeywords(prompt: string): Promise<ChatResult<{ [key: string]: Json }>> {
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

  return sendChatRequest(payload).then(parseChatResponse);
}
