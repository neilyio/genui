import { describe, it, expect } from "bun:test";

/**
 * Simple Result Type for "railroad-oriented" style returns.
 */
export type FontResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: FontError };

/**
 * Enumerated errors for Google Font fetching.
 */
export type FontError =
  | { type: "InvalidFontName" }
  | { type: "InvalidParameters" }
  | { type: "RequestFailed" }
  | { type: "FallbackFailed" };

/**
 * Options to customize the font URL.
 * You can expand this as needed.
 */
export interface FontOptions {
  weights?: Array<number | string>; // e.g. [400, 700, "italic", "bolditalic"]
  subsets?: string[];              // e.g. ["latin", "cyrillic", "greek"]
  display?: string;                // e.g. "swap", "fallback", etc.
  text?: string;                   // e.g. "Hello World"
  effects?: string[];             // e.g. ["shadow-multiple", "3d-float"]
}

/**
 * Build a Google Fonts URL from the font name and options.
 * Returns a plain string (assumes valid input).
 */
export function buildGoogleFontsUrl(
  rawFontName: string,
  options: FontOptions
): string {
  // Trim the raw font name and replace spaces with '+'
  const familyName = rawFontName.trim().replace(/\s+/g, "+");

  // We'll build up the "family=" parameter with optional weights/effects
  let familyParam = familyName;

  // If weights are specified, e.g. [400, 700, "i", "bolditalic"]
  // these can be appended like: "Open+Sans:400,700,italic,bolditalic"
  if (options.weights && options.weights.length > 0) {
    // Convert each weight to the string version, e.g. 700 -> "700"
    const weightsList = options.weights.map(String).join(",");
    familyParam += `:${weightsList}`;
  }

  // Start constructing the base URL
  // Example: https://fonts.googleapis.com/css?family=Open+Sans:400,700
  let url = `https://fonts.googleapis.com/css?family=${familyParam}`;

  // If subsets are specified
  if (options.subsets && options.subsets.length > 0) {
    url += `&subset=${options.subsets.join(",")}`;
  }

  // If display= is specified
  if (options.display) {
    url += `&display=${encodeURIComponent(options.display)}`;
  }

  // If text= is specified
  if (options.text) {
    url += `&text=${encodeURIComponent(options.text)}`;
  }

  // If effects= are specified (in Google Fonts "beta" features)
  if (options.effects && options.effects.length > 0) {
    url += `&effect=${options.effects.join("|")}`;
  }

  return url;
}

/**
 * Fetch the Google Fonts CSS from the built URL, returning a Result.
 * This will try a fallback if the primary fetch fails.
 *
 * - If we fail to fetch from the main URL, we try the fallback URL.
 * - If that fails too, we return { ok: false, error: FontError.FallbackFailed }.
 */
export async function fetchGoogleFontCSS(
  fontName: string,
  options: FontOptions,
  fallbackFontName: string = "Roboto" // some known fallback
): Promise<FontResult<string>> {
  // Basic validation
  if (!fontName || !fontName.trim()) {
    return { ok: false, error: { type: "InvalidFontName" } };
  }

  // Build primary URL
  const primaryUrl = buildGoogleFontsUrl(fontName, options);

  // Try to fetch from the primary URL
  let response: Response;
  try {
    response = await Bun.fetch(primaryUrl);
  } catch (err) {
    // If fetch threw, let's skip directly to fallback
    return await fetchFallbackCSS(fallbackFontName, options);
  }

  if (!response.ok) {
    // If we got a non-OK response, fallback
    return await fetchFallbackCSS(fallbackFontName, options);
  }

  const css = await response.text();
  // If we get something that looks invalid or empty, try fallback
  if (!css || !css.includes("font-family")) {
    // We can decide what "invalid" means. For simplicity, let's fallback
    return await fetchFallbackCSS(fallbackFontName, options);
  }

  // If all good, we succeed
  return { ok: true, value: css };
}

/**
 * Helper to fetch the fallback font if the primary request fails.
 */
async function fetchFallbackCSS(
  fallbackFontName: string,
  options: FontOptions
): Promise<FontResult<string>> {
  const fallbackUrl = buildGoogleFontsUrl(fallbackFontName, options);

  let response: Response;
  try {
    response = await Bun.fetch(fallbackUrl);
  } catch (err) {
    // Fallback fetch also failed entirely
    return { ok: false, error: { type: "FallbackFailed" } };
  }

  if (!response.ok) {
    return { ok: false, error: { type: "FallbackFailed" } };
  }

  const css = await response.text();
  if (!css || !css.includes("font-family")) {
    return { ok: false, error: { type: "FallbackFailed" } };
  }

  return { ok: true, value: css };
}

// ------------------ TESTS ------------------

describe("Google Font Fetching", () => {
  it("should build a URL for 'Open Sans' with some parameters", () => {
    const options: FontOptions = {
      weights: [400, 700, "italic"],
      subsets: ["latin", "greek"],
      display: "swap",
      text: "Hello World!",
      effects: ["shadow-multiple", "3d-float"],
    };

    const url = buildGoogleFontsUrl("Open Sans", options);
    expect(url).toMatchInlineSnapshot(
      `\"https://fonts.googleapis.com/css?family=Open+Sans:400,700,italic&subset=latin,greek&display=swap&text=Hello%20World!&effect=shadow-multiple|3d-float\"`
    );
  });

  it("should fail gracefully if the font name is blank", async () => {
    const result = await fetchGoogleFontCSS("", {});
    expect(result).toMatchInlineSnapshot(`
{
  "error": {
    "type": "InvalidFontName",
  },
  "ok": false,
}
`);
  });

  it("should attempt to fetch from Google Fonts (no real network in snapshot test)", async () => {
    const options: FontOptions = {
      weights: [700],
      effects: ["shadow-multiple"],
    };

    // In a real network-enabled test, this would make a real fetch.
    // Here, let's see the immediate shape of the result object.
    // (You would mock fetch in a real unit test.)
    let result: FontResult<string>;

    try {
      // This can cause network I/O in a real environment.
      // In CI or offline test, you'd typically mock `fetch`.
      result = await fetchGoogleFontCSS("Open Sans", options);
    } catch (e) {
      // If you're offline or if fetch isn't available, we'll simulate
      // the fallback by returning manually.
      result = { ok: false, error: { type: "RequestFailed" } };
    }

    // Show shape in snapshot
    expect(result).toMatchInlineSnapshot(`
{
  "ok": true,
  "value": 
"@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 700;
  font-stretch: normal;
  src: url(https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsg-1x4gaVc.ttf) format('truetype');
}
"
,
}
`);
  });

  it("should demonstrate fallback logic", async () => {
    // Force it to fail by providing a nonsense domain or parameters
    // so we can see fallback come into play. If fetch truly fails,
    // we should see a FallbackFailed or we see fallback success if Roboto is fetched.
    const result = await fetchGoogleFontCSS("ImaginaryFontNameThatDoesNotExist", {
      weights: [9999],
    });

    expect(result).toMatchInlineSnapshot(`
{
  "error": {
    "type": "FallbackFailed",
  },
  "ok": false,
}
`);
  });
});
