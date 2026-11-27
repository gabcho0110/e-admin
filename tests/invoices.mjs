#!/usr/bin/env node
/**
 * E2E проверка на модул „Фактури“ (фактури, проформи, известия) с реален браузър.
 *
 *   npm run build && node tests/invoices.mjs
 *
 * Скриптът сам стартира `next start` на отделен порт с отделна локална база
 * (`.data-invoices`), изпълнява сценариите и гаси сървъра.
 *
 * Покритие:
 *   1. Навигация — модулът е в менюто и регистърът е празен
 *   2. Настройки за фактуриране (издател) — и регистрацията остава отворена
 *   3. Контрагенти — създаване и редакция
 *   4. Нов документ — избор на контрагент, два реда с различни ставки, живи тотали
 *   5. Издаване — автоматичен номер, заключен документ, редове и суми
 *   6. Печатен вид — заглавие, ДДС разбивка, сума словом, данни на издателя
 *   7. Плащане — статус „Платена“ и остатък
 *   8. Чернова (проформа) — собствена серия, редакция, изтриване
 *   9. Анулиране — статус и воден знак в печатния вид
 *  10. Кредитно известие по издаден документ (?from=)
 *  11. Филтри в регистъра и статистика
 *  12. Контрагент с документи не се трие
 *  13. Одиторски журнал — действията по фактурите
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import puppeteer from "puppeteer-core";

const ROOT = process.cwd();
const PORT = Number(process.env.INVOICE_PORT || 3310);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, ".data-invoices");
const SHOTS = path.join(ROOT, "tests", "screenshots");
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@pig-ohridski.bg";
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin123!";
const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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

const norm = (value) => String(value || "").replace(/\s+/g, " ").trim();
/** Търсене без значение от главни/малки букви (CSS `uppercase` се отразява в innerText). */
const has = (haystack, needle) => norm(haystack).toLowerCase().includes(needle.toLowerCase());

