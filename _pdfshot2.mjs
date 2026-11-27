import puppeteer from "puppeteer-core";
const [file, out, pageNo] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1900 });
await page.goto(`file://${file}#page=${pageNo}&zoom=125`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise(r => setTimeout(r, 3500));
await page.screenshot({ path: out });
await browser.close();
