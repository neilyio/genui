/**
 * Scrape Google Images thumbnails using Fetch and DOMParser.
 * @param searchTerm The term to search for
 * @param numResults Number of thumbnails to fetch
 */
async function scrapeGoogleImages(searchTerm: string, numResults = 10): Promise<string[]> {
  try {
    const query = encodeURIComponent(searchTerm);
    const url = `https://www.google.com/search?q=${query}&tbm=isch`;

    // Fetch HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
      },
    });
    const data = await response.text();
    console.log('DEBUG: Full HTML from Google:\n', data);

    // Extract image URLs using regular expressions
    const imageUrls: string[] = [];
    const imgRegex = /<img[^>]+(?:data-src|src)="([^">]+)"/g;
    let match;

    while ((match = imgRegex.exec(data)) !== null) {
      const src = match[1];
      console.log('DEBUG: Found src from imgRegex:', src);
      console.log('DEBUG: Found src from iurlRegex:', src);
      if (src) {
        imageUrls.push(src);
      }
    }

    // ADD THIS LOOP:
    const iurlRegex = /<img[^>]+data-iurl="([^">]+)"/g;
    while ((match = iurlRegex.exec(data)) !== null) {
      const src = match[1];
      if (src) {
        imageUrls.push(src);
      }
    }

    // Return the top N results
    return imageUrls.slice(0, numResults);
  } catch (error) {
    console.error('Error fetching Google Images:', error);
    return [];
  }
}

// Example usage:
(async () => {
  const searchTerm = 'cute puppies'; // Change this query as needed
  const results = await scrapeGoogleImages(searchTerm, 10);

  console.log(`Top ${results.length} thumbnail URLs for "${searchTerm}":`);
  for (let i = 0; i < results.length; i++) {
    const url = results[i];
    try {
      const resp = await fetch(url);
      const arrayBuffer = await resp.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      console.log(`${i + 1} - size: ${arrayBuffer.byteLength} bytes, base64: ${base64}`);
    } catch (error) {
      console.error(`Error fetching image at ${url}:`, error);
    }
  }
})();
