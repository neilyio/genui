# genui

## Install

1. Install [Bun](https://bun.sh/docs/installation).
```bash
curl -fsSL https://bun.sh/install | bash
```
2. Make sure you have the latest version.
```bash
bun upgrade
```
3. Install dependencies:
```bash
bun install
```
4. Set the `OPENAI_API_KEY` environment variable with your API key.

5. Run:
```bash
bun run src/index.ts
```

## How it works

### Client Architecture

The high-level process is:

1.	User submits a message.
2.	The message is added to the UI, and a typing indicator is shown.
3.	A request is sent to the server (`/api/chat`), containing the full message history.
4.	The server processes the request and returns a chat response and UI update.
5.	CSS variables are rehydrated with the new data, and the display dynamically updates.

The DOM itself is the source of truth for application state. We accomplish this dynamic UI with no JavaScript dependencies. A larger application would probably benefit from a one-way binding view library like React, coupled with a centralized state object.

### Server Architecture

A single endpoint, `/api/chat`, encapsulates the behavior of the application. When this endpoint is called, it initializes five pipelines. The last four of these are run concurrently, with `preprocessPipeline` as a dependency. Each pipeline manages communication with an independent agent backed by `gpt-4o-2024-08-06` and OpenAI's Structured Output API.

- `preprocessPipeline` keywordizes the user's prompt.
- `colorPipeline` uses the keywords to perform a Bing image search. It stitches together the top results and passes on to a OpenAI vision model, which extracts a color palette.
- `fontsPipeline` first asks an LLM to choose a font name based on the prompt, and then constructs a Google Fonts url from the name. It scrapes metadata to aggressively pull all available weights. This gives the next LLM a broader set of possibilities to populate the `font-family` and `font-weight` in the CSS variable map.
- `layoutPipeline` manages an LLM request that focuses on spacing related CSS properties. 
- `textPipeline` manages an LLM request for the reply message delivered back to the user.

Splitting the work into multiple pipelines lets us pass more refined system prompts to each model, and also allows us to parallelize some work. Given the non-deterministic behavior of LLMs, decoupling modules of work promotes robustness as the surface area for any given change is minimized.

## Development notes
- I attempted to accomplish as much as possible without dependencies. We rely only on `JSDOM` and `sharp` for scraping the images from Bing search results.
- Snapshot testing with `jest` is a major part of my development workflow. These are not always appropriate to commit, but I've left them here for discussion purposes.
- I made an initial attempt to avoid interaction with a vision model altogether, given its the most time-consuming part of the pipeline. I found aggregating colors from Bing delievered more accurate colors results than just asking an LLM to guess palettes. I initially attempted color extraction with `colorthief` and `node-vibrant`, but found that given a collage of photos, a vision model did a reasonable job of extracting a palette and making intelligent color assignments. I do believe this can/should be accomplished algorithmically, but this was a good trade-off for development speed. 

## Potential Improvement

1. Implement a rules engine as a post-processing step in the `colorPipeline`. The LLM has instructions to keep colors from clashing, but a verification system could more reliably elimate color problems on adjacent elements.
2. A cache database could maintain a history of queries with the UI calculation ready to immediately return. We already have a `preprocessPipeline` where an agent extracts keywords from a user prompt. We could use those keywords as a cache key to save trips to the `colorPipeline` and the `fontsPipeline`.
3. The user should be able to query by image, not just text prompt. This is very nearly ready to go, as we're already using a vision model in the `colorPipeline`. We'd just need to forward the user's image instead of searching Bing.
4. A websocket from the server could stream UI updates as they become available, instead of needing to wait for all the pipelines to finish. 
5. More interesting visual elements could be layered on, including font effects, animations, new icons, and texture samples.

