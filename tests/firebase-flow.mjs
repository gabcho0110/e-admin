import fs from "node:fs/promises";
import path from "node:path";

import puppeteer from "puppeteer-core";

/**
 * Проверка на Firebase режима: обява → кандидатстване с PDF → сваляне на файла.
 * Използва реалната Firebase база, затова накрая чисти създаденото.
 *
 * Стартиране: BASE_URL=http://127.0.0.1:3400 node tests/firebase-flow.mjs
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:3400";
const DB = "https://e-admin-ad0bb-default-rtdb.europe-west1.firebasedatabase.app";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ADMIN = { email: "atodorov434@gmail.com", password: "Aleks2010$" };

let pass = 0;
let fail = 0;
const check = (name, ok, extra = "") => {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

async function makePdf(file) {
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 20 100 Td (Firebase test) Tj ET
endstream endobj
trailer<</Root 1 0 R>>
%%EOF`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
  return file;
}

const pdfPath = await makePdf("/tmp/fb-test-cv.pdf");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100 });

const title = `Тест Firebase ${Date.now().toString().slice(-6)}`;
let jobId = null;
let appNumber = null;

/** Отваря страница и изчаква конкретен елемент (устойчиво на бавна хидратация). */
async function open(url, selector) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(selector, { timeout: 60_000 });
}

try {
  console.log("1. Вход като суперадминистратор");
  await open(`${BASE}/login`, 'input[name="email"]');
  await page.type('input[name="email"]', ADMIN.email);
  await page.type('input[name="password"]', ADMIN.password);
  await page.evaluate(() => document.querySelector("form")?.requestSubmit());
  await page.waitForFunction(() => location.pathname.startsWith("/dashboard"), { timeout: 90_000 });
  check("вход OK", true);

  console.log("2. Създаване и публикуване на обява");
  await open(`${BASE}/dashboard/recruitment`, 'input[name="title"]');
  const deadline = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  await page.evaluate(
    ({ title, deadline }) => {
      const form = Array.from(document.querySelectorAll("form")).find((f) =>
        f.querySelector('input[name="title"]'),
      );
      const set = (name, value) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (!el) throw new Error(`липсва поле: ${name}`);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const pick = (name) => {
        const select = form.querySelector(`select[name="${name}"]`);
        const option = Array.from(select.options).find((o) => o.value);
        return option ? option.value : "";
      };
      set("title", title);
      set("department", pick("department"));
      set("employment_type", pick("employment_type"));
      set("positions_count", "1");
      set("deadline", deadline);
      set("description", "Тестова обява за проверка на Firebase режима.");
      set("requirements", "Висше образование.");
      form.requestSubmit();
    },
    { title, deadline },
  );

  // След създаване приложението отваря директно страницата на обявата.
  await page.waitForFunction(
    () => /\/dashboard\/recruitment\/[0-9a-f-]{36}/.test(location.pathname),
    { timeout: 60_000 },
  );
  jobId = page.url().split("/dashboard/recruitment/")[1]?.split("?")[0] || null;
  check("обявата е създадена", !!jobId, String(jobId));

  const created = await page.evaluate(() => document.body.innerText);
  check("заглавието е на страницата", created.includes(title));

  if (jobId) {
    const published = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.innerText.trim().startsWith("Публикувай"),
      );
      btn?.click();
      return !!btn;
    });
    await new Promise((r) => setTimeout(r, 6000));
    const status = await page.evaluate(() => document.body.innerText);
    check("публикувана", published && /публикувана/i.test(status));
  }

  if (!jobId) throw new Error("няма обява — не може да продължи");

  console.log("3. Кандидатстване с PDF");
  await open(`${BASE}/apply/${jobId}`, 'input[name="first_name"]');
  const stamp = Date.now().toString().slice(-6);
  await page.evaluate(
    ({ stamp }) => {
      const form = document.querySelector("form");
      const set = (name, value) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (!el) throw new Error(`липсва поле: ${name}`);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("first_name", "Тест");
      set("last_name", "Кандидат");
      set("email", `fb.candidate.${stamp}@example.com`);
      set("phone", "0888123456");
      set("city", "Охрид");
      set("motivation", "Тестова мотивация за проверка на Firebase хранилището.");
    },
    { stamp },
  );
  const input = await page.$('input[type="file"]');
  await input.uploadFile(pdfPath);
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => {
    const form = document.querySelector("form");
    const consent = form.querySelector('input[type="checkbox"]');
    if (consent && !consent.checked) consent.click();
    form.requestSubmit();
  });
  await page.waitForFunction(() => location.pathname.startsWith("/apply/success"), { timeout: 90_000 });
  appNumber = page.url().split("/").pop();
  check("получен регистрационен номер", /^PIG-\d{4}-\d{6}$/.test(appNumber), appNumber);

  console.log("4. Файлът е в Firebase и се сваля");
  await open(`${BASE}/dashboard/selection`, "body");
  await new Promise((r) => setTimeout(r, 2500));
  const appRow = await page.evaluate((num) => {
    const tr = Array.from(document.querySelectorAll("tr")).find((r) => r.innerText.includes(num));
    if (!tr) return null;
    const link = tr.querySelector('a[href*="/dashboard/selection/"]');
    return { href: link?.getAttribute("href") || null };
  }, appNumber);
  check("кандидатурата е в регистъра", !!appRow?.href, JSON.stringify(appRow));

  if (appRow?.href) {
    await open(`${BASE}${appRow.href}`, "body");
    const fileHref = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll("a")).find((a) =>
        a.getAttribute("href")?.startsWith("/api/files/"),
      );
      return link?.getAttribute("href") || null;
    });
    check("има линк за сваляне", !!fileHref, String(fileHref));

    if (fileHref) {
      // Файлът се връща с Content-Disposition: attachment, затова навигацията
      // се прекъсва от Chrome — сваляме го през fetch в самата страница.
      const body = await page.evaluate(async (href) => {
        const response = await fetch(href);
        return { status: response.status, text: await response.text() };
      }, fileHref);
      check("файлът се връща с 200", body.status === 200, String(body.status));
      check("сваленият файл е PDF", body.text.startsWith("%PDF-1.4"), body.text.slice(0, 20));
      check("съдържанието съвпада", body.text.includes("Firebase test"));
    }
  }

  console.log("5. Данните са в RTDB");
  const node = await fetch(`${DB}/tables/job_posts/${jobId}.json`).then((r) => r.json());
  check("обявата е записана в Firebase", node?.title === title, node?.title);
} catch (error) {
  console.log("  ⛔", error.message);
  fail += 1;
} finally {
  await browser.close();
  await cleanup();
}

