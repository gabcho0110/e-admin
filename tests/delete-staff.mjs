import puppeteer from "puppeteer-core";

/**
 * Проверка на изтриването на служебни профили.
 *
 *  1. администраторът създава профил;
 *  2. отваря „Управление“ и изтрива профила;
 *  3. редът изчезва от регистъра;
 *  4. защитеният и собственият профил нямат „Управление“.
 *
 * Стартиране: BASE_URL=http://127.0.0.1:3500 node tests/delete-staff.mjs
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:3500";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ADMIN = {
  email: process.env.ADMIN_EMAIL || "admin@pig-ohridski.bg",
  password: process.env.ADMIN_PW || "Admin123!",
};

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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
page.on("dialog", (dialog) => dialog.accept());

const stamp = Date.now().toString().slice(-6);
const person = {
  name: `Тест Затриване ${stamp}`,
  email: `test.delete.${stamp}@pig-ohridski.bg`,
  password: "Test1234!",
};

try {
  console.log("1. Вход като администратор");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForSelector('input[name="email"]');
  await new Promise((r) => setTimeout(r, 1200));
  await page.click('input[name="email"]');
  await page.type('input[name="email"]', ADMIN.email);
  await page.click('input[name="password"]');
  await page.type('input[name="password"]', ADMIN.password);
  await (await page.$('button[type="submit"]')).click();
  await page.waitForFunction(() => location.pathname.startsWith("/dashboard"), { timeout: 90_000 });
  check("вход OK", page.url().includes("/dashboard"));

  console.log("2. Създаване на профил");
  await page.goto(`${BASE}/dashboard/staff`, { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForSelector('input[name="full_name"]');
  await page.evaluate(
    ({ name, email, password }) => {
      const form = document.querySelector('form input[name="full_name"]')?.closest("form");
      const set = (field, value) => {
        const el = form.querySelector(`[name="${field}"]`);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("full_name", name);
      set("email", email);
      set("position", "Тестов служител");
      set("password", password);
      form.requestSubmit();
    },
    { name: person.name, email: person.email, password: person.password },
  );
  await page.waitForFunction(
    (email) => document.body.innerText.includes(email),
    { timeout: 60_000 },
    person.email,
  );
  check("профилът е в регистъра", true);

  console.log("3. Страница „Управление“");
  await page.evaluate((email) => {
    const row = Array.from(document.querySelectorAll("tr")).find((tr) => tr.innerText.includes(email));
    row?.querySelector('a[href^="/dashboard/staff/"]')?.click();
  }, person.email);
  await page.waitForFunction(() => /\/dashboard\/staff\/[0-9a-f-]{36}/.test(location.pathname), {
    timeout: 60_000,
  });
  const detail = await page.evaluate(() => document.body.innerText);
  check("отваря се профилът", detail.includes(person.email));
  check("има секция за изтриване", /Изтриване на профила/i.test(detail));
  check("има бутон „Изтрий профила“", detail.includes("Изтрий профила"));
  await page.screenshot({ path: "tests/screenshots/30-staff-delete.png" });

  console.log("4. Изтриване");
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find((b) =>
      b.innerText.includes("Изтрий профила"),
    );
    button?.click();
  });
  await page.waitForFunction(() => location.pathname === "/dashboard/staff", { timeout: 60_000 });
  await page.waitForFunction(
    (email) => !document.body.innerText.includes(email),
    { timeout: 60_000 },
    person.email,
  );
  const afterDelete = await page.evaluate(() => document.body.innerText);
  check("профилът изчезна от регистъра", !afterDelete.includes(person.email));
  check("показано е потвърждение", /изтрит/i.test(afterDelete));

  console.log("5. Защитени профили");
  const guards = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tr"));
    const protectedRow = rows.find((tr) => tr.innerText.includes("atodorov434@gmail.com"));
    const selfRow = rows.find((tr) => tr.innerText.includes("admin@pig-ohridski.bg"));
    return {
      protectedHasLink: Boolean(protectedRow?.querySelector('a[href^="/dashboard/staff/"]')),
      protectedLabel: protectedRow?.innerText.includes("заключен профил") ?? false,
      selfHasLink: Boolean(selfRow?.querySelector('a[href^="/dashboard/staff/"]')),
    };
  });
  check("защитеният профил няма „Управление“", !guards.protectedHasLink);
  check("защитеният профил е отбелязан като заключен", guards.protectedLabel);
  check("собственият профил няма „Управление“", !guards.selfHasLink);
} catch (error) {
  console.log("  ⛔", error.message);
  fail += 1;
} finally {
  await browser.close();
}

console.log(`\n${pass} успешни, ${fail} неуспешни`);
process.exit(fail === 0 ? 0 : 1);
