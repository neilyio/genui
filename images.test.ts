import { test, expect } from "bun:test";
import { downsample, processChatMessageFlow, scrapeBingImages, stitchHorizontallyAlpha } from "./images";
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

test.skip("combine to one and gpt analyze", async () => {
  // This test is now redundant as the logic has been moved to processChatMessageFlow
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
  if (!stitchedResult.ok) throw stitchedResult.error;

  const stitchedBuffer = await stitchedResult.value.toBuffer();
  const base64Image = `data:image/png;base64,${stitchedBuffer.toString("base64")}`;

  const urls: ChatMessageContent[] = [
    { type: "image_url", image_url: { url: base64Image, detail: "low" } },
  ];

  let css = await sendPaletteRequest(urls).then((r) => {
    if (!r.ok) throw new Error(`${JSON.stringify(r.error)}`);
    return r.value;
  });

  expect(css).toMatchInlineSnapshot(`
    {
      "ui_changes": {
        "assistant_message_background": "#F2F2F2",
        "assistant_message_border_color": "#B0B0B0",
        "assistant_message_text_color": "#1A1A1A",
        "attachment_button_bg": "#1A4D9B",
        "attachment_button_color": "#FFFFFF",
        "background_color": "#F2F2F2",
        "border_color": "#CCCCCC",
        "button_icon_color": "#FFFFFF",
        "chat_background": "#F9F9F9",
        "header_background": "#1A4D9B",
        "header_text_color": "#FFFFFF",
        "info_button_color": "#1A4D9B",
        "input_background": "#E6E6E6",
        "page_bg": "#FFFFFF",
        "primary_color": "#1A4D9B",
        "secondary_color": "#C72C3B",
        "send_button_bg": "#C72C3B",
        "send_button_color": "#FFFFFF",
        "text_color": "#1A1A1A",
        "user_message_background": "#C72C3B",
        "user_message_border_color": "#A52A2A",
        "user_message_text_color": "#FFFFFF",
      },
    }
  `);
}, 30000);

test("color processing flow", async () => {
  const contents: ChatMessageContent[] = [
    { type: "text", text: "superman color palette" }
  ];

  const result = await processChatMessageFlow(contents);

  if (!result.ok) {
    throw new Error(`Flow processing failed: ${result.error}`);
  }

  expect(result.value.imageUrls).toMatchInlineSnapshot(`
    Array [
      "https://images.pexels.com/photos/1619507/pexels-photo-1619507.jpeg?cs=srgb&dl=animal-animal-photography-giraffe-1619507.jpg&fm=jpg",
      "https://images.pexels.com/photos/730185/pexels-photo-730185.jpg?cs=srgb&dl=giraffe-730185.jpg&fm=jpg",
    ]
  `);

  expect(result.value.base64Images).toMatchInlineSnapshot(`
    Array [
      123456, // Example size in bytes
      789012, // Example size in bytes
      // Add more sizes as needed
    ]
  `);

  expect(result.value.stitchedImage).toMatchInlineSnapshot(`"data:image/png;base64,..."`);

  expect(result.value.ui_changes).toMatchInlineSnapshot(`
    {
      "ui_changes": {
        "assistant_message_background": "#F2F2F2",
        "assistant_message_border_color": "#CCCCCC",
        "assistant_message_text_color": "#1A1A1A",
        "attachment_button_bg": "#C72C41",
        "attachment_button_color": "#FFFFFF",
        "background_color": "#F2F2F2",
        "border_color": "#CCCCCC",
        "button_icon_color": "#FFFFFF",
        "chat_background": "#F9F9F9",
        "header_background": "#1A4D9B",
        "header_text_color": "#FFFFFF",
        "info_button_color": "#1A4D9B",
        "input_background": "#E6E6E6",
        "page_bg": "#FFFFFF",
        "primary_color": "#1A4D9B",
        "secondary_color": "#C72C41",
        "send_button_bg": "#1A4D9B",
        "send_button_color": "#FFFFFF",
        "text_color": "#1A1A1A",
        "user_message_background": "#C72C41",
        "user_message_border_color": "#A52A2A",
        "user_message_text_color": "#FFFFFF",
      },
    }
  `);
}, 30000);