async function waitForServer(url, timeoutMs = 90_000) {
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

async function main() {
  await fs.rm(DATA_DIR, { recursive: true, force: true });
  await fs.mkdir(SHOTS, { recursive: true });

  console.log(`\nPIG e-ADMIN · Фактури E2E (${BASE})\n`);

  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_MODE: "local",
      LOCAL_DATA_DIR: DATA_DIR,
      NODE_ENV: "production",
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

  const ready = await waitForServer(`${BASE}/login`);
  if (!ready) {
    console.error("Сървърът не стартира. Лог:\n" + serverLog.slice(-2000));
    server.kill("SIGTERM");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: path.join("/tmp", `pig-invoices-${process.pid}`),
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

  const page = await browser.newPage();
  page.setDefaultTimeout(40_000);
  await page.setViewport({ width: 1440, height: 1000 });
  page.on("dialog", (dialog) => dialog.accept());

  /* ─── Помощни функции ─── */

  const body = () => page.evaluate(() => document.body.innerText);

  async function waitText(needle, timeout = 40_000) {
    await page.waitForFunction(
      (value) => document.body.innerText.includes(value),
      { timeout },
      needle,
    );
  }

  /** Задава стойност на контролирано от React поле (input / select / textarea). */
  async function setValue(selector, value) {
    await page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`няма поле ${selector}`);
        const proto =
          el.tagName === "SELECT"
            ? HTMLSelectElement.prototype
            : el.tagName === "TEXTAREA"
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { selector, value },
    );
  }

  async function clickButton(label, scope = "document") {
    await page.evaluate(
      ({ label, scope }) => {
        const root = scope === "document" ? document : document.querySelector(scope);
        const button = [...root.querySelectorAll("button")].find(
          (node) => !node.disabled && node.textContent.trim().includes(label),
        );
        if (!button) throw new Error(`няма бутон „${label}“`);
        button.click();
      },
      { label, scope },
    );
  }

  async function clickLink(label) {
    await page.evaluate((label) => {
      const link = [...document.querySelectorAll("a")].find((node) =>
        node.textContent.trim().includes(label),
      );
      if (!link) throw new Error(`няма връзка „${label}“`);
      link.click();
    }, label);
  }

  /** Попълва ред от таблицата с редове (0-базиран индекс). */
  async function fillRow(index, row) {
    await page.evaluate(
      ({ index, row }) => {
        const set = (el, value) => {
          if (!el) throw new Error("липсва поле в реда");
          const proto =
            el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const tr = [...document.querySelectorAll('input[name="item_name"]')][index]?.closest("tr");
        if (!tr) throw new Error(`няма ред ${index}`);
        set(tr.querySelector('input[name="item_name"]'), row.name);
        if (row.unit) set(tr.querySelector('select[name="item_unit"]'), row.unit);
        set(tr.querySelector('input[name="item_quantity"]'), String(row.quantity));
        set(tr.querySelector('input[name="item_unit_price"]'), String(row.price));
        set(tr.querySelector('select[name="item_vat_rate"]'), String(row.vat));
      },
      { index, row },
    );
  }

  /** Изчаква сървърното действие да пренасочи и страницата да се изрисува. */
  async function afterAction(marker) {
    await page
      .waitForFunction(() => /[?&](ok|err)=/.test(location.search), { timeout: 60_000 })
      .catch(() => {});
    if (marker) await waitText(marker).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const today = new Date();
  const issueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  try {
    /* 1. Вход */
    step("Вход и навигация");
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', ADMIN_EMAIL);
    await page.type('input[name="password"]', ADMIN_PASSWORD);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForFunction(() => location.pathname.startsWith("/dashboard"), { timeout: 60_000 }),
    ]);
    check("администраторът влиза", page.url().includes("/dashboard"));

    const navText = await body();
    check("менюто съдържа „Фактури“", navText.includes("Фактури"));

    await page.goto(`${BASE}/dashboard/invoices`, { waitUntil: "domcontentloaded" });
    await waitText("Фактури и проформи");
    const emptyText = await body();
    check("регистърът се отваря", emptyText.includes("Фактури и проформи"));
    check("празното състояние е описано", emptyText.includes("Още няма издадени документи"));
    check("има бутон за нов документ", emptyText.includes("Нов документ"));
    check("има връзка към контрагентите", emptyText.includes("Контрагенти"));

    /* 2. Настройки за фактуриране */
    step("Настройки за фактуриране");
    const supplierName = "ПИГ „Св. Климент Охридски“ — Тест Издател";
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
    await waitText("Данни за фактуриране");
    check("има карта „Данни за фактуриране“", (await body()).includes("Данни за фактуриране"));

    await setValue('input[name="invoice_supplier_name"]', supplierName);
    await setValue('input[name="invoice_supplier_eik"]', "123456789");
    await setValue('input[name="invoice_supplier_iban"]', "BG00TEST00001234567890");
    await setValue('input[name="invoice_supplier_bank"]', "Тест Банк АД");
    await setValue('input[name="invoice_supplier_mol"]', "Проф. Иван Петров");
    await setValue('input[name="invoice_due_days"]', "10");
    await setValue('input[name="invoice_footer_note"]', "Благодарим Ви!");
    await clickButton("Запази данните за фактуриране");
    await afterAction("Настройките са запазени");
    check("настройките се запазват", (await body()).includes("Настройките са запазени"));

    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
    await waitText("Данни за фактуриране");
    const stillOpen = await page.evaluate(() => {
      const box = document.querySelector('input[name="registration_open"]');
      return box ? box.checked : null;
    });
    check(
      "записът на фактурните данни не затваря кандидатстването",
      stillOpen === true,
      String(stillOpen),
    );
    const savedSupplier = await page.evaluate(() =>
      document.querySelector('input[name="invoice_supplier_name"]')?.value,
    );
    check("издателят е записан", savedSupplier === supplierName, String(savedSupplier));

    /* 3. Контрагенти */
    step("Контрагенти");
    const clientName = "Тест Контрагент ООД";
    await page.goto(`${BASE}/dashboard/invoices/clients`, { waitUntil: "domcontentloaded" });
    await waitText("Нов контрагент");
    await setValue('input[name="name"]', clientName);
    await setValue('input[name="eik"]', "205123456");
    await setValue('input[name="vat_number"]', "BG205123456");
    await setValue('input[name="mol"]', "Мария Стоянова");
    await setValue('input[name="city"]', "Охрид");
    await setValue('input[name="address"]', "ул. „Св. Климент“ 5");
    await setValue('input[name="email"]', "client@example.com");
    await clickButton("Добави контрагент");
    await afterAction("е добавен");
    check("контрагентът е добавен", (await body()).includes(clientName));

    await page.goto(`${BASE}/dashboard/invoices/clients`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("tbody tr");
    const clientRow = await page.evaluate((name) => {
      const tr = [...document.querySelectorAll("tbody tr")].find((row) =>
        row.innerText.includes(name),
      );
      if (!tr) return null;
      return {
        text: tr.innerText.replace(/\s+/g, " "),
        hasEdit: Boolean(tr.querySelector('a[href*="?edit="]')),
      };
    }, clientName);
    check("контрагентът е в списъка", clientRow !== null);
    check("показва ЕИК и град", Boolean(clientRow && clientRow.text.includes("205123456") && clientRow.text.includes("Охрид")));
    check("има връзка за редакция", Boolean(clientRow?.hasEdit));

    /* 4. Нов документ — два реда с различни ставки */
    step("Нов документ");
    await page.goto(`${BASE}/dashboard/invoices/new`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="item_name"]');
    await waitText("Издаване на документ");

    const docTypeValue = await page.evaluate(
      () => document.querySelector('select[name="doc_type"]')?.value,
    );
    check("по подразбиране е фактура", docTypeValue === "invoice", String(docTypeValue));

    // избор на контрагент от списъка → полетата се попълват
    const clientOption = await page.evaluate(() => {
      const select = [...document.querySelectorAll("select")].find((el) =>
        [...el.options].some((option) => option.textContent.includes("Тест Контрагент")),
      );
      return select ? [...select.options].find((option) => option.textContent.includes("Тест Контрагент"))?.value : null;
    });
    check("контрагентът е наличен за избор", Boolean(clientOption));
    if (clientOption) {
      await page.evaluate((value) => {
        const select = [...document.querySelectorAll("select")].find((el) =>
          [...el.options].some((option) => option.value === value),
        );
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, value);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }, clientOption);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    const filled = await page.evaluate(() => ({
      name: document.querySelector('input[name="client_name"]')?.value,
      eik: document.querySelector('input[name="client_eik"]')?.value,
      mol: document.querySelector('input[name="client_mol"]')?.value,
    }));
    check("изборът попълва получателя", filled.name === clientName, String(filled.name));
    check("копира ЕИК и МОЛ", filled.eik === "205123456" && filled.mol === "Мария Стоянова", JSON.stringify(filled));

    await setValue('input[name="issue_date"]', issueDate);
    await setValue('input[name="basis"]', "Договор № 12/01.09.2026");

    await fillRow(0, { name: "Обучение по музика", unit: "курс", quantity: 2, price: 150, vat: 20 });
    await clickButton("Добави ред");
    await page.waitForFunction(
      () => document.querySelectorAll('input[name="item_name"]').length === 2,
      { timeout: 20_000 },
    );
    await fillRow(1, { name: "Учебни материали", unit: "бр.", quantity: 1, price: 50, vat: 9 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const formText = norm(
      await page.evaluate(() => {
        const form = document.querySelector('input[name="item_name"]')?.closest("form");
        return form ? form.innerText : "";
      }),
    );
    // 2 × 150 = 300 + 60 ДДС; 1 × 50 = 50 + 4,50 ДДС → 350 / 64,50 / 414,50
    check("живият тотал е 414,50 €", formText.includes("414,50 €"), formText.slice(-260));
    check("основата е 350,00 €", formText.includes("350,00 €"));
    check("показана е разбивка по ставки", formText.includes("ДДС 20%") && formText.includes("ДДС 9%"));
    await page.screenshot({ path: path.join(SHOTS, "inv-01-new.png") });

    /* 5. Издаване */
    step("Издаване на фактура");
    await clickButton("Издай документа");
    await page.waitForFunction(
      () => /\/dashboard\/invoices\/[0-9a-f-]{8,}/.test(location.pathname),
      { timeout: 60_000 },
    );
    await waitText("Общо за плащане");
    const detailUrl = page.url();
    const detailText = norm(await body());
    check("пренасочва към документа", /\/dashboard\/invoices\/[0-9a-f-]{8,}/.test(detailUrl), detailUrl);
    check("номерът е 0000000001", detailText.includes("0000000001"));
    check("статусът е „Издадена“", detailText.includes("Издадена"));
    check("документът е заключен (без формуляр)", detailText.includes("Общо за плащане") && !detailText.includes("Чернова — може да се редактира"));
    check("редовете са записани", detailText.includes("Обучение по музика") && detailText.includes("Учебни материали"));
    check("сумата е 414,50 €", detailText.includes("414,50 €"));
    check("показан е получателят", detailText.includes(clientName) && detailText.includes("205123456"));
    check("има връзка за печат", detailText.includes("Печат / PDF"));
    await page.screenshot({ path: path.join(SHOTS, "inv-02-detail.png") });

    const invoiceId = detailUrl.split("/").pop();

    /* 6. Печатен вид */
    step("Печатен вид");
    await page.goto(`${BASE}/print/invoice/${invoiceId}`, { waitUntil: "domcontentloaded" });
    await waitText("ФАКТУРА");
    const printText = norm(await body());
    check("заглавие „ФАКТУРА“", printText.includes("ФАКТУРА"));
    check("номерът е отпечатан", printText.includes("№ 0000000001"));
    check("издателят е от настройките", printText.includes("Тест Издател"));
    check("ЕИК на издателя", printText.includes("123456789"));
    check("IBAN на издателя", printText.includes("BG00TEST00001234567890"));
    check("ДДС разбивка по ставки", printText.includes("ДДС 20%") && printText.includes("ДДС 9%"));
    check("общо за плащане", printText.includes("414,50 €"));
    check("сума словом", /Четиристотин четиринадесет евро и 50 стотинки/.test(printText), printText.slice(0, 400));
    check("основание", printText.includes("Договор № 12/01.09.2026"));
    check("текст в дъното от настройките", printText.includes("Благодарим Ви!"));
    check("подписи", has(printText, "Съставил") && has(printText, "Получател"));
    await page.screenshot({ path: path.join(SHOTS, "inv-03-print.png"), fullPage: true });

    /* 7. Плащане */
    step("Плащане");
    await page.goto(`${BASE}/dashboard/invoices/${invoiceId}`, { waitUntil: "domcontentloaded" });
    await waitText("Отбележи плащане");
    await clickButton("Отбележи плащане");
    await afterAction("Платена");
    await page.waitForFunction(() => document.body.innerText.includes("Платена"), { timeout: 40_000 });
    const paidText = norm(await body());
    check("статусът е „Платена“", paidText.includes("Платена"));
    check("показано е платеното", paidText.includes("Платено") && paidText.includes("414,50 €"));
    check("няма бутон за плащане", !paidText.includes("Отбележи плащане"));
    check("няма бутон за анулиране на платен документ", !paidText.includes("Анулирай документа"));

    /* 8. Чернова (проформа) — редакция и изтриване */
    step("Чернова и проформа");
    await page.goto(`${BASE}/dashboard/invoices/new`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('select[name="doc_type"]');
    await setValue('select[name="doc_type"]', "proforma");
    await setValue('input[name="client_name"]', "Проформен Клиент ЕООД");
    await fillRow(0, { name: "Годишна такса", unit: "месец", quantity: 1, price: 100, vat: 20 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    await clickButton("Създай чернова");
    await page.waitForFunction(
      () => /\/dashboard\/invoices\/[0-9a-f-]{8,}/.test(location.pathname),
      { timeout: 60_000 },
    );
    await waitText("Чернова — може да се редактира");
    const draftUrl = page.url();
    const draftId = draftUrl.split("/").pop();
    const draftText = norm(await body());
    check("черновата е създадена", draftText.includes("Чернова — може да се редактира"));
    check("проформата е в своя серия", draftText.includes("ПРО-0000000001"), draftText.slice(0, 200));
    check("има бутон за изтриване на чернова", draftText.includes("Изтрий черновата"));

    // редакция на чернова: количество 1 → 3
    await fillRow(0, { name: "Годишна такса", unit: "месец", quantity: 3, price: 100, vat: 20 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    await clickButton("Запази черновата");
    await afterAction("Черновата е обновена");
    await page.waitForFunction(
      () => /Черновата е обновена|360,00 €/.test(document.body.innerText),
      { timeout: 40_000 },
    );
    const editedText = norm(await body());
    check("черновата се редактира", editedText.includes("360,00 €"), editedText.slice(-200));

    await clickButton("Изтрий черновата");
    await afterAction("е изтрита");
    await page.waitForFunction(
      () => location.pathname === "/dashboard/invoices" && document.body.innerText.includes("Фактури и проформи"),
      { timeout: 60_000 },
    );
    const afterDelete = norm(
      await page.evaluate(() => document.querySelector("table")?.innerText || ""),
    );
    check("черновата е изтрита от регистъра", !afterDelete.includes("ПРО-0000000001"), afterDelete.slice(0, 200));

    /* 9. Анулиране */
    step("Анулиране");
    await page.goto(`${BASE}/dashboard/invoices/new`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('select[name="doc_type"]');
    await setValue('input[name="client_name"]', "Анулиран Клиент ЕООД");
    await fillRow(0, { name: "Консултация", unit: "час", quantity: 1, price: 80, vat: 20 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    await clickButton("Издай документа");
    await page.waitForFunction(
      () => /\/dashboard\/invoices\/[0-9a-f-]{8,}/.test(location.pathname),
      { timeout: 60_000 },
    );
    await waitText("Общо за плащане");
    const cancelId = page.url().split("/").pop();
    const secondText = norm(await body());
    check("номератата са непрекъснати", secondText.includes("0000000002"), secondText.slice(0, 200));

    await setValue('input[name="reason"]', "Издадена по грешка");
    await clickButton("Анулирай документа");
    await afterAction("Анулиран документ");
    await page.waitForFunction(() => document.body.innerText.includes("Анулиран документ"), {
      timeout: 40_000,
    });
    const cancelledText = norm(await body());
    check("статусът е „Анулирана“", cancelledText.includes("Анулирана"));
    check("показана е причината", cancelledText.includes("Издадена по грешка"));

    await page.goto(`${BASE}/print/invoice/${cancelId}`, { waitUntil: "domcontentloaded" });
    await waitText("ФАКТУРА");
    const cancelledPrint = norm(await body());
    const watermark = await page.evaluate(() => {
      const span = [...document.querySelectorAll("span")].find(
        (node) => node.textContent.trim().toUpperCase() === "АНУЛИРАНА",
      );
      return span ? span.textContent.trim() : null;
    });
    check("воден знак „Анулирана“ в печатния вид", watermark !== null, String(watermark));
    check("причината е отпечатана", cancelledPrint.includes("Издадена по грешка"));

    /* 10. Кредитно известие */
    step("Кредитно известие");
    await page.goto(`${BASE}/dashboard/invoices/${invoiceId}`, { waitUntil: "domcontentloaded" });
    await waitText("Кредитно известие");
    await clickLink("Кредитно известие");
    await page.waitForFunction(() => location.pathname === "/dashboard/invoices/new", {
      timeout: 60_000,
    });
    await waitText("Копиране на данни");
    const copyText = norm(await body());
    check("данните се копират с предупреждение", copyText.includes("Копиране на данни"));
    const copyType = await page.evaluate(
      () => document.querySelector('select[name="doc_type"]')?.value,
    );
    check("видът е кредитно известие", copyType === "credit_note", String(copyType));
    const copiedName = await page.evaluate(
      () => document.querySelector('input[name="client_name"]')?.value,
    );
    check("получателят е копиран", copiedName === clientName, String(copiedName));

    await clickButton("Издай документа");
    await page.waitForFunction(
      () => /\/dashboard\/invoices\/[0-9a-f-]{8,}/.test(location.pathname),
      { timeout: 60_000 },
    );
    await waitText("Корекция на документ");
    const creditText = norm(await body());
    check("известието е в своя серия", creditText.includes("КИ-0000000001"), creditText.slice(0, 200));
    check("сочи към първичния документ", creditText.includes("Корекция на документ") && creditText.includes("0000000001"));
    check("кредитното известие не се плаща", !creditText.includes("Отбележи плащане"));

    await page.goto(`${BASE}/dashboard/invoices/${invoiceId}`, { waitUntil: "domcontentloaded" });
    await waitText("Има издадени корекции");
    const withCorrection = norm(await body());
    check("първичният документ показва корекцията", withCorrection.includes("Има издадени корекции"));

    /* 11. Филтри и статистика */
    step("Регистър, филтри и статистика");
    await page.goto(`${BASE}/dashboard/invoices`, { waitUntil: "domcontentloaded" });
    await waitText("Фактури и проформи");
    const registryText = norm(await body());
    check("регистърът показва трите документа", ["0000000001", "0000000002", "КИ-0000000001"].every((n) => registryText.includes(n)));
    check("има статистика за неплатени", has(registryText, "Неплатени"));
    check("има статистика за просрочени", has(registryText, "Просрочени"));
    check(
      "кредитното известие не влиза в неплатените",
      has(registryText, "0 документа с остатък"),
      registryText.slice(0, 300),
    );
    await page.screenshot({ path: path.join(SHOTS, "inv-04-registry.png"), fullPage: true });

    await page.goto(`${BASE}/dashboard/invoices?status=paid`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("tbody tr");
    const paidOnly = norm(await body());
    check(
      "филтърът „Платени“ оставя само платената",
      paidOnly.includes("0000000001") && !paidOnly.includes("0000000002"),
    );

    await page.goto(`${BASE}/dashboard/invoices?type=credit_note`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("tbody tr");
    const creditOnly = norm(await body());
    check(
      "филтърът по вид оставя кредитното известие",
      creditOnly.includes("КИ-0000000001") && !creditOnly.includes("0000000002"),
    );

    await page.goto(`${BASE}/dashboard/invoices?q=Анулиран`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("tbody tr");
    const searchText = norm(await body());
    check("търсенето по получател работи", searchText.includes("Анулиран Клиент") && !searchText.includes("КИ-0000000001"));

    /* 12. Контрагент с документи не се трие */
    step("Защита на контрагента");
    await page.goto(`${BASE}/dashboard/invoices/clients`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("tbody tr");
    const usedRow = await page.evaluate((name) => {
      const tr = [...document.querySelectorAll("tbody tr")].find((row) =>
        row.innerText.includes(name),
      );
      return tr
        ? { used: tr.innerText.includes("използван"), text: tr.innerText.replace(/\s+/g, " ") }
        : null;
    }, clientName);
    check("контрагентът е отбелязан като използван", usedRow?.used === true, JSON.stringify(usedRow));

    /* 13. Одиторски журнал */
    step("Одиторски журнал");
    await page.goto(`${BASE}/dashboard/settings/audit`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("tbody tr");
    const auditText = norm(await body());
    check("журналът отчита издаването", auditText.includes("invoice.issued"));
    check("журналът отчита плащането", auditText.includes("invoice.paid"));
    check("журналът отчита анулирането", auditText.includes("invoice.cancelled"));

    /* 14. Мобилна ширина */
    step("Мобилна ширина");
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/dashboard/invoices`, { waitUntil: "domcontentloaded" });
    await waitText("Фактури и проформи");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check("без хоризонтален скрол на телефон", overflow <= 2, `${overflow}px`);
    await page.screenshot({ path: path.join(SHOTS, "inv-05-mobile.png"), fullPage: false });
    await page.setViewport({ width: 1440, height: 1000 });
  } catch (error) {
    failed += 1;
    failures.push(`изключение: ${error.message}`);
    console.log(`\n💥 ${error.message}`);
    try {
      await page.screenshot({ path: path.join(SHOTS, "inv-error.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await browser.close();
    server.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 800));

    console.log(`\nРезултат: ${passed} успешни, ${failed} неуспешни`);
    if (failed > 0) console.log("Провали:\n - " + failures.join("\n - "));
    process.exit(failed === 0 ? 0 : 1);
  }
}

main();
