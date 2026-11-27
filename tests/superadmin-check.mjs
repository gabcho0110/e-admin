import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3300";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ALEX = { email: "atodorov434@gmail.com", password: "Aleks2010$" };

let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100 });

async function login(email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 90_000 });
  await page.evaluate(() => {
    document.querySelectorAll('input[name="email"], input[name="password"]').forEach((el) => {
      el.value = "";
    });
  });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  await page.evaluate(() => document.querySelector("form")?.requestSubmit());
  await new Promise((r) => setTimeout(r, 6000));
}

async function logout() {
  await page.evaluate(() => {
    const form = Array.from(document.querySelectorAll("form")).find((f) =>
      (f.getAttribute("action") || "").includes("/api/auth/logout"),
    );
    form?.requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 4000));
}

try {
  console.log("1. Вход със защитения суперадминистратор");
  await login(ALEX.email, ALEX.password);
  check("входът води до таблото", page.url().includes("/dashboard"), page.url());

  const dash = await page.evaluate(() => document.body.innerText);
  check("името се вижда в хедъра", dash.includes("Алекс Тодоров"));

  console.log("2. Профилът е заключен");
  await page.goto(`${BASE}/dashboard/staff`, { waitUntil: "networkidle2", timeout: 90_000 });
  const row = await page.evaluate(() => {
    const tr = Array.from(document.querySelectorAll("tr")).find((r) =>
      r.innerText.includes("atodorov434@gmail.com"),
    );
    return tr ? { text: tr.innerText.replace(/\s+/g, " "), html: tr.innerHTML } : null;
  });
  check("профилът е в списъка", !!row);
  check(
    "маркер за заключен/текущ профил",
    !!row && (row.text.includes("заключен профил") || row.text.includes("текущ профил")),
    row?.text,
  );
  check("няма бутон „Управление“", !!row && !row.text.includes("Управление"));
  check("роля „Суперадминистратор“", !!row && row.text.includes("Суперадминистратор"));

  const canCreate = await page.evaluate(() =>
    document.body.innerText.includes("Нов служебен профил"),
  );
  check("има форма за нов профил", canCreate);

  console.log("3. Създава втори администратор");
  const stamp = Date.now().toString().slice(-5);
  const deputyEmail = `test.director.${stamp}@pig-ohridski.bg`;
  await page.evaluate((email) => {
    const form = Array.from(document.querySelectorAll("form")).find((f) =>
      f.querySelector('input[name="email"]'),
    );
    const set = (name, value) => {
      const el = form.querySelector(`[name="${name}"]`);
      const proto =
        el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    set("full_name", "Тестов Директор");
    set("email", email);
    set("position", "Директор (тест)");
    set("password", "Test1234!");
    // Ролите са множествени (checkbox) — оставяме отметка само на „director“.
    form.querySelectorAll('input[name="role_key"]').forEach((box) => {
      const should = box.value === "director";
      if (box.checked !== should) box.click();
    });
    form.requestSubmit();
  }, deputyEmail);
  await new Promise((r) => setTimeout(r, 9000));
  const afterCreate = await page.evaluate(() => document.body.innerText);
  check("новият профил е създаден", afterCreate.includes(deputyEmail));

  console.log("4. Новият профил може да влезе");
  await logout();
  await login(deputyEmail, "Test1234!");
  check("входът на новия директор работи", page.url().includes("/dashboard"), page.url());

  console.log("4б. Друг администратор вижда профила като заключен");
  await page.goto(`${BASE}/dashboard/staff`, { waitUntil: "networkidle2", timeout: 90_000 });
  const otherView = await page.evaluate(() => {
    const tr = Array.from(document.querySelectorAll("tr")).find((r) =>
      r.innerText.includes("atodorov434@gmail.com"),
    );
    return tr ? tr.innerText.replace(/\s+/g, " ") : null;
  });
  check("вижда „заключен профил“", !!otherView && otherView.includes("заключен профил"), otherView || "");
  check("не вижда „Управление“ за него", !!otherView && !otherView.includes("Управление"));

  console.log("5. Грешна парола се отхвърля");
  await logout();
  await login(ALEX.email, "WrongPass1!");
  const denied = await page.evaluate(() => document.body.innerText);
  check("показва грешка", denied.includes("Невалиден имейл или парола"), page.url());
  check("не пуска в таблото", !page.url().includes("/dashboard"));

  console.log("6. Правилната парола пак работи");
  await login(ALEX.email, ALEX.password);
  check("входът е възстановен", page.url().includes("/dashboard"), page.url());

  await page.screenshot({ path: "/tmp/superadmin-check.png" });
} finally {
  await browser.close();
  await cleanup();
}

/** Премахва тестовите профили, ако проверката е пускана срещу Firebase. */
async function cleanup() {
  const db = process.env.FIREBASE_DB;
  if (!db) return;
  try {
    const users = await fetch(`${db}/tables/users.json`).then((r) => r.json());
    const roles = await fetch(`${db}/tables/user_roles.json`).then((r) => r.json());
    const doomed = Object.entries(users || {}).filter(([, u]) =>
      String(u.email || "").startsWith("test.director."),
    );
    for (const [id] of doomed) {
      for (const [roleId, role] of Object.entries(roles || {})) {
        if (role.user_id === id) {
          await fetch(`${db}/tables/user_roles/${roleId}.json`, { method: "DELETE" });
        }
      }
      await fetch(`${db}/tables/users/${id}.json`, { method: "DELETE" });
    }
    if (doomed.length) console.log(`(изтрити ${doomed.length} тестови профила)`);
  } catch (error) {
    console.log("(почистването не успя:", error.message, ")");
  }
}

console.log(`\n${pass} успешни, ${fail} неуспешни`);
process.exit(fail === 0 ? 0 : 1);
