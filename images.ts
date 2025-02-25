/**
 * Scrape Bing Images using Fetch and DOMParser.
 * @param searchTerm The term to search for
 * @param numResults Number of image URLs to return
 */
import { JSDOM } from 'jsdom';

async function scrapeBingImages(searchTerm: string, numResults = 10): Promise<string[]> {
  try {
    const query = encodeURIComponent(searchTerm);
    const url = `https://www.bing.com/images/search?q=${query}&FORM=HDRSC2`;

    // Fetch the HTML content
    const response = await fetch(url, {
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

// Example usage:
(async () => {
  const searchTerm = 'cute puppies'; // Change this query as needed
  const results = await scrapeBingImages(searchTerm, 10);

  console.log(`Top ${results.length} image URLs for "${searchTerm}":`);
  for (let i = 0; i < results.length; i++) {
    const url = results[i];
    try {
      const resp = await fetch(url);
      const arrayBuffer = await resp.arrayBuffer();

      // Print the "image state": e.g., HTTP status code and size
      console.log(
        `${i + 1} - status: ${resp.status}, size: ${arrayBuffer.byteLength} bytes`
      );
    } catch (error) {
      console.error(`Error fetching image at ${url}:`, error);
    }
  }
})();
