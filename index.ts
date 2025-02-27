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
        const handleError = (error: any, context: string) => {
          const errorMessage = error ? `: ${JSON.stringify(error)}` : "";
          return Response.json({
            type: "error",
            content: `Oops! ${context} failed${errorMessage}. If only LLMs could code, they'd fix it for us!`,
          });
        };

        if (!messages.ok) return handleError(messages.error, "Message parsing");

        const latest = messages.value[messages.value.length - 1];
        const latestContent = latest.content.map(c => c.type === "text" ? c.text : "").join(" ");
        const keywordContent = (await preprocessPipeline(latest)).content;
        const [imageResult, fontResult, layoutResult, textResult] = await Promise.all([
          colorPipeline(keywordContent),
          fontPipeline(latestContent),
          layoutPipeline(latestContent),
          textPipeline(latestContent)
        ]);

        if (!imageResult.ok) return handleError(imageResult.error, "Image processing");
        if (!fontResult) return handleError(null, "Font processing");
        if (!layoutResult) return handleError(null, "Layout processing");

        return Response.json({
          type: "ui_update",
          content: textResult,
          ui_changes: {
            ...imageResult.value.ui_changes,
            ...fontResult.ui_changes,
            ...layoutResult,
          },
          css: fontResult.css
        });
      }
    }
  }
});

console.log(`Server started at port: ${server.port}`);
