// chat.test.ts

import { sendChatRequest, type ChatPayload, type Result } from "./chat";
import { describe, expect, it, beforeEach, afterEach } from "bun:test";

// Save the original fetch and API key.
const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  // Set a dummy API key for testing.
  process.env.OPENAI_API_KEY = "dummy-api-key";
});

afterEach(() => {
  // Restore the original fetch and API key after tests.
  globalThis.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalApiKey;
});

describe("sendChatRequest", () => {
  it("returns a MissingApiKey error when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const payload: ChatPayload = { model: "test-model", messages: [] };
    const result: ChatResult<unknown> = await sendChatRequest(payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("MissingApiKey");
    }
  });

  it("returns an HttpError when the response is not ok", async () => {
    // Stub fetch to simulate an HTTP error.
    globalThis.fetch = async (_url, _opts) => {
      return {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "error message",
      } as Response;
    };

    const payload: ChatPayload = {
      model: "test-model",
      messages: [{ role: "user", content: "test" }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "test_schema",
          strict: true,
          schema: {
            type: "object",
            properties: {
              result: { type: "string" },
            },
            required: ["result"],
            additionalProperties: false,
          },
        },
      },
    };

    const result: ChatResult<unknown> = await sendChatRequest(payload);

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.type === "HttpError") {
      expect(result.error.status).toBe(400);
      expect(result.error.statusText).toBe("Bad Request");
      expect(result.error.detail).toContain("error message");
    } else {
      // If the error is not an HttpError, fail the test.
      throw new Error("Expected an HttpError");
    }
  });

  it("returns success on an OK HTTP response", async () => {
    const mockResponseData = { id: "1", choices: [] };

    // Stub fetch to simulate a successful response.
    globalThis.fetch = async (_url, _opts) => {
      return {
        ok: true,
        json: async () => mockResponseData,
      } as Response;
    };

    const payload: ChatPayload = {
      model: "test-model",
      messages: [{ role: "user", content: "test" }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "test_schema",
          strict: true,
          schema: {
            type: "object",
            properties: {
              result: { type: "string" },
            },
            required: ["result"],
            additionalProperties: false,
          },
        },
      },
    };

    const result: ChatResult<unknown> = await sendChatRequest(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(mockResponseData);
    }
  });
});
