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

function ok<T>(value: T): ResultOk<T> {
  return { ok: true, value };
}

function err(message: string): ResultErr {
  return { ok: false, error: message };
}

interface Swatch {
  rgb: [number, number, number];
  population: number;
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

async function extractPalette(imageBuffer: Buffer): Promise<Result<Swatch[]>> {
  try {
    const vibrantPalette = await Vibrant.from(imageBuffer).getPalette();
    // Transform Vibrant's object into an array of { rgb, population }
    const swatches: Swatch[] = Object.values(vibrantPalette)
      .filter((sw) => sw !== null)
      .map((sw) => ({
        rgb: sw!.rgb as [number, number, number],
        population: sw!.population,
      }));

    if (swatches.length === 0) {
      return err("No swatches found.");
    }

    return ok(swatches);
  } catch (e: any) {
    return err(`Error extracting palette: ${String(e)}`);
  }
}

function hasColorOutliers(swatches: Swatch[]): boolean {
  if (swatches.length === 0) {
    return true;
  }

  // Example: brightness-based checks
  const brightnesses = swatches.map(({ rgb: [r, g, b] }) => (r + g + b) / 3);
  const minBrightness = Math.min(...brightnesses);
  const maxBrightness = Math.max(...brightnesses);

  // - If the range is too large, treat as outlier
  // - If extremely dark or bright, treat as outlier
  if (maxBrightness - minBrightness > 200) return true;
  if (minBrightness < 10 || maxBrightness > 245) return true;

  return false;
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

test("stitch color palettes from 10 URLs", async () => {
  const n = 10;
  const searchTerm = "giraffes";
  const urls = await scrapeBingImages(searchTerm, n);
  expect(urls.length).toBeGreaterThanOrEqual(1);

  const finalImages: Buffer[] = [];

  for (const url of urls) {
    const fetchResult = await fetchImageBuffer(url);
    if (!fetchResult.ok) continue;

    const paletteResult = await extractPalette(fetchResult.value);
    if (!paletteResult.ok) continue;

    if (hasColorOutliers(paletteResult.value)) continue;

    const downsampleResult = await downsample(fetchResult.value, 800);
    if (!downsampleResult.ok) continue;

    const stretchedResult = await stretchToSize(downsampleResult.value, 200, 200);
    if (!stretchedResult.ok) continue;

    finalImages.push(stretchedResult.value);
  }

  if (finalImages.length === 0)
    throw new Error("No valid images remained after outlier checks and resizing.");


  const stitchedResult = await stitchHorizontally(finalImages, 200, 200);
  if (!stitchedResult.ok)
    throw new Error(`Failed to stitch images: ${stitchedResult.error}`);

  const finalPaletteResult = await extractPalette(stitchedResult.value);
  if (!finalPaletteResult.ok)
    throw new Error(`Could not extract palette from stitched image: ${finalPaletteResult.error}`);

  const swatches = finalPaletteResult.value;
  expect(swatches.length).toBeGreaterThan(0);
}, 20000);
