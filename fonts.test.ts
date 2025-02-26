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

export interface FontOptions {
  weights?: Array<number | string>; // e.g. [400, 700, "italic", "bolditalic"]
  italics?: Array<{ italic: 0 | 1; weight: number }>; // e.g. [{ italic: 0, weight: 400 }, { italic: 1, weight: 700 }]
  axes?: Record<string, string | number>; // e.g. { wght: "200..900", ital: 1 }
  subsets?: string[]; // e.g. ["latin", "cyrillic", "greek"]
  display?: string; // e.g. "swap", "fallback", etc.
  text?: string; // e.g. "Hello World"
  effects?: string[]; // e.g. ["shadow-multiple", "3d-float"]
}

/**
 * Builds the new Google Fonts API v2 URL with effects support.
 */
export function buildGoogleFontsUrl(
  fontNames: string | string[],
  options: FontOptions
): string {
  // Ensure it's an array
  const fontList = Array.isArray(fontNames) ? fontNames : [fontNames];

  // Convert each font into the correct format
  const familyParams = fontList.map((font) => {
    let formattedFont = font.trim().replace(/\s+/g, "+");

    // Handle weights (if specified)
    const weightParam = options.weights && options.weights.length > 0
      ? `wght@${options.weights.join(";")}`
      : "";

    // Handle variable font axes (if specified)
    const axesParam = options.axes && Object.keys(options.axes).length > 0
      ? Object.entries(options.axes)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically
        .map(([key, value]) => `${key}@${value}`)
        .join(";")
      : "";

    // If both weights and axes exist, merge them
    const params = [weightParam, axesParam].filter(Boolean).join(";");

    if (params) {
      formattedFont += `:${params}`;
    }

    return `family=${formattedFont}`;
  });

  let url = `https://fonts.googleapis.com/css2?${familyParams.join("&")}`;

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

  // If effects are specified (only available for some fonts)
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
    console.log("RESPONSE", response);
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
      `"https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700;italic&subset=latin,greek&display=swap&text=Hello%20World!&effect=shadow-multiple|3d-float"`);
    expect(url).toMatchInlineSnapshot(
      `"https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700;italic&subset=latin,greek&display=swap&text=Hello%20World!&effect=shadow-multiple|3d-float"`);
  });

  it("should fail gracefully if the font name is blank", async () => {
    const primaryUrl = buildGoogleFontsUrl("", {});
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family="`);
    const fallbackUrl = buildGoogleFontsUrl("Roboto", {});
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);
    expect(result).toMatchInlineSnapshot(`
{
  "ok": true,
  "value": 
"@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  font-stretch: normal;
  src: url(https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf) format('truetype');
}
"
,
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
  "value": "https://fonts.googleapis.com/css2?family=Open+Sans:wght@700",
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
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Open+Sans:wght@700&effect=shadow-multiple"`);
    const fallbackUrl = buildGoogleFontsUrl("Roboto", options);
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto:wght@700&effect=shadow-multiple"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);

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
  src: url(https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsg-1y4n.ttf) format('truetype');
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
    const primaryUrl = buildGoogleFontsUrl("ImaginaryFontNameThatDoesNotExist", {
      weights: [9999],
    });
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=ImaginaryFontNameThatDoesNotExist:wght@9999"`);
    const fallbackUrl = buildGoogleFontsUrl("Roboto", {
      weights: [9999],
    });
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto:wght@9999"`);
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
      weights: ["100"],
    };

    const primaryUrl = buildGoogleFontsUrl("Open Sans", options);
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Open+Sans:wght@100"`);
    const fallbackUrl = buildGoogleFontsUrl("Roboto", options);
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto:wght@100"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);

    expect(result).toMatchInlineSnapshot(`
      {
        "ok": true,
        "value": 
      "@font-face {
        font-family: 'Roboto';
        font-style: normal;
        font-weight: 100;
        font-stretch: normal;
        src: url(https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf) format('truetype');
      }
      "
      ,
      }
    `);
  });

  const GOOGLE_FONTS_METADATA_URL = "https://fonts.google.com/metadata/fonts";

  /**
   * Fetch Google Fonts metadata.
   */
  async function fetchGoogleFontsMetadata() {
    const response = await Bun.fetch(GOOGLE_FONTS_METADATA_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Fonts metadata: ${response.statusText}`);
    }

    let text = await response.text();

    // Remove Google's anti-JSON security prefix `)]}'
    text = text.replace(/^\)\]\}'/, "");

    return JSON.parse(text);
  }


  /**
   * Extract supported weights for a font.
   */
  async function getFontWeights(fontName: string) {
    const data = await fetchGoogleFontsMetadata();

    const fontData = data.familyMetadataList.find(
      (font: any) => font.family.toLowerCase() === fontName.toLowerCase()
    );

    if (!fontData) {
      return null; // Font not found
    }

    return Object.keys(fontData.fonts).map((w) => (w.includes("i") ? `${w} italic` : w));
  }

  /**
   * Jest Tests
   */
  describe("Google Fonts Metadata", () => {

    it("should retrieve supported weights for Open Sans", async () => {
      const weights = await getFontWeights("Open Sans");
      expect(weights).toMatchInlineSnapshot(`
        [
          "300",
          "400",
          "500",
          "600",
          "700",
          "800",
          "300i italic",
          "400i italic",
          "500i italic",
          "600i italic",
          "700i italic",
          "800i italic",
        ]
      `);
    });

    it("should retrieve supported weights for Roboto", async () => {
      const weights = await getFontWeights("Roboto");
      expect(weights).toMatchInlineSnapshot(`
        [
          "100",
          "200",
          "300",
          "400",
          "500",
          "600",
          "700",
          "800",
          "900",
          "100i italic",
          "200i italic",
          "300i italic",
          "400i italic",
          "500i italic",
          "600i italic",
          "700i italic",
          "800i italic",
          "900i italic",
        ]
      `);
    });
  });
});
