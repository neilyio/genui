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

    // Parse the HTML using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(data, 'text/html');

    // Extract image URLs from the search results
    const imageUrls: string[] = [];
    const imgElements = doc.querySelectorAll('img');

    imgElements.forEach((element) => {
      const src = element.getAttribute('src');
      if (src && !src.includes('gstatic')) { // Filter out Google’s own assets
        imageUrls.push(src);
      }
    });

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
  results.forEach((url, index) => console.log(`${index + 1}: ${url}`));
})();
