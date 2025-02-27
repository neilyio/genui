// import { test, expect } from 'bun:test';
// import path from "path";
// import { Browser } from "happy-dom";
// import { JSDOM } from "jsdom";

// // const html = await Bun.file(path.join(__dirname, 'index.html')).text();
// const html2 = await Bun.file(path.join(__dirname, 'index2.html')).text();

// // test('dom test', async () => {
// //   document.documentElement.innerHTML = html2;
// //   let data = { detail: { message: "hellotest" } };
// //   let event = new CustomEvent("genui-message", data);
// //   document.documentElement.dispatchEvent(event);
// // });

// // test('browser test', async () => {
// //   const browser = new Browser();
// //   const page = browser.newPage();
// //   const document = page.mainFrame.document;
// //   const window = page.mainFrame.window;
// //   page.content = html2;
// //   await page.waitUntilComplete();

// //   let data = { detail: { message: "hellotest" } };
// //   let event = new window.CustomEvent("genui-message", data);
// //   document.documentElement.addEventListener("genui-message", () => {
// //     console.log("GOT THE EVENT");
// //   });
// //   document.documentElement.dispatchEvent(event);
// //   // expect(document.documentElement.innerHTML).toMatchSnapshot();
// //   console.log(document.documentElement.innerHTML);
// // });


// test('jsdom test', async () => {
//   const { window } = await JSDOM.fromFile("index2.html", {
//     runScripts: "dangerously",
//     resources: "usable"
//   });

//   // window.document.dispatchEvent
//   let data = { detail: { message: "hellotest" } };
//   let event = new window.CustomEvent("genui-message", data);
//   window.document.documentElement.addEventListener("genui-message", () => {
//     console.log("GOT THE EVENT");
//   });
//   window.document.documentElement.dispatchEvent(event);
//   await Bun.sleep(1000);
//   console.log(window.document.documentElement.innerHTML);
// });
