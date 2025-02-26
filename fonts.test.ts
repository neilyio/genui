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
 * Fetch the Google Fonts CSS from a given URL, returning a Result.
 * This will try a fallback URL if the primary fetch fails.
 */
export async function fetchGoogleFontCSS(
  primaryUrl: string,
  fallbackUrl: string
): Promise<FontResult<string>> {
  // Try to fetch from the primary URL
  let response: Response;
  try {
    response = await Bun.fetch(primaryUrl);
  } catch (err) {
    // If fetch threw, let's skip directly to fallback
    return await fetchFallbackCSS(fallbackUrl);
  }

  if (!response.ok) {
    // If we got a non-OK response, fallback
    return await fetchFallbackCSS(fallbackUrl);
  }

  const css = await response.text();
  // If we get something that looks invalid or empty, try fallback
  if (!css || !css.includes("font-family")) {
    return await fetchFallbackCSS(fallbackUrl);
  }

  // If all good, we succeed
  return { ok: true, value: css };
}

/**
 * Helper to fetch the fallback font from a given URL if the primary request fails.
 */
async function fetchFallbackCSS(fallbackUrl: string): Promise<FontResult<string>> {
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

/**
 * Build and return the Google Fonts URL for testing purposes.
 */
export function getGoogleFontsUrl(
  fontName: string,
  options: FontOptions
): FontResult<string> {
  if (!fontName || !fontName.trim()) {
    return { ok: false, error: { type: "InvalidFontName" } };
  }
  const url = buildGoogleFontsUrl(fontName, options);
  return { ok: true, value: url };
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
    expect(url).toMatchInlineSnapshot(
      `\"https://fonts.googleapis.com/css?family=Open+Sans:400,700,italic&subset=latin,greek&display=swap&text=Hello%20World!&effect=shadow-multiple|3d-float\"`
    );
  });

  it("should fail gracefully if the font name is blank", async () => {
    const primaryUrl = buildGoogleFontsUrl("", {});
    expect(primaryUrl).toMatchInlineSnapshot(`\"https://fonts.googleapis.com/css?family=\"`);
    const fallbackUrl = buildGoogleFontsUrl("Roboto", {});
    expect(fallbackUrl).toMatchInlineSnapshot(`\"https://fonts.googleapis.com/css?family=Roboto\"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);
    expect(result).toMatchInlineSnapshot(`
{
  "error": {
    "type": "FallbackFailed",
  },
  "ok": false,
}
`);
  });

  it("should build a valid URL for 'Open Sans' with weights", () => {
    const options: FontOptions = {
      weights: [700],
    };

    const result = getGoogleFontsUrl("Open Sans", options);
    expect(result).toMatchInlineSnapshot(`
{
  "ok": true,
  "value": "https://fonts.googleapis.com/css?family=Open+Sans:700",
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
    const primaryUrl = buildGoogleFontsUrl("Open Sans", options);
    expect(primaryUrl).toMatchInlineSnapshot(`\"https://fonts.googleapis.com/css?family=Open+Sans:700&effect=shadow-multiple\"`);
    const fallbackUrl = buildGoogleFontsUrl("Roboto", options);
    expect(fallbackUrl).toMatchInlineSnapshot(`\"https://fonts.googleapis.com/css?family=Roboto:700&effect=shadow-multiple\"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);

    // Show shape in snapshot
    expect(result).toMatchInlineSnapshot(`
{
  "error": {
    "type": "FallbackFailed",
  },
  "ok": false,
}
`);
  });

  it("should demonstrate fallback logic", async () => {
    // Force it to fail by providing a nonsense domain or parameters
    // so we can see fallback come into play. If fetch truly fails,
    // we should see a FallbackFailed or we see fallback success if Roboto is fetched.
    const primaryUrl = buildGoogleFontsUrl("ImaginaryFontNameThatDoesNotExist", {
      weights: [9999],
    });
    expect(primaryUrl).toMatchInlineSnapshot(`\"https://fonts.googleapis.com/css?family=ImaginaryFontNameThatDoesNotExist:9999\"`);
    const fallbackUrl = buildGoogleFontsUrl("Roboto", {
      weights: [9999],
    });
    expect(fallbackUrl).toMatchInlineSnapshot(`\"https://fonts.googleapis.com/css?family=Roboto:9999\"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);

    expect(result).toMatchInlineSnapshot(`
{
  "error": {
    "type": "FallbackFailed",
  },
  "ok": false,
}
`);
  });

  it("should fetch all font weights using a range in the URL", async () => {
    const options: FontOptions = {
      weights: ["wght@100..900"],
    };

    const primaryUrl = buildGoogleFontsUrl("Open Sans", options);
    expect(primaryUrl).toMatchInlineSnapshot(`\"https://fonts.googleapis.com/css?family=Open+Sans:wght@100..900\"`);
    const fallbackUrl = buildGoogleFontsUrl("Roboto", options);
    expect(fallbackUrl).toMatchInlineSnapshot(`\"https://fonts.googleapis.com/css?family=Roboto:wght@100..900\"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);

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
