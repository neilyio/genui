/**
 * Scrape Bing Images using Fetch and DOMParser.
 * @param searchTerm The term to search for
 * @param numResults Number of image URLs to return
 */
import { JSDOM } from 'jsdom';
import sharp from 'sharp';

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

// Example usage:
// (async () => {
//   const searchTerm = 'cute puppies'; // Change this query as needed
//   const results = await scrapeBingImages(searchTerm, 10);

//   console.log(`Top ${results.length} image URLs for "${searchTerm}":`);
//   for (let i = 0; i < results.length; i++) {
//     const url = results[i];
//     try {
//       const resp = await fetch(url);
//       const arrayBuffer = await resp.arrayBuffer();

//       // Print the "image state": e.g., HTTP status code and size
//       console.log(
//         `${i + 1} - status: ${resp.status}, size: ${arrayBuffer.byteLength} bytes`
//       );
//     } catch (error) {
//       console.error(`Error fetching image at ${url}:`, error);
//     }
//   }
// })();
