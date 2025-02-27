import root from "./index.html";
import { parseChatMessages } from "./chat.ts";
import { preprocessPipeline } from "./preprocess.ts";
import { fontPipeline } from "./fonts.ts";
import { layoutPipeline } from "./layout.ts";
import { textPipeline } from "./text.ts";
import { colorPipeline } from "./images.ts";

const server = Bun.serve({
  routes: {
    "/": root,
    "/api/chat": {
      POST: async req => {
        const messages = parseChatMessages(await req.json(), ["messages"]);
        if (!messages.ok) throw new Error(JSON.stringify(messages.error));

        const latest = messages.value[messages.value.length - 1];
        const latestContent = latest.content.map(c => c.type === "text" ? c.text : "").join(" ");
        const keywordContent = (await preprocessPipeline(latest)).content;
        const [imageResult, fontResult, layoutResult, textResult] = await Promise.all([
          colorPipeline(keywordContent),
          fontPipeline(latestContent),
          layoutPipeline(latestContent),
          textPipeline(latestContent)
        ]);

        if (!imageResult.ok) throw new Error(`Image processing failed: ${imageResult.error}`);
        if (!fontResult.ok) throw new Error(`Font processing failed`);
        if (!layoutResult.ok) throw new Error(`Layout processing failed: ${layoutResult.error}`);

        // Ensure the response structure is correct
        return new Response(JSON.stringify({
          type: "ui_update",
          content: textResult || "",
          ui_changes: {
            ...imageResult.value.ui_changes,
            ...fontResult.value.ui_changes,
            ...layoutResult.value.ui_changes,
          },
          css: fontResult.value.css
        });
      }
    }
  }
});

console.log(`Server started at port: ${server.port}`);
