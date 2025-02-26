import root from "./index.html";
import mario from "./responses/test.json";
import { sendPaletteRequest } from "./all.ts";
import { parseChatMessages } from "./chat.ts";
import testcolors from "./testcolors.json";
import { fetchToBase64, processChatMessageFlow, scrapeBingImages } from "./images.ts";
import { executeFontFlow } from "./fonts.ts";

const server = Bun.serve({
  routes: {
    "/": root,
    "/api/chat": {
      POST: async req => {
        const messages = parseChatMessages(await req.json(), ["messages"]);
        if (!messages.ok) throw new Error(JSON.stringify(messages.error));

        const latest = messages.value[messages.value.length - 1];

        const [imageResult, fontResult] = await Promise.all([
          processChatMessageFlow(latest.content),
          executeFontFlow(latest.content.map(c => c.type === "text" ? c.text : "").join(" "))
        ]);

        if (!imageResult.ok) throw new Error(`Image processing failed: ${imageResult.error}`);
        if (!fontResult) throw new Error(`Font processing failed`);

        const mergedUIChanges = {
          ...imageResult.value.ui_changes,
          ...fontResult.vars,
          header_font_family: fontResult.vars.header_font_family || "Arial",
          header_font_weight: fontResult.vars.header_font_weight || "700",
          message_font_family: fontResult.vars.message_font_family || "Arial",
          message_font_weight: fontResult.vars.message_font_weight || "400",
          placeholder_font_family: fontResult.vars.placeholder_font_family || "Arial",
          placeholder_font_weight: fontResult.vars.placeholder_font_weight || "400",
        };

        // Ensure the response structure is correct
        return Response.json({
          type: "ui_update",
          content: "DONE!",
          ...mergedUIChanges
        });
      }
    }
  }
});

console.log(`Server started at port: ${server.port}`);
