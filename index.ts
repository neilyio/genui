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

        const response = await sendPaletteRequest(latest.content);
        console.log("sent");
        if (!response.ok) throw new Error(JSON.stringify(response.error));
        return Response.json(
          // { type: "ui_update", "content": "DONE!", ...response.value }
          { type: "ui_update", content: "DONE!", ui_changes: testcolors }
        );
      }
    }
  }
});

console.log(`Server started at port: ${server.port}`);