async function cleanup() {
  try {
    const jobs = await fetch(`${DB}/tables/job_posts.json`).then((r) => r.json());
    for (const [id, job] of Object.entries(jobs || {})) {
      if (String(job.title || "").startsWith("Тест Firebase")) {
        await fetch(`${DB}/tables/job_posts/${id}.json`, { method: "DELETE" });
      }
    }
    const apps = await fetch(`${DB}/tables/applications.json`).then((r) => r.json());
    for (const [id, app] of Object.entries(apps || {})) {
      if (String(app.candidate_email || app.email || "").startsWith("fb.candidate.")) {
        const docs = await fetch(`${DB}/tables/candidate_documents.json`).then((r) => r.json());
        for (const [docId, doc] of Object.entries(docs || {})) {
          if (doc.application_id === id && doc.storage_path) {
            await fetch(`${DB}/_files/${doc.storage_path}.json`, { method: "DELETE" });
            await fetch(`${DB}/tables/candidate_documents/${docId}.json`, { method: "DELETE" });
          }
        }
        const events = await fetch(`${DB}/tables/application_events.json`).then((r) => r.json());
        for (const [eventId, event] of Object.entries(events || {})) {
          if (event.application_id === id) {
            await fetch(`${DB}/tables/application_events/${eventId}.json`, { method: "DELETE" });
          }
        }
        await fetch(`${DB}/tables/applications/${id}.json`, { method: "DELETE" });
      }
    }
    console.log("(тестовите данни са изчистени)");
  } catch (error) {
    console.log("(почистването не успя:", error.message, ")");
  }
}

console.log(`\n${pass} успешни, ${fail} неуспешни`);
process.exit(fail === 0 ? 0 : 1);
