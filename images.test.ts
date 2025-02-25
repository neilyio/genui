import { test, expect } from "bun:test";
import { scrapeBingImages } from "./images";
import sharp from 'sharp';

// // @ts-ignore
// import snapshots from "./__snapshots__/images.test.ts.snap" with { type: "text" };

// function getSnapshot(test: string) {
//   const exports: { [key: string]: string } = {};
//   eval(snapshots);
//   const data = exports[`${test} 1`];
//   if (data) return eval(data);
// }

test.skip("searches bing", async () => {
  const n = 2;
  const urls = await scrapeBingImages("giraffes", n);
  expect(urls.length).toBe(n);
  expect(urls).toMatchInlineSnapshot(`
    [
      "https://images.pexels.com/photos/1619507/pexels-photo-1619507.jpeg?cs=srgb&dl=animal-animal-photography-giraffe-1619507.jpg&fm=jpg",
      "https://images.pexels.com/photos/730185/pexels-photo-730185.jpeg?cs=srgb&dl=giraffe-730185.jpg&fm=jpg",
    ]
  `);

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
});


test("fetch color palette reference", async () => {
  const url = "https://upload.wikimedia.org/wikipedia/commons/0/03/Trending_colors_2017.png";
  const response = await Bun.fetch(url);
  const buffer = await response.arrayBuffer();

  const resizedImageBuffer = await sharp(Buffer.from(buffer))
    .resize(100)
    .toColorspace('srgb')
    .toBuffer();

  const { data, info } = await sharp(resizedImageBuffer)
    .quantize({ colors: 5 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colors = new Set();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    colors.add(`rgb(${r},${g},${b})`);
  }

  expect(colors).toMatchInlineSnapshot();
});
