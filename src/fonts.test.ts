import { describe, it, expect } from "bun:test";
import { buildGoogleFontsUrl, executeFontFlow, fetchGoogleFontCSS, getFontWeights, parseGoogleFontCSS, sendFontNameRequest, sendFontVarsRequest } from "./fonts";

// ------------------ TESTS ------------------

describe("Google Font Fetching", () => {
  it.skip("should build a URL for 'Open Sans' with some parameters", () => {
    const url = buildGoogleFontsUrl("Open Sans");
    expect(url).toMatchInlineSnapshot(
      `Promise {}`);
    expect(url).toMatchInlineSnapshot(
      `Promise {}`);
  });

  describe("sendFontNameRequest", () => {
    it("should suggest an exotic font for a 'futuristic' theme", async () => {
      const prompt = "futuristic";

      const result = await sendFontNameRequest(prompt);
      if (!result.ok) throw result.error;
      expect(result.value).toMatchInlineSnapshot(`
        {
          "fallback_font_name": "Exo",
          "primary_font_name": "Orbitron",
        }
      `);

      const primaryUrl = await buildGoogleFontsUrl(result.value.primary_font_name?.toString?.() ?? "");
      const fallbackUrl = await buildGoogleFontsUrl(result.value.fallback_font_name?.toString?.() ?? "");

      expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Orbitron:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900&display=swap"`);
      expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Exo:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"`);
    }, 10000);

    it("should suggest an exotic font for a 'vintage' theme", async () => {
      const prompt = "vintage";

      const result = await sendFontNameRequest(prompt);
      if (!result.ok) throw result.error;
      expect(result.value).toMatchInlineSnapshot(`
        {
          "fallback_font_name": "Libre Baskerville",
          "primary_font_name": "Cormorant Garamond",
        }
      `);

      const primaryUrl = await buildGoogleFontsUrl(result.value.primary_font_name?.toString?.() ?? "");
      const fallbackUrl = await buildGoogleFontsUrl(result.value.fallback_font_name?.toString?.() ?? "");

      expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap"`);
      expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap"`);
    }, 10000);

    it("should suggest an exotic font for a 'gothic' theme", async () => {
      const prompt = "gothic";

      const result = await executeFontFlow(prompt);
      expect(result).toMatchInlineSnapshot(`
        {
          "css": 
        "@font-face {
          font-family: 'UnifrakturCook';
          font-style: normal;
          font-weight: 700;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/unifrakturcook/v23/IurA6Yli8YOdcoky-0PTTdkm56n05Uw1.ttf) format('truetype');
        }
        "
        ,
          "vars": {
            "header_font_family": "UnifrakturCook",
            "header_font_weight": "700",
            "message_font_family": "UnifrakturCook",
            "message_font_weight": "700",
            "placeholder_font_family": "UnifrakturCook",
            "placeholder_font_weight": "700",
          },
        }
      `);

    }, 20000);
  });

  it.skip("should fail gracefully if the font name is blank", async () => {
    const primaryUrl = await buildGoogleFontsUrl("");
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?&display=swap"`);
    const fallbackUrl = await buildGoogleFontsUrl("Roboto",);
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"`);
    const result = await fetchGoogleFontCSS(primaryUrl, fallbackUrl);


    if (!result.ok) throw result.error;
    expect(parseGoogleFontCSS(result.value)).toMatchInlineSnapshot(`"Roboto: 100, 200, 300, 400, 500, 600, 700, 800, 900, italic 100, italic 200, italic 300, italic 400, italic 500, italic 600, italic 700, italic 800, italic 900"`);
  });

  it.skip("should build a valid URL for 'Open Sans' with weights", async () => {
    const result = await buildGoogleFontsUrl("Open Sans");
    expect(result).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"`);
  });

  it.skip("should attempt to fetch from Google Fonts (no real network in snapshot test)", async () => {
    const primaryUrl = await buildGoogleFontsUrl("Open Sans");
    expect(primaryUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"`);
    const fallbackUrl = await buildGoogleFontsUrl("Roboto");
    expect(fallbackUrl).toMatchInlineSnapshot(`"https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"`);
    const result = await fetchGoogleFontCSS("https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800;300i;400i;500i;600i;700i;800i&effect=shadow-multiple", fallbackUrl);

    if (!result.ok) throw result.error;
    expect(parseGoogleFontCSS(result.value)).toMatchInlineSnapshot(`"Roboto: 100, 200, 300, 400, 500, 600, 700, 800, 900, italic 100, italic 200, italic 300, italic 400, italic 500, italic 600, italic 700, italic 800, italic 900"`);
  });

  it.skip("should demonstrate fallback logic", async () => {
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

  it.skip("should fetch all font weights using a range in the URL", async () => {
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


  describe("Mocked Google Font Fetching", () => {
    it("should return mocked URL for 'Open Sans'", async () => {
      const mockUrl = "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap";
      const result = await buildGoogleFontsUrl("Open Sans");
      expect(result).toBe(mockUrl);
    });

    it("should return mocked weights for 'Open Sans'", async () => {
      const mockWeights = [
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
      ];
      const weights = await getFontWeights("Open Sans");
      expect(weights).toEqual(mockWeights);
    });

    it("should return mocked CSS summary for 'Roboto'", () => {
      const mockCssText = `
        @font-face { font-family: 'Roboto'; font-style: normal; font-weight: 100; }
        @font-face { font-family: 'Roboto'; font-style: normal; font-weight: 200; }
        @font-face { font-family: 'Roboto'; font-style: normal; font-weight: 300; }
        @font-face { font-family: 'Roboto'; font-style: normal; font-weight: 400; }
        @font-face { font-family: 'Roboto'; font-style: normal; font-weight: 500; }
        @font-face { font-family: 'Roboto'; font-style: normal; font-weight: 600; }
        @font-face { font-family: 'Roboto'; font-style: normal; font-weight: 700; }
        @font-face { font-family: 'Roboto'; font-style: normal; font-weight: 800; }
        @font-face { font-family: 'Roboto'; font-style: normal; font-weight: 900; }
        @font-face { font-family: 'Roboto'; font-style: italic; font-weight: 100; }
        @font-face { font-family: 'Roboto'; font-style: italic; font-weight: 200; }
        @font-face { font-family: 'Roboto'; font-style: italic; font-weight: 300; }
        @font-face { font-family: 'Roboto'; font-style: italic; font-weight: 400; }
        @font-face { font-family: 'Roboto'; font-style: italic; font-weight: 500; }
        @font-face { font-family: 'Roboto'; font-style: italic; font-weight: 600; }
        @font-face { font-family: 'Roboto'; font-style: italic; font-weight: 700; }
        @font-face { font-family: 'Roboto'; font-style: italic; font-weight: 800; }
        @font-face { font-family: 'Roboto'; font-style: italic; font-weight: 900; }
      `;
      const mockCssSummary = "Roboto: 100, 200, 300, 400, 500, 600, 700, 800, 900, italic 100, italic 200, italic 300, italic 400, italic 500, italic 600, italic 700, italic 800, italic 900";
      const cssSummary = parseGoogleFontCSS(mockCssText);
      expect(cssSummary).toBe(mockCssSummary);
    });
  });
});
