import type { Result, Json } from "./utils.ts";

export type ChatMessageContent =
  | { type: "text", text: string }
  | { type: "image_url", image_url: string }
  | { type: "image_url", image_url: { url: string, detail: string } };

export interface ChatMessage {
  role: string;
  content: ChatMessageContent[];
}

// Define the JSON Schema response format structure.
export interface JsonSchemaFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: {
      type: "object",
      properties: {
        [key: string]: Json,
      }
      required?: string[],
      additionalProperties: boolean
    };
  };
}

// ChatPayload now has a strongly typed response_format property.
export interface ChatPayload {
  model: string;
  temperature?: number;
  messages: ChatMessage[];
  response_format?: JsonSchemaFormat;
}

export function parseChatResponse(response: Result<unknown>): Result<{ [key: string]: Json }> {

  if (!response.ok) return response;

  const value: any = response.value;
  const content = value?.choices?.[0]?.message?.content;

  if (!content) {
    return {
      ok: false, error: { type: "NoResponseContent" }
    }
  } else {
    try {
      return { ok: true, value: JSON.parse(content) };
    } catch (err) {
      return {
        ok: false, error: { type: "InvalidResponseJson" }
      }
    }

  };
}

/**
 * Traverses the input object following the given path.
 *
 * @param input - The initial object.
 * @param path - An array of keys representing the path to traverse.
 * @returns The value found at the end of the path.
 */
function traversePath(input: any, path: string[]): any {
  let current = input;
  for (const key of path) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Parses an input into an array of ChatMessage objects.
 * The input can either be a single ChatMessage or an array of ChatMessage objects,
 * or it can be an object containing the message(s) at a given path.
 * Comprehensive error handling is provided to ensure the input structure is valid.
 *
 * @param input - The input value to parse as ChatMessage(s).
 * @param path - Optional. An array of keys representing the path on the object where the message(s) reside.
 *               If omitted, the top-level input is assumed to be the message(s).
 * @returns A Result that is either a success with the parsed messages or a failure with an error.
 */
export function parseChatMessages(input: any, path?: string[]): Result<ChatMessage[]> {
  let target = input;

  // If a path is provided, traverse the input to find the messages.
  if (path && path.length > 0) {
    target = traversePath(input, path);
    if (target === undefined) {
      return {
        ok: false,
        error: {
          type: "InvalidChatMessages",
          detail: `Could not resolve path ${path.join(" -> ")} on the input object.`
        }
      };
    }
  }

  // If target is not an array, wrap it in an array.
  const messagesArray = Array.isArray(target) ? target : [target];

  if (messagesArray.length === 0) {
    return {
      ok: false,
      error: {
        type: "InvalidChatMessages",
        detail: "Input does not contain any chat messages."
      }
    };
  }

  const messages: ChatMessage[] = [];

  // Iterate over each message and validate.
  for (let i = 0; i < messagesArray.length; i++) {
    const msg = messagesArray[i];

    // Ensure the message is an object.
    if (typeof msg !== "object" || msg === null) {
      return {
        ok: false,
        error: {
          type: "InvalidChatMessages",
          detail: `Message at index ${i} is not a valid object.`
        }
      };
    }

    // Validate that the 'role' property exists and is a string.
    if (typeof msg.role !== "string") {
      return {
        ok: false,
        error: {
          type: "InvalidChatMessages",
          detail: `Message at index ${i} is missing a valid 'role' property.`
        }
      };
    }

    // Validate that the 'content' property exists.
    if (!("content" in msg)) {
      return {
        ok: false,
        error: {
          type: "InvalidChatMessages",
          detail: `Message at index ${i} is missing the 'content' property.`
        }
      };
    }

    let contentArray: ChatMessageContent[];

    // If content is a string, wrap it in an array with a text object.
    if (typeof msg.content === "string") {
      contentArray = [{
        type: "text",
        text: msg.content,
      }];
    } else if (Array.isArray(msg.content)) {
      contentArray = msg.content;

      // Validate each content item in the array.
      for (let j = 0; j < contentArray.length; j++) {
        const contentItem = contentArray[j];
        if (typeof contentItem !== "object" || contentItem === null) {
          return {
            ok: false,
            error: {
              type: "InvalidChatMessages",
              detail: `Content at index ${j} in message ${i} is not a valid object.`
            }
          };
        }
        if (typeof contentItem.type !== "string") {
          return {
            ok: false,
            error: {
              type: "InvalidChatMessages",
              detail: `Content at index ${j} in message ${i} is missing a valid 'type' property.`
            }
          };
        }
      }
    } else {
      // If content is neither a string nor an array, it's invalid.
      return {
        ok: false,
        error: {
          type: "InvalidChatMessages",
          detail: `Message at index ${i} has an invalid 'content' type.`
        }
      };
    }

    // If validations pass, add the parsed message.
    messages.push({
      role: msg.role,
      content: contentArray
    });
  }

  // Return the successfully parsed messages.
  return { ok: true, value: messages };
}

/**
 * Sends a chat request to the OpenAI API.
 *
 * @param payload - The request payload for the OpenAI Chat API.
 * @returns A promise resolving to a Result containing the API response or an enumerated ChatError.
 */
export async function sendChatRequest(
  payload: { [key: string]: Json }
): Promise<Result<unknown>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: { type: "MissingApiKey" } };
  }

  try {
    const response = await Bun.fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = await response.text();
      try {
        detail = JSON.parse(detail)
      } catch (_) {
        // Ignore error, we'll stil return error detail as text.
      }
      return {
        ok: false,
        error: {
          type: "HttpError",
          status: response.status,
          statusText: response.statusText,
          detail,
        },
      };
    }

    const data = await response.json();
    return { ok: true, value: data };
  } catch (e) {
    return {
      ok: false,
      error: { type: "FetchError", detail: e instanceof Error ? e.message : String(e) },
    };
  }
}
