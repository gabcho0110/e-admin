import { describe, expect, it } from "vitest";

import {
  ADMIN_ROLES,
  MFA_REQUIRED_ROLES,
  PERMISSION_LABELS,
  ROLE_DEFINITIONS,
  ROLE_LABELS,
  ROLE_MAP,
} from "@/lib/permissions/roles";
import type { Permission } from "@/lib/types";

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

describe("роли и права", () => {
  it("дефинира всичките 10 роли с уникални ключове", () => {
    const keys = ROLE_DEFINITIONS.map((role) => role.key);
    expect(keys).toHaveLength(10);
    expect(new Set(keys).size).toBe(10);
    expect(keys).toEqual(
      expect.arrayContaining([
        "superadmin",
        "director",
        "deputy_director",
        "accreditation_expert",
        "hr_expert",
        "committee_chair",
        "committee_member",
        "ict_officer",
        "teacher",
        "candidate",
      ]),
    );
  });

  it("всяка роля има българско наименование", () => {
    for (const role of ROLE_DEFINITIONS) {
      expect(role.name.length).toBeGreaterThan(2);
      expect(ROLE_LABELS[role.key]).toBe(role.name);
      expect(ROLE_MAP[role.key]).toBe(role);
    }
  });

  it("не съдържа невалидни права", () => {
    for (const role of ROLE_DEFINITIONS) {
      for (const permission of role.permissions) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
    }
  });

  it("всяко право има описание и се използва поне веднъж", () => {
    const used = new Set(ROLE_DEFINITIONS.flatMap((role) => role.permissions));
    for (const permission of ALL_PERMISSIONS) {
      expect(PERMISSION_LABELS[permission].length).toBeGreaterThan(2);
      expect(used.has(permission)).toBe(true);
    }
  });

  it("директорът има пълен институционален контрол", () => {
    const director = ROLE_MAP.director;
    expect(director.permissions).toEqual(
      expect.arrayContaining([
        "dashboard.view",
        "recruitment.manage",
        "applications.review",
        "evaluations.confidential",
        "accreditation.manage",
        "documents.manage",
        "staff.manage",
        "committees.manage",
        "reports.view",
        "settings.manage",
        "audit.view",
        "director.decide",
      ]),
    );
  });

  it("отговорникът ИКТ НЯМА достъп до кадрови досиета и оценки", () => {
    const ict = ROLE_MAP.ict_officer;
    expect(ict.permissions).toContain("settings.manage");
    expect(ict.permissions).not.toContain("staff.view");
    expect(ict.permissions).not.toContain("staff.manage");
    expect(ict.permissions).not.toContain("applications.review");
    expect(ict.permissions).not.toContain("evaluations.confidential");
  });

  it("учителят и кандидатът нямат административни права", () => {
    for (const key of ["teacher", "candidate"] as const) {
      const role = ROLE_MAP[key];
      expect(role.permissions).not.toContain("staff.manage");
      expect(role.permissions).not.toContain("settings.manage");
      expect(role.permissions).not.toContain("applications.review");
      expect(role.permissions).not.toContain("evaluations.confidential");
    }
  });

  it("само директорът и суперадминистраторът могат да решават по кандидатура", () => {
    const deciders = ROLE_DEFINITIONS.filter((role) =>
      role.permissions.includes("director.decide"),
    ).map((role) => role.key);
    expect(deciders.sort()).toEqual(["director", "superadmin"]);
  });

  it("административните роли изискват 2FA", () => {
    expect(MFA_REQUIRED_ROLES).toEqual(expect.arrayContaining(["superadmin", "director"]));
    for (const key of MFA_REQUIRED_ROLES) {
      expect(ADMIN_ROLES).toContain(key);
    }
  });

  it("членовете на комисия виждат поверителните оценки", () => {
    expect(ROLE_MAP.committee_chair.permissions).toContain("evaluations.confidential");
    expect(ROLE_MAP.committee_member.permissions).toContain("evaluations.confidential");
  });
});
