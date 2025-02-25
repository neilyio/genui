import { test, expect } from "bun:test";
import { scrapeBingImages } from "./images";
// @ts-ignore
import snapshots from "./__snapshots__/images.test.ts.snap" with { type: "text" };

function getSnapshot(test: string) {
  const exports: { [key: string]: string } = {};
  eval(snapshots);
  const data = exports[`${test} 1`];
  if (data) return eval(data);
}

test.skip("searches bing", async () => {
  const n = 2;
  const urls = await scrapeBingImages("giraffes", n);
  expect(urls.length).toBe(n);
  expect(urls).toMatchSnapshot();
});

test.skip("fetch snapshot", async () => {
  const urls = getSnapshot("searches bing");
  const urlStats = [];
  let promises = urls.map(async (url: any, i: number) => {
    const resp = await Bun.fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    return `${i + 1} - status: ${resp.status}, size: ${arrayBuffer.byteLength} bytes`;
  });

  const results =
    (await Promise.allSettled(promises))
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

  expect(results).toMatchInlineSnapshot(`
    [
      "1 - status: 200, size: 763435 bytes",
      "2 - status: 200, size: 240742 bytes",
    ]
  `);
}, 10000);


import { createCanvas, loadImage } from 'canvas';

test("fetch color palette reference", async () => {
  const url = "https://upload.wikimedia.org/wikipedia/commons/0/03/Trending_colors_2017.png";
  const response = await Bun.fetch(url);
  const buffer = await response.arrayBuffer();
  const image = await loadImage(Buffer.from(buffer));

  const width = 100;
  const height = (image.height / image.width) * width;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);

  const resizedImageBuffer = canvas.toBuffer();
  expect(resizedImageBuffer).toMatchSnapshot();
});
