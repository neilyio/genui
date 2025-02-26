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
export async function getFontWeights(fontName: string) {
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
 * Builds the new Google Fonts API v2 URL with effects support.
 */
export async function buildGoogleFontsUrl(fontNames: string | string[]): Promise<string> {
  // Ensure fontNames is an array
  const fontList = Array.isArray(fontNames) ? fontNames : [fontNames];

  // Fetch available font weights for each font
  const fontDataPromises = fontList.map(async (font) => {
    const weights = await getFontWeights(font);

    if (!weights || weights.length === 0) {
      return null; // Skip if no weights found
    }

    let formattedFont = font.trim().replace(/\s+/g, "+");

    // Extract italic and non-italic weights
    const italicWeights = weights
      .filter((w) => w.includes("italic"))
      .map((w) => parseInt(w.replace("i", "").replace(" italic", ""), 10)) // Ensure conversion to numbers
      .filter((w) => !isNaN(w)); // Remove invalid values

    const regularWeights = weights
      .filter((w) => !w.includes("italic"))
      .map((w) => parseInt(w, 10)) // Ensure conversion to numbers
      .filter((w) => !isNaN(w)); // Remove invalid values

    // Ensure numeric sorting
    regularWeights.sort((a, b) => a - b);
    italicWeights.sort((a, b) => a - b);

    let fontParams = [];

    // Handle regular and italic weights together in a valid format
    if (regularWeights.length > 0 || italicWeights.length > 0) {
      const weightPairs: string[] = [];

      if (regularWeights.length > 0) {
        weightPairs.push(`0,${regularWeights.join(";0,")}`);
      }

      if (italicWeights.length > 0) {
        weightPairs.push(`1,${italicWeights.join(";1,")}`);
      }

      fontParams.push(`ital,wght@${weightPairs.join(";")}`);
    }

    if (fontParams.length > 0) {
      formattedFont += `:${fontParams.join(";")}`;
    }

    return `family=${formattedFont}`;
  });

  // Resolve all font weight queries
  const familyParams = (await Promise.all(fontDataPromises)).filter(Boolean);

  let url = `https://fonts.googleapis.com/css2?${familyParams.join("&")}`;

  // Ensure aggressive retrieval of available styles
  url += `&display=swap`;

  return url;
}

/**
 * Parses Google Fonts CSS and extracts a compact summary of available styles and weights.
 * 
 * @param cssText - The raw CSS string from the Google Fonts API.
 * @returns A compact summary string of available styles and weights.
 */
export function parseGoogleFontCSS(cssText: string): string {
  const fontMap: Record<string, Set<string>> = {};

  // Regex to extract @font-face properties
  const fontFaceRegex =
    /@font-face\s*{[^}]*?font-family:\s*'([^']+)';[^}]*?font-style:\s*(\w+);[^}]*?font-weight:\s*(\d+);/g;

  let match;
  while ((match = fontFaceRegex.exec(cssText)) !== null) {
    const [, fontFamily, fontStyle, fontWeight] = match;
    const key = fontStyle === "italic" ? `italic ${fontWeight}` : fontWeight;

    if (!fontMap[fontFamily]) {
      fontMap[fontFamily] = new Set();
    }

    fontMap[fontFamily].add(key);
  }

  // Format the compact summary
  return Object.entries(fontMap)
    .map(([font, styles]) => `${font}: ${Array.from(styles).sort().join(", ")}`)
    .join(" | ");
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
