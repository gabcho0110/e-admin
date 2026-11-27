import puppeteer from "puppeteer-core";

/**
 * Проверка на множествените роли (един човек → няколко роли).
 *
 *  1. администраторът създава профил с две роли от регистъра;
 *  2. редът показва две значки с имената на ролите;
 *  3. страницата „Управление“ отваря и двете отметки;
 *  4. премахване на една роля → остава една;
 *  5. връщане на втората роля → пак две;
 *  6. профилът се изтрива (почистване).
 *
 * Стартиране: BASE_URL=http://127.0.0.1:3500 node tests/multi-role.mjs
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:3500";
const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ADMIN = {
  email: process.env.ADMIN_EMAIL || "admin@pig-ohridski.bg",
  password: process.env.ADMIN_PW || "Admin123!",
};

const ROLE_DIRECTOR_DEPUTY = "Заместник-директор";
const ROLE_TEACHER = "Преподавател";

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100 });
page.on("dialog", (dialog) => dialog.accept());

const stamp = Date.now().toString().slice(-6);
const person = {
  name: `Тест Роли ${stamp}`,
  email: `test.roles.${stamp}@pig-ohridski.bg`,
  password: "Test1234!",
};

/** Брои значките с даден текст в реда на служителя. */
async function badgesInRow(email) {
  return page.evaluate((mail) => {
    const row = [...document.querySelectorAll("tbody tr")].find((tr) =>
      tr.innerText.includes(mail),
    );
    if (!row) return null;
    return [...row.querySelectorAll("span")]
      .map((el) => el.textContent.trim())
      .filter(Boolean);
  }, email);
}

