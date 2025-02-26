import root from "./index.html";
import mario from "./responses/test.json";
import { sendPaletteRequest } from "./all.ts";
import { parseChatMessages } from "./chat.ts";
import testcolors from "./testcolors.json";
import { fetchToBase64, scrapeBingImages } from "./images.ts";

const server = Bun.serve({
  routes: {
    "/": root,
    "/api/chat": {
      POST: async req => {
        const messages = parseChatMessages(await req.json(), ["messages"]);
        if (!messages.ok) throw new Error(JSON.stringify(messages.error));

        const latest = messages.value[messages.value.length - 1];
        // let text = [];
        // let urls = [];
        // for (const content of latest.content) {
        //   if (content.type === "text") {
        //     text.push(content.text);
        //   } else {
        //     let url = typeof content.image_url === 'string'
        //       ? content.image_url
        //       : content.image_url.url;

        //     urls.push(fetchToBase64(url))
        //   }
        // }

        const [imageResult, fontResult] = await Promise.all([
          processChatMessageFlow(latest.content),
          executeFontFlow(latest.content.map(c => c.type === "text" ? c.text : "").join(" "))
        ]);

        if (!imageResult.ok) throw new Error(`Image processing failed: ${imageResult.error}`);
        if (!fontResult) throw new Error(`Font processing failed`);

        const mergedUIChanges = {
          ...imageResult.value.ui_changes,
          ...fontResult.css
        };

        return Response.json({
          type: "ui_update",
          content: "DONE!",
          ui_changes: mergedUIChanges
        });
      }
    }
  }
});

console.log(`Server started at port: ${server.port}`);
