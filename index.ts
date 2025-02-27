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

        const processedLatest = await preprocessPipeline(latest);
        const [imageResult, fontResult, layoutResult, textResult] = await Promise.all([
          colorPipeline(processedLatest.content),
          fontPipeline(latest.content.map(c => c.type === "text" ? c.text : "").join(" ")),
          layoutPipeline(latest.content.map(c => c.type === "text" ? c.text : "").join(" ")),
          textPipeline(latest.content.map(c => c.type === "text" ? c.text : "").join(" "))
        ]);

        if (!imageResult.ok) throw new Error(`Image processing failed: ${imageResult.error}`);
        if (!fontResult) throw new Error(`Font processing failed`);
        if (!layoutResult) throw new Error(`Layout processing failed`);

        console.log(layoutResult, textResult);

        const css = fontResult.css;

        // Ensure the response structure is correct
        return Response.json({
          type: "ui_update",
          content: textResult,
          ui_changes: {
            ...imageResult.value.ui_changes,
            ...fontResult.ui_changes,
            ...layoutResult,
          },
          css
        });
      }
    }
  }
});

console.log(`Server started at port: ${server.port}`);
