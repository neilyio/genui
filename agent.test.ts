import { test, beforeEach, afterEach } from "bun:test";

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

test("color agent", async () => {
  //
})