async function openManage(email) {
  await page.goto(`${BASE}/dashboard/staff`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("tbody tr", { timeout: 60_000 });
  const href = await page.evaluate((mail) => {
    const row = [...document.querySelectorAll("tbody tr")].find((tr) =>
      tr.innerText.includes(mail),
    );
    return row?.querySelector('a[href^="/dashboard/staff/"]')?.getAttribute("href") || null;
  }, email);
  if (!href) throw new Error("няма връзка „Управление“ за " + email);
  await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('input[name="role_key"]', { timeout: 60_000 });
  await sleep(600);
  return href;
}

/** Връща списък от стойностите на отметнатите роли. */
async function checkedRoles() {
  const state = await page.evaluate(() => ({
    url: location.href,
    boxes: document.querySelectorAll('input[name="role_key"]').length,
    checked: [...document.querySelectorAll('input[name="role_key"]')]
      .filter((el) => el.checked)
      .map((el) => el.value),
    head: document.body.innerText.slice(0, 140).replace(/\s+/g, " "),
    full: document.body.innerText.length,
    lockedHint: document.body.innerText.includes("не се променят оттук"),
    notFound: document.body.innerText.includes("не е намерена") || document.body.innerText.includes("404"),
  }));
  if (process.env.DEBUG_ROLES) console.log("   ·", JSON.stringify(state));
  return state.checked;
}

async function submitRoles(values) {
  await page.evaluate((wanted) => {
    const boxes = [...document.querySelectorAll('input[name="role_key"]')];
    for (const box of boxes) {
      const should = wanted.includes(box.value);
      if (box.checked !== should) box.click();
    }
  }, values);
  await sleep(300);
  await page.evaluate(() => {
    const form = document.querySelector('input[name="role_key"]').closest("form");
    form.requestSubmit();
  });
  // Изчакваме сървърното действие да пренасочи с ?ok= / ?err= (на живо е по-бавно),
  // а после и клиентският рутер да изрисува съдържанието на страницата.
  await page
    .waitForFunction(() => /[?&](ok|err)=/.test(location.search), { timeout: 90_000 })
    .catch(() => {});
  await page
    .waitForFunction(
      () => document.querySelectorAll('input[name="role_key"]').length > 0,
      { timeout: 90_000 },
    )
    .catch(() => {});
  await sleep(600);
}

try {
  console.log("1. Вход като администратор");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('input[name="email"]', { timeout: 60_000 });
  await sleep(1200);
  await page.click('input[name="email"]');
  await page.type('input[name="email"]', ADMIN.email);
  await page.click('input[name="password"]');
  await page.type('input[name="password"]', ADMIN.password);
  await (await page.$('button[type="submit"]')).click();
  await page.waitForFunction(() => location.pathname.startsWith("/dashboard"), { timeout: 90_000 });
  check("вход OK", page.url().includes("/dashboard"));

  console.log("2. Формулярът за нов профил предлага отметки за роли");
  await page.goto(`${BASE}/dashboard/staff`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('input[name="full_name"]', { timeout: 60_000 });
  await sleep(800);
  const roleBoxes = await page.$$eval('input[name="role_key"]', (els) =>
    els.map((el) => el.value),
  );
  check("поне 8 отметки за роли", roleBoxes.length >= 8, `намерени: ${roleBoxes.length}`);
  check("полетата са множествени (checkbox)", await page.$$eval('input[name="role_key"]', (els) => els.every((el) => el.type === "checkbox")));

  console.log("3. Създаване на профил с две роли");
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
      set("position", "Заместник-директор по качеството");
      set("password", password);
      // учителят е отметнат по подразбиране → добавяме втората роля
      const deputy = form.querySelector('input[name="role_key"][value="deputy_director"]');
      if (deputy && !deputy.checked) deputy.click();
      form.requestSubmit();
    },
    { name: person.name, email: person.email, password: person.password },
  );
  await page.waitForFunction(
    (email) => document.body.innerText.includes(email),
    { timeout: 90_000 },
    person.email,
  );
  await sleep(800);

  const badges = await badgesInRow(person.email);
  check("профилът е в регистъра", badges !== null);
  check(
    "показани са и двете роли",
    badges !== null && badges.includes(ROLE_DIRECTOR_DEPUTY) && badges.includes(ROLE_TEACHER),
    JSON.stringify(badges),
  );

  console.log("4. Страница „Управление“ — двете роли са отметнати");
  await openManage(person.email);
  const initial = await checkedRoles();
  check(
    "отметнати са deputy_director и teacher",
    initial.includes("deputy_director") && initial.includes("teacher"),
    JSON.stringify(initial),
  );

  console.log("5. Премахване на едната роля");
  await submitRoles(["deputy_director"]);
  const afterRemove = await checkedRoles();
  check(
    "остава само deputy_director",
    afterRemove.length === 1 && afterRemove[0] === "deputy_director",
    JSON.stringify(afterRemove),
  );

  await page.goto(`${BASE}/dashboard/staff`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("tbody tr", { timeout: 60_000 });
  const oneBadge = await badgesInRow(person.email);
  check(
    "в регистъра остана една роля",
    oneBadge !== null && oneBadge.includes(ROLE_DIRECTOR_DEPUTY) && !oneBadge.includes(ROLE_TEACHER),
    JSON.stringify(oneBadge),
  );

  console.log("6. Връщане на втората роля");
  await openManage(person.email);
  await submitRoles(["deputy_director", "teacher", "committee_member"]);
  const threeRoles = await checkedRoles();
  check("записани са три роли", threeRoles.length === 3, JSON.stringify(threeRoles));

  await page.goto(`${BASE}/dashboard/staff`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("tbody tr", { timeout: 60_000 });
  const threeBadges = await badgesInRow(person.email);
  check(
    "в регистъра се виждат трите роли",
    threeBadges !== null &&
      threeBadges.includes(ROLE_DIRECTOR_DEPUTY) &&
      threeBadges.includes(ROLE_TEACHER) &&
      threeBadges.includes("Член на комисия"),
    JSON.stringify(threeBadges),
  );

  console.log("7. Поне една роля е задължителна");
  await openManage(person.email);
  await submitRoles([]);
  const stillThere = await checkedRoles();
  check(
    "без отметки ролите не се изтриват",
    stillThere.length === 3,
    JSON.stringify(stillThere),
  );
  await page
    .waitForFunction(() => document.body.innerText.includes("Изберете поне една роля"), {
      timeout: 30_000,
    })
    .catch(() => {});
  const flash = await page.evaluate(() => document.body.innerText);
  check("показва се съобщение за грешка", flash.includes("Изберете поне една роля"));
  console.log("8. Почистване");
  await page.goto(`${BASE}/dashboard/staff`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("tbody tr", { timeout: 60_000 });
  const href = await openManage(person.email);
  await page.evaluate(() => {
    const form = [...document.querySelectorAll("form")].find((f) =>
      f.querySelector('input[name="user_id"]') && f.innerText.includes("Изтрий профила"),
    );
    form?.requestSubmit();
  });
  await page
    .waitForFunction(() => /[?&](ok|err)=/.test(location.search), { timeout: 90_000 })
    .catch(() => {});
  await sleep(1500);
  await page.goto(`${BASE}/dashboard/staff`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("tbody tr", { timeout: 60_000 });
  const gone = await page.evaluate(
    (email) => !document.body.innerText.includes(email),
    person.email,
  );
  check("тестовият профил е изтрит", gone, href);
} catch (error) {
  fail += 1;
  console.log(`\n💥 Грешка: ${error.message}`);
} finally {
  await browser.close();
  console.log(`\nРезултат: ${pass} успешни, ${fail} неуспешни`);
  process.exit(fail === 0 ? 0 : 1);
}
