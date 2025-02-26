import { describe, it, expect } from "bun:test";
import { buildGoogleFontsUrl, fetchGoogleFontCSS, getFontWeights, parseGoogleFontCSS } from "./fonts";

// ------------------ TESTS ------------------

describe("Google Font Fetching", () => {
  it("should build a URL for 'Open Sans' with some parameters", () => {
    const url = buildGoogleFontsUrl("Open Sans");
    expect(url).toMatchInlineSnapshot(
      `Promise {}`);
    expect(url).toMatchInlineSnapshot(
      `Promise {}`);
  });

  it("should fail gracefully if the font name is blank", async () => {
    const primaryUrl = await buildGoogleFontsUrl("");
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?&display=swap"`);
    const fallbackUrl = await buildGoogleFontsUrl("Roboto",);
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);


    if (!result.ok) throw result.error;
    expect(parseGoogleFontCSS(result.value)).toMatchInlineSnapshot(`"Roboto: 100, 200, 300, 400, 500, 600, 700, 800, 900, italic 100, italic 200, italic 300, italic 400, italic 500, italic 600, italic 700, italic 800, italic 900"`);
  });

  it("should build a valid URL for 'Open Sans' with weights", async () => {
    const result = await buildGoogleFontsUrl("Open Sans");
    expect(result).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"`);
  });

  it("should attempt to fetch from Google Fonts (no real network in snapshot test)", async () => {
    const primaryUrl = await buildGoogleFontsUrl("Open Sans");
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"`);
    const fallbackUrl = await buildGoogleFontsUrl("Roboto");
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"`);
    const result = await fetchGoogleFontCSS("https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800;300i;400i;500i;600i;700i;800i&effect=shadow-multiple", fallbackUrl);

    if (!result.ok) throw result.error;
    expect(parseGoogleFontCSS(result.value)).toMatchInlineSnapshot(`"Roboto: 100, 200, 300, 400, 500, 600, 700, 800, 900, italic 100, italic 200, italic 300, italic 400, italic 500, italic 600, italic 700, italic 800, italic 900"`);
  });

  it("should demonstrate fallback logic", async () => {
    // Force it to fail by providing a nonsense domain or parameters
    // so we can see fallback come into play. If fetch truly fails,
    // we should see a FallbackFailed or we see fallback success if Roboto is fetched.
    const primaryUrl = await buildGoogleFontsUrl("ImaginaryFontNameThatDoesNotExist");
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?&display=swap"`);
    const fallbackUrl = await buildGoogleFontsUrl("Roboto");
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);

    if (!result.ok) throw result.error;
    expect(parseGoogleFontCSS(result.value)).toMatchInlineSnapshot(`"Roboto: 100, 200, 300, 400, 500, 600, 700, 800, 900, italic 100, italic 200, italic 300, italic 400, italic 500, italic 600, italic 700, italic 800, italic 900"`);
  });

  it("should fetch all font weights using a range in the URL", async () => {
    const weights = await getFontWeights("Open Sans");
    expect(weights).toMatchInlineSnapshot(`
        [
          "300",
          "400",
          "500",
          "600",
          "700",
          "800",
          "300i italic",
          "400i italic",
          "500i italic",
          "600i italic",
          "700i italic",
          "800i italic",
        ]
      `);

    const primaryUrl = await buildGoogleFontsUrl("Open Sans");
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"`);
    const fallbackUrl = await buildGoogleFontsUrl("Roboto");
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);

    if (!result.ok) throw result.error;
    expect(parseGoogleFontCSS(result.value)).toMatchInlineSnapshot(`"Open Sans: 300, 400, 500, 600, 700, 800, italic 300, italic 400, italic 500, italic 600, italic 700, italic 800"`);
  });


  /**
   * Jest Tests
   */
  describe("Google Fonts Metadata", () => {
    it("should retrieve supported weights for Open Sans", async () => {
      const weights = await getFontWeights("Open Sans");
      expect(weights).toMatchInlineSnapshot(`
        [
          "300",
          "400",
          "500",
          "600",
          "700",
          "800",
          "300i italic",
          "400i italic",
          "500i italic",
          "600i italic",
          "700i italic",
          "800i italic",
        ]
      `);
    });

    it("should retrieve supported weights for Roboto", async () => {
      const weights = await getFontWeights("Roboto");
      expect(weights).toMatchInlineSnapshot(`
        [
          "100",
          "200",
          "300",
          "400",
          "500",
          "600",
          "700",
          "800",
          "900",
          "100i italic",
          "200i italic",
          "300i italic",
          "400i italic",
          "500i italic",
          "600i italic",
          "700i italic",
          "800i italic",
          "900i italic",
        ]
      `);
    });
  });
});
