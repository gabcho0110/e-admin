import { describe, expect, it } from "vitest";

import { allowedNavSections, navLabelFor } from "@/lib/navigation";
import { daysUntil, formatBytes, initials, percent, pluralBg, todayIso, truncate } from "@/lib/utils";
import { APPLICATION_STATUS, DOC_TYPE } from "@/lib/labels";
import { ROLE_MAP } from "@/lib/permissions/roles";

describe("навигация по права", () => {
  it("показва само позволените секции", () => {
    const sections = allowedNavSections(["dashboard.view", "notifications.view"]);
    const labels = sections.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).toContain("Табло");
    expect(labels).toContain("Известия");
    expect(labels).not.toContain("Персонал");
    expect(labels).not.toContain("Настройки");
    expect(labels).not.toContain("Акредитация");
  });

  it("директорът вижда всички секции", () => {
    const sections = allowedNavSections(ROLE_MAP.director.permissions);
    const labels = sections.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).toEqual(
      expect.arrayContaining([
        "Табло",
        "Кандидатстване",
        "Подбор на персонал",
        "Акредитация",
        "Документи",
        "Персонал",
        "Комисии",
        "Задачи",
        "Качество",
        "Анализи",
        "Известия",
        "Настройки",
      ]),
    );
  });

  it("връща заглавие за път и за подпът", () => {
    expect(navLabelFor("/dashboard")).toBe("Табло");
    expect(navLabelFor("/dashboard/selection")).toBe("Подбор на персонал");
    expect(navLabelFor("/dashboard/selection/abc")).toBe("Подбор на персонал");
    expect(navLabelFor("/непознат")).toBe("PIG e-ADMIN");
  });
});

describe("помощни функции", () => {
  it("изчислява оставащи дни", () => {
    const inFive = new Date(Date.now() + 5 * 86_400_000).toISOString();
    expect(daysUntil(inFive)).toBe(5);
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil("невалидна дата")).toBeNull();
  });

  it("форматира размери", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatBytes(null)).toBe("—");
  });

  it("извлича инициали", () => {
    expect(initials("Радослав Якимов")).toBe("РЯ");
    expect(initials("Алекс")).toBe("А");
    expect(initials("  ")).toBe("");
  });

  it("изчислява проценти безопасно", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 4)).toBe(100);
  });

  it("скъсява текст", () => {
    expect(truncate("кратко", 20)).toBe("кратко");
    expect(truncate("а".repeat(30), 10)).toHaveLength(11); // 10 знака + многоточие
  });

  it("съгласува число и съществително", () => {
    expect(pluralBg(1, "ден", "дни")).toBe("1 ден");
    expect(pluralBg(3, "ден", "дни")).toBe("3 дни");
  });

  it("връща днешна дата в ISO формат", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("етикети", () => {
  it("всички статуси на кандидатура имат етикет и тон", () => {
    for (const [key, meta] of Object.entries(APPLICATION_STATUS)) {
      expect(key.length).toBeGreaterThan(2);
      expect(meta.label.length).toBeGreaterThan(2);
      expect(meta.tone).toBeTruthy();
    }
  });

  it("видовете документи са с български наименования", () => {
    expect(DOC_TYPE.order.label).toBe("Заповед");
    expect(DOC_TYPE.protocol.label).toBe("Протокол");
    expect(DOC_TYPE.reference.label).toBe("Служебна справка");
  });
});
