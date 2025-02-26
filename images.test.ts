import { test, expect } from "bun:test";
import { scrapeBingImages } from "./images";
import sharp from 'sharp';
import { Vibrant } from "node-vibrant/node";

test.skip("searches bing", async () => {
  const n = 2;
  const urls = await scrapeBingImages("giraffes", n);
  expect(urls.length).toBe(n);
  expect(urls).toMatchInlineSnapshot(`
    [
      "https://images.pexels.com/photos/1619507/pexels-photo-1619507.jpeg?cs=srgb&dl=animal-animal-photography-giraffe-1619507.jpg&fm=jpg",
      "https://images.pexels.com/photos/730185/pexels-photo-730185.jpeg?cs=srgb&dl=giraffe-730185.jpg&fm=jpg",
    ]
  `);

  const urlStats = [];
  let promises = urls.map(async (url: any, i: number) => {
    const resp = await Bun.fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    return `${i + 1} - status: ${resp.status}, size: ${arrayBuffer.byteLength} bytes`;
  });

  const results =
    (await Promise.allSettled(promises))
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

  expect(results).toMatchInlineSnapshot(`
    [
      "1 - status: 200, size: 763435 bytes",
      "2 - status: 200, size: 240742 bytes",
    ]
  `);
});

test.skip("fetch color palette reference", async () => {
  const url = "https://upload.wikimedia.org/wikipedia/commons/0/03/Trending_colors_2017.png";
  const palette = await Vibrant.from(url).getPalette();
  const populations = [
    palette.Vibrant?.population,
    palette.Muted?.population,
    palette.DarkVibrant?.population,
    palette.DarkMuted?.population,
    palette.LightVibrant?.population,
    palette.LightMuted?.population,
  ];
  expect(`${populations}`).toMatchInlineSnapshot(`"4200,4200,0,4284,0,168"`);
  const hexs = [
    palette.Vibrant?.hex,
    palette.Muted?.hex,
    palette.DarkVibrant?.hex,
    palette.DarkMuted?.hex,
    palette.LightVibrant?.hex,
    palette.LightMuted?.hex,
  ];
  expect(`${hexs}`).toMatchInlineSnapshot(`"#f4d45c,#5484a4,#7c6308,#2c3444,#f6de82,#b4b470"`);
});

type ResultOk<T> = { ok: true; value: T };
type ResultErr = { ok: false; error: string };
type Result<T> = ResultOk<T> | ResultErr;

function ok(value: ColorInfo): ResultOk<ColorInfo> {
  return { ok: true, value };
  ReadableLight1: ColorInfo | null;
  ReadableLight2: ColorInfo | null;
  ReadableDark1: ColorInfo | null;
  ReadableDark2: ColorInfo | null;
  ReadableLight1: ColorInfo | null;
  ReadableLight2: ColorInfo | null;
  ReadableDark1: ColorInfo | null;
  ReadableDark2: ColorInfo | null;
}

function err(message: string): ResultErr {
  return { ok: false, error: message };
}

async function fetchImageBuffer(url: string): Promise<Result<Buffer>> {
  try {
    const response = await Bun.fetch(url);
    if (!response.ok) {
      return err(`Fetch failed for ${url}, status: ${response.status}`);
    }

    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    return ok(buffer);
  } catch (e: any) {
    return err(`Error fetching ${url}: ${String(e)}`);
  }
}

/**
 * 6) Minor downsampling step to limit max dimensions
 *    This helps avoid huge images in memory. We'll maintain aspect ratio here.
 *    If you want to force cropping or squashing, see the next function.
 */
