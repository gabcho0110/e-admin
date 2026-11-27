#!/usr/bin/env node
/**
 * E2E проверка на PIG e-ADMIN с реален браузър (puppeteer-core + Chrome).
 *
 *   npm run build && npm run test:e2e
 *
 * Скриптът сам стартира `next start` на свободен порт с отделна локална база
 * (`.data-e2e`), изпълнява сценариите и гаси сървъра.
 *
 * Покритие:
 *   1. Публична начална страница
 *   2. Вход на администратор (bootstrap профил)
 *   3. Създаване и публикуване на обява
 *   4. Публичен списък с обяви → детайл → формуляр за кандидатстване
 *   5. Качване на CV и подаване на кандидатура (регистрационен номер)
 *   6. Проследяване по номер + имейл
 *   7. Кандидатурата се вижда от администратора
 *   8. Мобилна ширина без хоризонтален скрол
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import puppeteer from "puppeteer-core";

const ROOT = process.cwd();
const PORT = Number(process.env.E2E_PORT || 3210);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, ".data-e2e");
const SHOTS = path.join(ROOT, "tests", "screenshots");
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@pig-ohridski.bg";
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin123!";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✖ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function step(title) {
  console.log(`\n▸ ${title}`);
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 307) return true;
    } catch {
      /* още не е готов */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function makePdf(filePath) {
  // Минимален валиден PDF (достатъчен за проверка на типа и качването).
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 78>>stream
BT /F1 12 Tf 60 780 Td (Avtobiografia - testovo CV za PIG e-ADMIN) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

async function openDetails(page) {
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((node) => {
      node.open = true;
    });
  });
}

