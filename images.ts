/**
 * Scrape Bing Images using Fetch and DOMParser.
 * @param searchTerm The term to search for
 * @param numResults Number of image URLs to return
 */
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import { sendPaletteRequest } from "./all";
import type { ChatMessageContent } from "./chat";

export type ImageError =
  | { type: string; }

export type ImageResult<T> =
  | { ok: true; value: T }
  | { ok: false, error: ImageError };

export async function scrapeBingImages(searchTerm: string, numResults = 10): Promise<string[]> {
  try {
    const query = encodeURIComponent(searchTerm);
    const url = `https://www.bing.com/images/search?q=${query}&FORM=HDRSC2`;

    // Fetch the HTML content
    const response = await Bun.fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
      },
    });
    const html = await response.text();

    // Parse the response HTML
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Bing uses <a class="iusc" m="json..."> elements for image results
    const anchors = doc.querySelectorAll('a.iusc');
    const imageUrls: string[] = [];

    anchors.forEach((anchor) => {
      const mAttr = anchor.getAttribute('m');
      if (mAttr) {
        try {
          // 'm' is a JSON string containing info about the image, including "murl"
          const mData = JSON.parse(mAttr);
          if (mData.murl) {
            imageUrls.push(mData.murl);
          }
        } catch (err) {
          // If parsing fails, skip
        }
      }
    });

    // Return only the top numResults
    return imageUrls.slice(0, numResults);
  } catch (error) {
    console.error('Error fetching Bing Images:', error);
    return [];
  }
}

export async function fetchToBase64(url: string): Promise<string> {
  return Bun.fetch(url)
    .then(r => r.arrayBuffer())
    .then(b => Buffer.from(b))
    .then(b => downsample(b, 300).then(s => s.ok ? s.value : b))
    .then(b => `data:image/jpeg;base64,${b.toString('base64')}`);
}


export async function downsample(
  buffer: Buffer,
  maxDimension: number
): Promise<ImageResult<Buffer>> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return { ok: false, error: { type: "Missing metadata (width/height)." } }
    }

    // only downsample if it's bigger than maxdimension
    const w = metadata.width;
    const h = metadata.height;

    if (w <= maxDimension && h <= maxDimension) {
      // No need to resize
      return { ok: true, value: buffer };
    }

    // Keep aspect ratio, so figure out the scaling
    const scale = Math.min(maxDimension / w, maxDimension / h);
    const newWidth = Math.round(w * scale);
    const newHeight = Math.round(h * scale);

    const resized = await sharp(buffer)
      .resize(newWidth, newHeight, { fit: "inside" })
      .toBuffer();

    return { ok: true, value: resized };
  } catch (e: any) {
    return { ok: false, error: { type: `Downsample error: ${String(e)}` } }
  }
}

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
      .resize(width, height, { fit: "fill" })
      .toBuffer();
    return ok(resized);
  } catch (e: any) {
    return err(`Stretch error: ${String(e)}`);
  }
}

async function stitchHorizontally(
  buffers: Buffer[],
  eachWidth: number,
  eachHeight: number
): Promise<Result<Buffer>> {
  if (buffers.length === 0) {
    return err("No buffers to stitch.");
  }

  try {
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

    for (const buf of buffers) {
      compositeArray.push({
        input: buf,
        left: currentLeft,
        top: 0,
      });
      currentLeft += eachWidth;
    }

    const stitched = await base.composite(compositeArray).png().toBuffer();
    return ok(stitched);
  } catch (e: any) {
    return err(`Stitching error: ${String(e)}`);
  }
}

export async function stitchHorizontallyAlpha(
  buffers: Buffer[]
): Promise<Result<sharp.Sharp>> {
  if (buffers.length === 0) {
    return err("No buffers to stitch.");
  }

  try {
    const images = await Promise.all(buffers.map(buf => sharp(buf).metadata()));

    const totalWidth = images.reduce((sum, img) => sum + (img.width || 0), 0);
    const maxHeight = Math.max(...images.map(img => img.height || 0));

    let base = sharp({
      create: {
        width: totalWidth,
        height: maxHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

    const compositeArray = [];
    let currentLeft = 0;

    for (let i = 0; i < buffers.length; i++) {
      compositeArray.push({
        input: buffers[i],
        left: currentLeft,
        top: Math.floor((maxHeight - (images[i].height || 0)) / 2),
      });
      currentLeft += images[i].width || 0;
    }

    const stitched = base.composite(compositeArray).png();
    return ok(stitched);
  } catch (e: any) {
    return err(`Stitching error: ${String(e)}`);
  }
}

type ProcessChatMessageFlowResult = {
  ui_changes: any;
  base64Images: string[];
  stitchedImage: string;
};

export async function processChatMessageFlow(contents: ChatMessageContent[]): Promise<Result<ProcessChatMessageFlowResult>> {
  let imageUrls: string[] = [];
  let base64Images: string[] = [];

  for (const content of contents) {
    if (content.type === "text") {
      const urls = await scrapeBingImages(content.text, 4);
      imageUrls = imageUrls.concat(urls);
    } else if (content.type === "image_url") {
      if (typeof content.image_url === "string") {
        if (!content.image_url.startsWith("data:image/")) {
          return err("Expected base64 image URL");
        }
        base64Images.push(content.image_url);
      } else {
        if (!content.image_url.url.startsWith("data:image/")) {
          return err("Expected base64 image URL");
        }
        base64Images.push(content.image_url.url);
      }
    }
  }

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
  if (!stitchedResult.ok) return err(stitchedResult.error);

  const stitchedBuffer = await stitchedResult.value.toBuffer();
  const base64Image = `data:image/png;base64,${stitchedBuffer.toString("base64")}`;

  const urls: ChatMessageContent[] = base64Images.map(url => ({
    type: "image_url", image_url: { url, detail: "low" }
  }));

  urls.push({
    type: "image_url", image_url: { url: base64Image, detail: "low" }
  });

  const css = await sendPaletteRequest(urls);
  if (!css.ok) return err(JSON.stringify(css.error));

  return ok({
    ui_changes: css.value,
    base64Images,
    stitchedImage: base64Image,
  });
}