async function downsample(
  buffer: Buffer,
  maxDimension: number
): Promise<Result<Buffer>> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return err("Missing metadata (width/height).");
    }

    // Only downsample if it's bigger than maxDimension
    const w = metadata.width;
    const h = metadata.height;

    if (w <= maxDimension && h <= maxDimension) {
      // No need to resize
      return ok(buffer);
    }

    // Keep aspect ratio, so figure out the scaling
    const scale = Math.min(maxDimension / w, maxDimension / h);
    const newWidth = Math.round(w * scale);
    const newHeight = Math.round(h * scale);

    const resized = await sharp(buffer)
      .resize(newWidth, newHeight, { fit: "inside" })
      .toBuffer();

    return ok(resized);
  } catch (e: any) {
    return err(`Downsample error: ${String(e)}`);
  }
}

/**
 * 7) Force a specific width/height by squashing or stretching
 *    using fit: 'fill'. This ignores aspect ratio.
 */
async function stretchToSize(
  buffer: Buffer,
  width: number,
  height: number
): Promise<Result<Buffer>> {
  try {
    const resized = await sharp(buffer)
      .resize(width, height, { fit: "fill" }) // force squashing/stretching
      .toBuffer();
    return ok(resized);
  } catch (e: any) {
    return err(`Stretch error: ${String(e)}`);
  }
}

/**
 * 8) Stitch images horizontally at a fixed size
 *    This expects all buffers to have the same width/height already.
 *    If they differ, you can unify them here or do it beforehand.
 */
