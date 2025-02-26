import { test, expect } from "bun:test";
import { downsample, scrapeBingImages } from "./images";
import sharp from 'sharp';
import { Vibrant } from "node-vibrant/node";
import { sendPaletteRequest } from "./all";
import type { ChatMessageContent } from "./chat";

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

test("combine to one and gpt analyze", async () => {
  const n = 4;
  const searchTerm = "superman color palette";
  const imageUrls = await scrapeBingImages(searchTerm, n);

  const promises = imageUrls.map((url) =>
    Bun.fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => Buffer.from(b))
      .then((b) => downsample(b, 300))
  );

  const buffers = await Promise.allSettled(promises)
    .then((rs) =>
      rs
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((r) => r.ok)
        .map((r) => r.value)
    );

  const stitchedResult = await stitchHorizontallyAlpha(buffers);
  if (!stitchedResult.ok) throw new Error(`${stitchedResult.error}`);

  const stitchedBuffer = await stitchedResult.value.toBuffer();
  const base64Image = `data:image/png;base64,${stitchedBuffer.toString("base64")}`;

  const urls: ChatMessageContent[] = [
    { type: "image_url", image_url: { url: base64Image, detail: "low" } },
  ];

  let css = await sendPaletteRequest(urls).then((r) => {
    if (!r.ok) throw new Error(`${JSON.stringify(r.error)}`);
    return r.value;
  });

  Bun.write("./testcolors.json", JSON.stringify(css.ui_changes));
}, 30000);


async function stitchHorizontallyAlpha(
  buffers: Buffer[]
): Promise<Result<sharp.Sharp>> {
  if (buffers.length === 0) {
    return err("No buffers to stitch.");
  }

  try {
    // Load all images and get their metadata
    const images = await Promise.all(buffers.map(buf => sharp(buf).metadata()));

    // Calculate total width and max height
    const totalWidth = images.reduce((sum, img) => sum + (img.width || 0), 0);
    const maxHeight = Math.max(...images.map(img => img.height || 0));

    let base = sharp({
      create: {
        width: totalWidth,
        height: maxHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Fully transparent
      },
    });

    const compositeArray = [];
    let currentLeft = 0;

    // Build composite instructions without stretching
    for (let i = 0; i < buffers.length; i++) {
      compositeArray.push({
        input: buffers[i],
        left: currentLeft,
        top: Math.floor((maxHeight - (images[i].height || 0)) / 2), // Center vertically
      });
      currentLeft += images[i].width || 0;
    }

    // Composite them side by side
    const stitched = base.composite(compositeArray).png();
    return ok(stitched);
  } catch (e: any) {
    return err(`Stitching error: ${String(e)}`);
  }
}
