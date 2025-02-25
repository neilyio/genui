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
    .raw()
    .toBuffer();

  const colors = new Set();
  for (let i = 0; i < resizedImageBuffer.length; i += 3) {
    const r = resizedImageBuffer[i];
    const g = resizedImageBuffer[i + 1];
    const b = resizedImageBuffer[i + 2];
    colors.add(`rgb(${r},${g},${b})`);
  }

  expect(colors).toMatchInlineSnapshot(`
    Set {
      "rgb(68,72,77)",
      "rgb(255,68,72)",
      "rgb(77,255,68)",
      "rgb(72,77,255)",
      "rgb(255,67,71)",
      "rgb(76,255,46)",
      "rgb(54,66,255)",
      "rgb(42,51,65)",
      "rgb(255,43,52)",
      "rgb(65,255,43)",
      "rgb(52,65,255)",
      "rgb(43,52,65)",
      "rgb(51,64,255)",
      "rgb(45,55,69)",
      "rgb(255,79,123)",
      "rgb(148,255,86)",
      "rgb(137,165,255)",
      "rgb(85,134,161)",
      "rgb(255,85,135)",
      "rgb(162,255,85)",
      "rgb(135,162,255)",
      "rgb(85,135,162)",
      "rgb(162,255,82)",
      "rgb(134,163,255)",
      "rgb(221,198,99)",
      "rgb(255,252,213)",
      "rgb(85,255,245)",
      "rgb(209,89,255)",
      "rgb(246,210,88)",
      "rgb(255,246,210)",
      "rgb(88,255,246)",
      "rgb(210,88,255)",
      "rgb(88,255,245)",
      "rgb(88,255,135)",
      "rgb(162,117,255)",
      "rgb(96,145,127)",
      "rgb(255,104,149)",
      "rgb(125,255,103)",
      "rgb(148,125,255)",
      "rgb(103,148,125)",
      "rgb(255,103,148)",
      "rgb(77,255,67)",
      "rgb(71,76,255)",
      "rgb(46,54,66)",
      "rgb(255,42,51)",
      "rgb(43,51,64)",
      "rgb(255,45,55)",
      "rgb(69,255,79)",
      "rgb(123,148,255)",
      "rgb(86,137,165)",
      "rgb(255,85,134)",
      "rgb(161,255,85)",
      "rgb(82,134,163)",
      "rgb(255,221,198)",
      "rgb(99,255,252)",
      "rgb(213,85,255)",
      "rgb(245,209,89)",
      "rgb(245,210,88)",
      "rgb(135,162,117)",
      "rgb(255,96,145)",
      "rgb(127,255,104)",
      "rgb(149,125,255)",
      "rgb(125,255,68)",
      "rgb(67,71,76)",
      "rgb(255,46,54)",
      "rgb(66,255,42)",
      "rgb(51,65,255)",
      "rgb(255,43,51)",
      "rgb(64,255,45)",
      "rgb(55,69,255)",
      "rgb(79,123,148)",
      "rgb(255,86,137)",
      "rgb(165,255,85)",
      "rgb(134,161,255)",
      "rgb(255,82,134)",
      "rgb(163,255,221)",
      "rgb(198,99,255)",
      "rgb(252,213,85)",
      "rgb(255,245,209)",
      "rgb(89,255,246)",
      "rgb(255,245,210)",
      "rgb(255,135,162)",
      "rgb(117,255,96)",
      "rgb(145,127,255)",
      "rgb(104,149,125)",
    }
  `);
});
