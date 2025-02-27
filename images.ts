/**
 * Scrape Bing Images using Fetch and DOMParser.
 * @param searchTerm The term to search for
 * @param numResults Number of image URLs to return
 */
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import {
  sendChatRequest,
  type Result,
  type ChatPayload,
  type Json,
  type ChatMessage,
  parseChatResponse,
  type ChatMessageContent,
} from "./chat.js";
import config from "./config.toml";
import { fetchToBase64 } from "./images.js";

const MODEL = config.model;
const COLOR_PROPERTIES = Object
  .keys(config.variables.color as Record<string, unknown>)
  .reduce(
    (acc, key) => { acc[key] = { type: "string" }; return acc; },
    {} as Record<string, { type: string }>
  );
const COLOR_REQUIRED = Object.keys(COLOR_PROPERTIES);

function chatPayload(
  { name, messages, properties }:
    {
      name: string,
      messages: ChatMessage[] as unknown as Json,
      properties: {
        [key: string]: Json
      }
    }
): { [key: string]: Json } {
  let required = Object.keys(properties);
  return {
    model: MODEL,
    temperature: 0,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: name,
        strict: true,
        schema: {
          type: "object",
          properties,
          required,
          additionalProperties: false,
        },
      }
    }
  }
}

export async function sendPaletteRequest(contents: ChatMessageContent[]):
  Promise<Result<{ ui_changes: Json }>> {
  const prompt = config.prompt.palette;
  let text: ChatMessageContent[] = [];
  let urls: Promise<ChatMessageContent>[] = [];
  for (const content of contents) {
    if (content.type === "text") {
      text.push(content);
    } else {
      let url = typeof content.image_url === 'string'
        ? content.image_url
        : content.image_url.url;

      urls.push(fetchToBase64(url)
        .then(b => ({ type: "image_url", image_url: { url: b, detail: "low" } })));
    }
  }

  const b64s: ChatMessageContent[] =
    await Promise.allSettled(urls)
      .then(rs => rs.filter((r): r is PromiseFulfilledResult<ChatMessageContent> => r.status === 'fulfilled').map(r => r.value));

  const payload = chatPayload({
    name: "send_query",
    messages: [
      { role: "system", content: [{ type: "text", text: prompt }] },
      {
        role: "user", content: [
          ...text, ...b64s
        ]
      }
    ],
    properties: {
      ui_changes: {
        type: "object",
        properties: COLOR_PROPERTIES,
        required: COLOR_REQUIRED,
        additionalProperties: false
      }
    },
  })

  return await sendChatRequest(payload as { [key: string]: Json }).then(parseChatResponse)
    .then((p: Result<{ ui_changes: Json }>) => p.ok ? { ok: true, value: { ui_changes: p.value["ui_changes"] } } : p);
}
import { err, ok } from "./utils.ts";
import type { Result } from "./utils.ts";
import type { ChatMessageContent } from "./chat";

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
): Promise<Result<Buffer>> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return { ok: false, error: { type: "MissingMetadata", detail: "(width/height)" } }
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
    return { ok: false, error: { type: "DownsampleError", detail: String(e) } };
  }
}

export async function stitchHorizontally(
  buffers: Buffer[]
): Promise<Result<sharp.Sharp>> {
  if (buffers.length === 0) {
    return err({ type: "StitchingError", detail: "No buffers to stitch." });
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
    return err({ type: "StitchingError", detail: `Stitching error: ${String(e)}` });
  }
}

type ProcessChatMessageFlowResult = {
  ui_changes: any;
  base64Images: string[];
  stitchedImage: string;
  imageUrls: string[];
};

export async function colorPipeline(contents: ChatMessageContent[]): Promise<Result<ProcessChatMessageFlowResult>> {
  let imageUrls: string[] = [];
  let base64Images: string[] = [];

  for (const content of contents) {
    if (content.type === "text") {
      const urls = await scrapeBingImages(content.text, 4);
      imageUrls = imageUrls.concat(urls);
    } else if (content.type === "image_url") {
      if (typeof content.image_url === "string") {
        if (!content.image_url.startsWith("data:image/")) {
          return err({ type: "InvalidImageUrl", detail: "Expected base64 image URL" });
        }
        base64Images.push(content.image_url);
      } else {
        if (!content.image_url.url.startsWith("data:image/")) {
          return err({ type: "InvalidImageUrl", detail: "Expected base64 image URL" });
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
        .filter((r): r is PromiseFulfilledResult<Result<Buffer>> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((r) => r.ok)
        .map((r) => r.value)
    );

  const stitchedResult = await stitchHorizontally(buffers);
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
  if (!css.ok) return err({ type: "PaletteError", detail: JSON.stringify(css.error) });

  return ok({
    imageUrls,
    base64Images,
    stitchedImage: base64Image,
    ...css.value
  });
}
