import { sendChatRequest, type ChatMessage } from "./chat.js";
import config from "../config.toml";
import type { Json, Result } from "./utils.js";

/**
 * Sends a request to the chat model to determine layout variables based on a theme prompt.
 * 
 * @param prompt - The theme prompt for which layout variables are desired.
 * @returns {Promise<Result<{ ui_changes: { [key: string]: Json } }>>} - A promise resolving to the layout variables.
 */
export async function layoutPipeline(prompt: string): Promise<Result<{ ui_changes: { [key: string]: Json } }>> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: "Determine appropriate layout variables for the given theme prompt.",
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
        name: "layout_query",
        strict: true,
        schema: {
          type: "object",
          properties: {
            bubble_size: { type: "string" },
            bubble_padding: { type: "string" },
            bubble_radius: { type: "string" },
            bubble_shadow: { type: "string" },
            bubble_max_width: { type: "string" },
            chat_container_max_width: { type: "string" },
            border_width: { type: "string" },
            border_style: { type: "string" },
            global_border_radius: { type: "string" },
            message_margin_bottom: { type: "string" },
            animation_speed: { type: "string" },
            transition_effect: { type: "string" },
          },
          required: [
            "bubble_size",
            "bubble_padding",
            "bubble_radius",
            "bubble_shadow",
            "bubble_max_width",
            "chat_container_max_width",
            "border_width",
            "border_style",
            "global_border_radius",
            "message_margin_bottom",
            "animation_speed",
            "transition_effect",
          ],
          additionalProperties: false,
        },
      },
    },
  };

  return await sendChatRequest(payload as unknown as { [key: string]: Json }).then(response => {
    if (!response.ok) return response;
    return { ok: true, value: { ui_changes: response.value as { [key: string]: Json } } };
  });
}
