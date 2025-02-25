import { test, expect } from "bun:test";
import { scrapeBingImages } from "./images";
import sharp from 'sharp';
import { kmeans } from 'ml-kmeans';

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

  const pixels = [];
  for (let i = 0; i < resizedImageBuffer.length; i += 3) {
    const r = resizedImageBuffer[i];
    const g = resizedImageBuffer[i + 1];
    const b = resizedImageBuffer[i + 2];
    pixels.push([r, g, b]);
  }

  const { clusters } = kmeans(pixels, 5); // Cluster into 5 colors

  const colors = clusters.map(cluster => {
    const [r, g, b] = cluster.centroid;
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  });

  expect(colors).toMatchInlineSnapshot();
});