async function stitchHorizontally(
  buffers: Buffer[],
  eachWidth: number,
  eachHeight: number
): Promise<Result<Buffer>> {
  if (buffers.length === 0) {
    return err("No buffers to stitch.");
  }

  try {
    // Create a blank "canvas" with totalWidth = eachWidth * #images
    const totalWidth = eachWidth * buffers.length;

    let base = sharp({
      create: {
        width: totalWidth,
        height: eachHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    });

    const compositeArray = [];
    let currentLeft = 0;

    // Build composite instructions
    for (const buf of buffers) {
      compositeArray.push({
        input: buf,
        left: currentLeft,
        top: 0,
      });
      currentLeft += eachWidth;
    }

    // Composite them side by side
    const stitched = await base.composite(compositeArray).png().toBuffer();
    return ok(stitched);
  } catch (e: any) {
    return err(`Stitching error: ${String(e)}`);
  }
}

export function removeLightnessOutlier(
  dataset: any[],
  getLightness: (d: any) => number,
  threshold: number = 2 // Defaulting to 2 standard deviations for a reasonable detection
): void {
  if (dataset.length === 0) {
    return; // Nothing to remove if dataset is empty
  }

  // 1. Extract lightness values using the provided getLightness function
  const lightnessValues = dataset.map(getLightness);

  // 2. Compute the mean (average) of the lightness values
  const mean = lightnessValues.reduce((sum, l) => sum + l, 0) / lightnessValues.length;

  // 3. Compute variance and standard deviation
  const variance = lightnessValues.reduce((acc, l) => acc + Math.pow(l - mean, 2), 0) / lightnessValues.length;
  const stdDev = Math.sqrt(variance);

  // 4. Remove outliers in place (iterating from the end to avoid index shifts)
  for (let i = dataset.length - 1; i >= 0; i--) {
    const lightness = getLightness(dataset[i]);
    const distance = Math.abs(lightness - mean);

    if (distance > threshold * stdDev) {
      dataset.splice(i, 1); // Remove outlier
    }
  }
}

async function sharpComposite(swatches: { rgb: [number, number, number] }[]): Promise<sharp.Sharp> {
  const swatchImages = swatches.map(({ rgb }) => {
    return sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: rgb[0], g: rgb[1], b: rgb[2] },
      },
    }).png().toBuffer();
  });

  const swatchBuffers = await Promise.all(swatchImages);

  return sharp({
    create: {
      width: 100 * swatchBuffers.length,
      height: 100,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(swatchBuffers.map((buffer, index) => ({
      input: buffer,
      left: index * 100,
      top: 0,
    })));
}

test.skip("stitch color palettes from 10 URLs", async () => {
  const n = 3;
  const searchTerm = "black and white";
  const urls = await scrapeBingImages(searchTerm, n);
  const swatches = [];
  for (const url of urls) {
    try {
      const resp = await Bun.fetch(url);
      const arrayBuffer = await resp.arrayBuffer();

      const palette = await Vibrant.from(Buffer.from(arrayBuffer)).getPalette();
      const paletteSwatches = [
        palette.Vibrant,
        palette.Muted,
        palette.DarkVibrant,
        palette.DarkMuted,
        palette.LightVibrant,
        palette.LightMuted,
      ];
      // expect(`${hexs}`).toMatchInlineSnapshot(`"#f4d45c,#5484a4,#7c6308,#2c3444,#f6de82,#b4b470"`);
      for (const swatch of paletteSwatches) {
        if (swatch) swatches.push(swatch);
      }
    } catch (err) {
      continue
    }
  }

  removeLightnessOutlier(swatches, (s: any) => s.hsl[2], 1.2);
  swatches.sort((a, b) => {
    if (a.hsl[0] !== b.hsl[0]) return a.hsl[0] - b.hsl[0];
    if (a.hsl[2] !== b.hsl[2]) return a.hsl[2] - b.hsl[2];
    return a.hsl[1] - b.hsl[1];
  });

  // // Create an image from the swatches
  const composite = await sharpComposite(swatches);
  const buffer = await composite.png().toBuffer();
  const palette = await Vibrant.from(buffer).getPalette();
  const final = await sharpComposite([
    palette.Vibrant,
    palette.Muted,
    palette.DarkVibrant,
    palette.DarkMuted,
    palette.LightVibrant,
    palette.LightMuted,
  ].filter(s => s !== null));

  // Optionally, write to file to review.
  // await final
  //   .png()
  //   .toFile('swatch_palette.png');

}, 20000);

// Define interfaces for the color palette
interface ColorInfo {
  hex: string;
  population: number;
}

interface PaletteColors {
  Vibrant: ColorInfo | null;
  Muted: ColorInfo | null;
  DarkVibrant: ColorInfo | null;
  DarkMuted: ColorInfo | null;
  LightVibrant: ColorInfo | null;
  LightMuted: ColorInfo | null;
  ReadableLight1: ColorInfo | null;
  ReadableLight2: ColorInfo | null;
  ReadableDark1: ColorInfo | null;
  ReadableDark2: ColorInfo | null;
}

type ColorVariant = keyof PaletteColors;
type ThemeMode = 'dark' | 'light';

// Refactored palette class with proper TypeScript types
class CustomPalette {
  private colors: Record<ColorVariant, ColorInfo | null>;

  constructor(vibrantPalette: Record<string, any>) {
    this.colors = {
      Vibrant: vibrantPalette.Vibrant ? { hex: vibrantPalette.Vibrant.hex, population: vibrantPalette.Vibrant.population } : null,
      Muted: vibrantPalette.Muted ? { hex: vibrantPalette.Muted.hex, population: vibrantPalette.Muted.population } : null,
      DarkVibrant: vibrantPalette.DarkVibrant ? { hex: vibrantPalette.DarkVibrant.hex, population: vibrantPalette.DarkVibrant.population } : null,
      DarkMuted: vibrantPalette.DarkMuted ? { hex: vibrantPalette.DarkMuted.hex, population: vibrantPalette.DarkMuted.population } : null,
      LightVibrant: vibrantPalette.LightVibrant ? { hex: vibrantPalette.LightVibrant.hex, population: vibrantPalette.LightVibrant.population } : null,
      LightMuted: vibrantPalette.LightMuted ? { hex: vibrantPalette.LightMuted.hex, population: vibrantPalette.LightMuted.population } : null,
      ReadableLight1: vibrantPalette.LightMuted ? this.adjustLightness(vibrantPalette.LightMuted, 0.1) : null,
      ReadableLight2: vibrantPalette.LightMuted ? this.adjustLightness(vibrantPalette.LightMuted, 0.2) : null,
      ReadableDark1: vibrantPalette.DarkMuted ? this.adjustLightness(vibrantPalette.DarkMuted, 0.1) : null,
      ReadableDark2: vibrantPalette.DarkMuted ? this.adjustLightness(vibrantPalette.DarkMuted, 0.2) : null,
    };
  }

  private adjustLightness(color: ColorInfo, amount: number): ColorInfo {
    const hsl = this.hexToHsl(color.hex);
    hsl[2] = Math.min(1, hsl[2] + amount); // Increase lightness
    return { hex: this.hslToHex(hsl), population: color.population };
  }

  private hexToHsl(hex: string): [number, number, number] {
    // Convert hex to HSL
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [h, s, l];
  }

  private hslToHex(hsl: [number, number, number]): string {
    // Convert HSL to hex
    const [h, s, l] = hsl;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = hue2rgb(p, q, h + 1 / 3);
    const g = hue2rgb(p, q, h);
    const b = hue2rgb(p, q, h - 1 / 3);

    return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
  }

  getColor(variants: ColorVariant[]): string {
    for (const variant of variants) {
      if (this.colors[variant]?.hex) {
        return this.colors[variant]!.hex;
      }
    }
    return "#000000"; // Fallback color
  }
}

// Color role definitions with proper typing
interface ColorRoleMapping {
  dark: ColorVariant[];
  light: ColorVariant[];
}

interface ColorRoles {
  [key: string]: ColorRoleMapping;
}

const COLOR_ROLES: ColorRoles = {
  primary: { dark: ["DarkMuted", "Muted"], light: ["LightVibrant", "Vibrant"] },
  secondary: { dark: ["Vibrant", "DarkVibrant"], light: ["Muted", "LightMuted"] },
  background: { dark: ["Muted", "Vibrant"], light: ["LightMuted", "LightVibrant"] },
  text: { dark: ["LightVibrant", "Vibrant"], light: ["DarkVibrant", "DarkMuted"] },
  page_bg: { dark: ["DarkMuted", "DarkVibrant"], light: ["LightVibrant", "LightMuted"] },
  user_message_bg: { dark: ["ReadableDark1", "DarkMuted"], light: ["ReadableLight1", "LightMuted"] },
  user_message_text: { dark: ["DarkVibrant", "DarkMuted"], light: ["LightVibrant", "Vibrant"] },
  assistant_message_bg: { dark: ["ReadableDark1", "DarkMuted"], light: ["ReadableLight1", "LightVibrant"] },
  assistant_message_text: { dark: ["LightMuted", "LightVibrant"], light: ["DarkMuted", "DarkVibrant"] },
  border: { dark: ["LightMuted", "Muted"], light: ["LightMuted", "LightVibrant"] },
  chat_bg: { dark: ["Muted", "DarkMuted"], light: ["LightMuted", "LightVibrant"] },
  header_bg: { dark: ["DarkVibrant", "Vibrant"], light: ["LightVibrant", "LightMuted"] },
  header_text: { dark: ["LightVibrant", "Vibrant"], light: ["DarkVibrant", "DarkMuted"] },
  send_button_bg: { dark: ["Vibrant", "LightVibrant"], light: ["Muted", "LightMuted"] },
  send_button_text: { dark: ["LightVibrant", "Vibrant"], light: ["DarkVibrant", "DarkMuted"] },
  attachment_button_bg: { dark: ["Muted", "DarkMuted"], light: ["LightMuted", "LightVibrant"] },
  attachment_button_text: { dark: ["DarkMuted", "DarkVibrant"], light: ["LightVibrant", "Vibrant"] },
  info_button_color: { dark: ["Vibrant", "DarkVibrant"], light: ["Muted", "LightMuted"] },
};

// CSS variable mapping with proper typing
type CssVariableName = keyof typeof CSS_COLOR_KEYS;
type ColorRole = keyof typeof COLOR_ROLES;

const CSS_COLOR_KEYS: Record<string, ColorRole> = {
  primary_color: "primary",
  secondary_color: "secondary",
  background_color: "background",
  text_color: "text",
  page_bg: "page_bg",
  user_message_background: "user_message_bg",
  user_message_text_color: "user_message_text",
  assistant_message_background: "assistant_message_bg",
  assistant_message_text_color: "assistant_message_text",
  border_color: "border",
  chat_background: "chat_bg",
  header_background: "header_bg",
  header_text_color: "header_text",
  send_button_bg: "send_button_bg",
  send_button_color: "send_button_text",
  attachment_button_bg: "attachment_button_bg",
  attachment_button_color: "attachment_button_text",
  info_button_color: "info_button_color",
};

// Function to select colors with proper typing
const selectColor = (
  customPalette: CustomPalette,
  role: ColorRole,
  mode: ThemeMode = "dark"
): string => {
  const variants = COLOR_ROLES[role][mode];
  return customPalette.getColor(variants);
};

// Function to generate CSS variables
const generateCSSVars = (
  palette: CustomPalette,
  mode: ThemeMode
): Record<string, string> => {
  return Object.entries(CSS_COLOR_KEYS).reduce((acc, [cssVar, role]) => {
    acc[cssVar] = selectColor(palette, role, mode);
    return acc;
  }, {} as Record<string, string>);
};

// Exported helper to generate a palette from an image URL
export const generatePaletteFromUrl = async (
  imageUrl: string
): Promise<{
  darkMode: Record<string, string>;
  lightMode: Record<string, string>;
}> => {
  const vibrantPalette = await Vibrant.from(imageUrl).getPalette();
  const customPalette = new CustomPalette(vibrantPalette);

  return {
    darkMode: generateCSSVars(customPalette, "dark"),
    lightMode: generateCSSVars(customPalette, "light")
  };
};

// Test implementation
const testPaletteGeneration = async () => {
  const url = "https://upload.wikimedia.org/wikipedia/commons/0/03/Trending_colors_2017.png";
  const { darkMode, lightMode } = await generatePaletteFromUrl(url);

  Bun.write("./testcolors.json", JSON.stringify(darkMode));

  // Test assertions
  expect(darkMode).toMatchInlineSnapshot(`
    {
      "assistant_message_background": "#f4d45c",
      "assistant_message_text_color": "#b4b470",
      "attachment_button_bg": "#5484a4",
      "attachment_button_color": "#2c3444",
      "background_color": "#5484a4",
      "border_color": "#2c3444",
      "chat_background": "#5484a4",
      "header_background": "#7c6308",
      "header_text_color": "#f6de82",
      "info_button_color": "#f4d45c",
      "page_bg": "#2c3444",
      "primary_color": "#2c3444",
      "secondary_color": "#f4d45c",
      "send_button_bg": "#f4d45c",
      "send_button_color": "#f6de82",
      "text_color": "#f6de82",
      "user_message_background": "#b4b470",
      "user_message_text_color": "#7c6308",
    }
  `);

  expect(lightMode).toMatchInlineSnapshot(`
    {
      "assistant_message_background": "#b4b470",
      "assistant_message_text_color": "#2c3444",
      "attachment_button_bg": "#b4b470",
      "attachment_button_color": "#f6de82",
      "background_color": "#b4b470",
      "border_color": "#b4b470",
      "chat_background": "#b4b470",
      "header_background": "#f6de82",
      "header_text_color": "#7c6308",
      "info_button_color": "#5484a4",
      "page_bg": "#f6de82",
      "primary_color": "#f6de82",
      "secondary_color": "#5484a4",
      "send_button_bg": "#5484a4",
      "send_button_color": "#7c6308",
      "text_color": "#7c6308",
      "user_message_background": "#5484a4",
      "user_message_text_color": "#f6de82",
    }
  `);
};

// For testing
test("format color palette into CSS variables with light/dark mode support", testPaletteGeneration);