async function main() {
  await fs.rm(DATA_DIR, { recursive: true, force: true });
  await fs.mkdir(SHOTS, { recursive: true });
  const cvPath = await makePdf(path.join(SHOTS, "e2e-cv.pdf"));

  console.log(`\nPIG e-ADMIN · E2E (${BASE})\n`);

  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_MODE: "local",
      LOCAL_DATA_DIR: DATA_DIR,
      NODE_ENV: "production",
      // Сървърът в production режим чете и .env.production — задаваме същите
      // пароли, с които тестът влиза, за да не зависи от файла.
      BOOTSTRAP_ADMIN_EMAIL: ADMIN_EMAIL,
      BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD,
      PROTECTED_SUPERADMIN_PASSWORD: "TestProtected1!",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", (chunk) => {
    serverLog += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverLog += chunk.toString();
  });

  const ready = await waitForServer(`${BASE}/`);
  if (!ready) {
    console.error("Сървърът не стартира. Лог:\n" + serverLog.slice(-2000));
    server.kill("SIGTERM");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: path.join("/tmp", `pig-e2e-profile-${process.pid}`),
    protocolTimeout: 180_000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(25_000);
    await page.setViewport({ width: 1440, height: 900 });

    /* 1. Начална страница */
    step("Публичен портал");
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    const homeText = await page.evaluate(() => document.body.innerText);
    check("началната страница се зарежда", homeText.includes("ПИГ"));
    check("показва мотото на институцията", /Една институция/i.test(homeText));
    check("има служебен вход", homeText.includes("Служебен вход") || homeText.includes("Вход"));
    await page.screenshot({ path: path.join(SHOTS, "01-home.png"), fullPage: false });

    /* 2. Вход */
    step("Вход на администратор");
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
    await page.type('input[name="email"]', ADMIN_EMAIL);
    await page.type('input[name="password"]', ADMIN_PASSWORD);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForFunction(() => location.pathname.startsWith("/dashboard"), { timeout: 30_000 }),
    ]);
    const dashText = await page.evaluate(() => document.body.innerText);
    check("пренасочва към таблото", page.url().includes("/dashboard"));
    check("таблото е достъпно", dashText.includes("Табло") || dashText.includes("Обобщение"));
    check("показва името на институцията", dashText.includes("ПИГ"));
    await page.screenshot({ path: path.join(SHOTS, "02-dashboard.png"), fullPage: false });

    /* 3. Обява */
    step("Създаване и публикуване на обява");
    const jobTitle = `Учител по музика (E2E ${Date.now().toString().slice(-4)})`;
    const deadline = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);

    await page.goto(`${BASE}/dashboard/recruitment`, { waitUntil: "networkidle2" });
    await openDetails(page);
    await page.waitForSelector('input[name="title"]');
    await page.type('input[name="title"]', jobTitle);

    const departmentValue = await page.evaluate(() => {
      const select = document.querySelector('select[name="department"]');
      return select ? select.options[1]?.value ?? "" : "";
    });
    if (departmentValue) await page.select('select[name="department"]', departmentValue);

    const employmentValue = await page.evaluate(() => {
      const select = document.querySelector('select[name="employment_type"]');
      return select ? select.options[1]?.value ?? "" : "";
    });
    if (employmentValue) await page.select('select[name="employment_type"]', employmentValue);

    await page.evaluate((value) => {
      const input = document.querySelector('input[name="deadline"]');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, deadline);
    await page.type(
      'textarea[name="description"]',
      "Преподаване на музика в подготвителни групи и начален етап, участие в училищни изяви.",
    );
    await page.type(
      'textarea[name="requirements"]',
      "Висше музикално образование, педагогическа правоспособност, опит с деца.",
    );

    await Promise.all([
      page.evaluate(() => {
        const form = document.querySelector('form:has(input[name="title"])');
        form?.querySelector('button[type="submit"]')?.click();
      }),
      page.waitForFunction(() => /\/dashboard\/recruitment\/[0-9a-f-]{36}/.test(location.pathname), {
        timeout: 30_000,
      }),
    ]);
    const jobId = page.url().split("/").pop();
    const editorText = await page.evaluate(() => document.body.innerText);
    check("обявата се създава и отваря редактора", editorText.includes(jobTitle));
    check("новосъздадената обява е чернова", /чернова/i.test(editorText));

    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((b) =>
        b.innerText.includes("Публикувай"),
      );
      button?.click();
    });
    await page.waitForFunction(
      () => {
        const badge = document.body.innerText;
        return /публикувана/i.test(badge);
      },
      { timeout: 30_000 },
    );
    const publishedText = await page.evaluate(() => document.body.innerText);
    check("обявата е публикувана", /публикувана/i.test(publishedText));

    await page.goto(`${BASE}/dashboard/recruitment`, { waitUntil: "networkidle2" });
    const afterPublish = await page.evaluate((title) => {
      const row = Array.from(document.querySelectorAll("tr")).find((tr) =>
        tr.innerText.includes(title),
      );
      return row ? row.innerText : "";
    }, jobTitle);
    check("публикуваната обява е в списъка", afterPublish.length > 0, afterPublish.slice(0, 80));
    check("статусът в списъка е „публикувана“", /публикувана/i.test(afterPublish));
    await page.screenshot({ path: path.join(SHOTS, "03-recruitment.png"), fullPage: false });

    /* 4. Публичен списък и формуляр */
    step("Публична обява и кандидатстване");
    const guest = await browser.createBrowserContext();
    const publicPage = await guest.newPage();
    publicPage.setDefaultTimeout(25_000);
    await publicPage.setViewport({ width: 1440, height: 900 });

    await publicPage.goto(`${BASE}/jobs`, { waitUntil: "networkidle2" });
    const jobsText = await publicPage.evaluate(() => document.body.innerText);
    check("обявата е видима публично", jobsText.includes(jobTitle));

    await publicPage.evaluate((title) => {
      const link = Array.from(document.querySelectorAll("a")).find((a) =>
        a.innerText.includes(title),
      );
      link?.click();
    }, jobTitle);
    await publicPage.waitForFunction(() => /\/jobs\/[0-9a-f-]{36}/.test(location.pathname), {
      timeout: 20_000,
    });
    const jobUrl = publicPage.url();
    const jobDetail = await publicPage.evaluate(() => document.body.innerText);
    check("детайлът на обявата се отваря", jobDetail.includes(jobTitle));
    check("показва изискванията", /Изисквания/i.test(jobDetail));

    await publicPage.goto(`${jobUrl.replace(/\/$/, "")}`, { waitUntil: "networkidle2" });
    await publicPage.evaluate(() => {
      const link = Array.from(document.querySelectorAll("a")).find((a) =>
        a.innerText.includes("Кандидатствай"),
      );
      link?.click();
    });
    await publicPage.waitForFunction(() => location.pathname.startsWith("/apply/"), {
      timeout: 20_000,
    });
    const applyText = await publicPage.evaluate(() => document.body.innerText);
    check("формулярът за кандидатстване се отваря", /Лични данни/i.test(applyText));
    check("изисква прикачване на CV", applyText.includes("Автобиография"));

    const email = `kandidat.e2e.${Date.now()}@example.com`;
    await publicPage.type('input[name="first_name"]', "Мария");
    await publicPage.type('input[name="last_name"]', "Иванова");
    await publicPage.type('input[name="email"]', email);
    await publicPage.type('input[name="phone"]', "+359881234567");
    await publicPage.type('input[name="city"]', "София");
    await publicPage.type(
      'textarea[name="motivation"]',
      "Имам дългогодишен опит като учител по музика и желая да се присъединя към екипа на институцията.",
    );
    const fileInput = await publicPage.$('input[name="cv"]');
    await fileInput.uploadFile(cvPath);
    await publicPage.evaluate(() => {
      const box = document.querySelector('input[name="consent"]');
      if (box && !box.checked) box.click();
    });
    await publicPage.screenshot({ path: path.join(SHOTS, "04-apply-form.png"), fullPage: false });

    await Promise.all([
      publicPage.evaluate(() => {
        const form = document.querySelector('form:has(input[name="job_post_id"])');
        form?.querySelector('button[type="submit"]')?.click();
      }),
      publicPage.waitForFunction(() => location.pathname.startsWith("/apply/success/"), {
        timeout: 40_000,
      }),
    ]);
    const successText = await publicPage.evaluate(() => document.body.innerText);
    const registration = decodeURIComponent(publicPage.url().split("/").pop() || "");
    check("кандидатурата е приета", /Кандидатурата е получена/i.test(successText));
    check(
      "генериран е регистрационен номер",
      /^PIG-\d{4}-\d{6}$/.test(registration),
      registration,
    );
    await publicPage.screenshot({ path: path.join(SHOTS, "05-success.png"), fullPage: false });

    /* 5. Проследяване */
    step("Проследяване на кандидатура");
    await publicPage.goto(
      `${BASE}/track?number=${encodeURIComponent(registration)}&email=${encodeURIComponent(email)}`,
      { waitUntil: "networkidle2" },
    );
    const trackText = await publicPage.evaluate(() => document.body.innerText);
    check("статусът е видим", /Подадена/i.test(trackText));
    check("показва етапите", /Етапи на процедурата/i.test(trackText));
    await publicPage.screenshot({ path: path.join(SHOTS, "06-track.png"), fullPage: false });

    const wrong = await guest.newPage();
    await wrong.goto(
      `${BASE}/track?number=${encodeURIComponent(registration)}&email=nepoznat@example.com`,
      { waitUntil: "networkidle2" },
    );
    const wrongText = await wrong.evaluate(() => document.body.innerText);
    check("не издава данни при грешен имейл", /Не намерихме кандидатура/i.test(wrongText));
    await wrong.close();

    /* 6. Административен изглед */
    step("Административен изглед на кандидатурата");
    await page.goto(`${BASE}/dashboard/selection`, { waitUntil: "networkidle2" });
    const selectionText = await page.evaluate(() => document.body.innerText);
    check("кандидатурата е в регистъра", selectionText.includes(registration));
    await page.screenshot({ path: path.join(SHOTS, "07-selection.png"), fullPage: false });

    await page.goto(`${BASE}/dashboard/reports`, { waitUntil: "networkidle2" });
    const reportsText = await page.evaluate(() => document.body.innerText);
    check("анализите се зареждат", /Анализи|Статистика/i.test(reportsText));

    await page.goto(`${BASE}/dashboard/settings/audit`, { waitUntil: "networkidle2" });
    const auditText = await page.evaluate(() => document.body.innerText);
    check("одиторският журнал съдържа действия", /application\.submitted|Вход|submitted/i.test(auditText) || auditText.includes("кандидатура"));

    /* 7. Документооборот и експорт */
    step("Документооборот и експорт");
    await page.goto(`${BASE}/dashboard/documents`, { waitUntil: "networkidle2" });
    await openDetails(page);
    await page.waitForSelector('input[name="title"]');
    await page.type('input[name="title"]', "Заповед за назначаване на комисия (E2E)");
    await page.type(
      'textarea[name="body"]',
      "Назначава се комисия за подбор на учител по музика в състав от трима членове.",
    );
    await Promise.all([
      page.evaluate(() => {
        const form = document.querySelector('form:has(select[name="doc_type"])');
        form?.querySelector('button[type="submit"]')?.click();
      }),
      page.waitForFunction(
        () => /\/dashboard\/documents\/[0-9a-f-]{36}/.test(location.pathname),
        { timeout: 30_000 },
      ),
    ]);
    const docText = await page.evaluate(() => document.body.innerText);
    check("документът получава автоматичен номер", /PIG-ЗАП-\d{4}-\d{4}/.test(docText));
    const docId = new URL(page.url()).pathname.split("/").pop();

    const docx = await page.evaluate(async (id) => {
      const response = await fetch(`/api/documents/${id}/export?format=docx`);
      const buffer = await response.arrayBuffer();
      return {
        status: response.status,
        type: response.headers.get("content-type") || "",
        size: buffer.byteLength,
      };
    }, docId);
    check(
      "DOCX експортът връща валиден файл",
      docx.status === 200 && /wordprocessingml/.test(docx.type) && docx.size > 2000,
      JSON.stringify(docx),
    );

    const printResponse = await page.goto(`${BASE}/print/document/${docId}`, {
      waitUntil: "networkidle2",
    });
    check("печатният изглед се отваря", printResponse?.status() === 200);
    await page.screenshot({ path: path.join(SHOTS, "12-print-document.png"), fullPage: false });

    /* 8. Мобилна версия */
    step("Мобилна съвместимост");
    const mobile = await browser.newPage();
    await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mobile.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    const overflowHome = await mobile.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check("началната страница не излиза извън екрана", overflowHome <= 2, `${overflowHome}px`);
    await mobile.screenshot({ path: path.join(SHOTS, "08-mobile-home.png"), fullPage: false });

    await mobile.goto(`${BASE}/jobs`, { waitUntil: "networkidle2" });
    const overflowJobs = await mobile.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check("списъкът с обяви е мобилен", overflowJobs <= 2, `${overflowJobs}px`);
    await mobile.screenshot({ path: path.join(SHOTS, "09-mobile-jobs.png"), fullPage: false });

    /* 8. Светла тема */
    step("Светла тема");
    const light = await browser.newPage();
    await light.setViewport({ width: 1440, height: 900 });
    await light.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await light.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    const isDark = await light.evaluate(() => document.documentElement.classList.contains("dark"));
    check("светлата тема е активна при светла система", isDark === false);
    await light.screenshot({ path: path.join(SHOTS, "10-home-light.png"), fullPage: false });

    await light.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
    await light.screenshot({ path: path.join(SHOTS, "11-login-light.png"), fullPage: false });
    await light.close();

    /* 9. Сигурност: защитен маршрут */
    step("Сигурност");
    const anon = await guest.newPage();
    await anon.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2" });
    check("таблото изисква вход", anon.url().includes("/login"));
    const filesResponse = await anon.goto(`${BASE}/api/files/application/test.pdf`);
    check(
      "файловете не са публично достъпни",
      filesResponse?.status() === 401 || filesResponse?.status() === 403,
      String(filesResponse?.status()),
    );
    await anon.close();

    await guest.close();
  } catch (error) {
    failed += 1;
    failures.push(`Изключение: ${error.message}`);
    console.error("\n✖ Изключение:", error.message);
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Резултат: ${passed} успешни, ${failed} неуспешни`);
  if (failures.length) {
    console.log("\nНеуспешни проверки:");
    for (const item of failures) console.log(`  • ${item}`);
  }
  console.log(`Снимки: ${path.relative(ROOT, SHOTS)}/`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
