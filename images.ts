/**
 * Scrape Google Images thumbnails using Axios & Cheerio.
 * @param searchTerm The term to search for
 * @param numResults Number of thumbnails to fetch
 */
async function scrapeGoogleImages(searchTerm: string, numResults = 10): Promise<string[]> {
  try {
    const query = encodeURIComponent(searchTerm);
    const url = `https://www.google.com/search?q=${query}&tbm=isch`;

    // Fetch HTML content
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
      },
    });

    // Load the HTML into cheerio
    const $ = cheerio.load(data);

    // Extract image URLs from the search results
    const imageUrls: string[] = [];

    $('img').each((_index, element) => {
      const src = $(element).attr('src');
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
