import { describe, it, expect } from "vitest";
import { rulesFor } from "./rls";
import type { Principal } from "./principal";

/**
 * Isolation-invariant tests (plan emphasis 1). These exercise the RLS rule
 * predicates directly - the load-bearing guarantee that no function can read or
 * write across the manager/tenant boundary (PRD §10 / Fix #5).
 */

const MGR_A = "mgrA" as unknown as Principal & { managerId: string };
const managerA: Principal = { kind: "manager", userId: "uA" as never, managerId: "mgrA" as never };
const managerB: Principal = { kind: "manager", userId: "uB" as never, managerId: "mgrB" as never };
const tenantX: Principal = {
  kind: "tenant",
  userId: "uX" as never,
  tenantId: "tenX" as never,
  managerId: "mgrA" as never,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const doc = (o: Record<string, unknown>) => o as any;

describe("manager isolation", () => {
  const rules = rulesFor(managerA);

  it("reads only its own properties", async () => {
    expect(await rules.properties!.read!(null, doc({ managerId: "mgrA" }))).toBe(true);
    expect(await rules.properties!.read!(null, doc({ managerId: "mgrB" }))).toBe(false);
  });

  it("cannot insert rows stamped with a different manager", async () => {
    expect(await rules.tenants!.insert!(null, doc({ managerId: "mgrA" }))).toBe(true);
    expect(await rules.tenants!.insert!(null, doc({ managerId: "mgrB" }))).toBe(false);
  });

  it("cannot read another manager's charges/tenants", async () => {
    expect(await rules.charges!.read!(null, doc({ managerId: "mgrB", tenantId: "z" }))).toBe(false);
    expect(await rules.tenants!.read!(null, doc({ _id: "x", managerId: "mgrB" }))).toBe(false);
  });
});

describe("append-only immutability (Fix #1 / #3)", () => {
  const rules = rulesFor(managerA);
  it("forbids modifying charges, payments, snapshots, notices, audit logs", async () => {
    expect(await rules.charges!.modify!(null, doc({ managerId: "mgrA" }))).toBe(false);
    expect(await rules.payments!.modify!(null, doc({ managerId: "mgrA" }))).toBe(false);
    expect(await rules.tenantScoreSnapshots!.modify!(null, doc({ managerId: "mgrA" }))).toBe(false);
    expect(await rules.notices!.modify!(null, doc({ managerId: "mgrA" }))).toBe(false);
    expect(await rules.auditLogs!.modify!(null, doc({ managerId: "mgrA" }))).toBe(false);
  });
});

describe("tenant isolation", () => {
  const rules = rulesFor(tenantX);

  it("reads only its own tenant row and financial rows", async () => {
    expect(await rules.tenants!.read!(null, doc({ _id: "tenX", managerId: "mgrA" }))).toBe(true);
    expect(await rules.tenants!.read!(null, doc({ _id: "tenY", managerId: "mgrA" }))).toBe(false);
    expect(await rules.charges!.read!(null, doc({ tenantId: "tenX", managerId: "mgrA" }))).toBe(true);
    expect(await rules.charges!.read!(null, doc({ tenantId: "tenY", managerId: "mgrA" }))).toBe(false);
  });

  it("cannot read properties/units at all", async () => {
    expect(await rules.properties!.read!(null, doc({ managerId: "mgrA" }))).toBe(false);
    expect(await rules.units!.read!(null, doc({ managerId: "mgrA" }))).toBe(false);
  });

  it("cannot insert or modify anything", async () => {
    expect(await rules.tenants!.insert!(null, doc({ managerId: "mgrA" }))).toBe(false);
    expect(await rules.notices!.insert!(null, doc({ managerId: "mgrA" }))).toBe(false);
    expect(await rules.charges!.modify!(null, doc({ managerId: "mgrA", tenantId: "tenX" }))).toBe(false);
  });

  // Reference kept to avoid unused-var lint on the illustrative alias.
  void MGR_A;
  void managerB;
});

describe("manager write rules", () => {
  const rules = rulesFor(managerA);

  it("allows insert on owned rows only", async () => {
    expect(await rules.properties!.insert!(null, doc({ managerId: "mgrA" }))).toBe(true);
    expect(await rules.units!.insert!(null, doc({ managerId: "mgrA" }))).toBe(true);
    expect(await rules.charges!.insert!(null, doc({ managerId: "mgrA" }))).toBe(true);
    expect(await rules.payments!.insert!(null, doc({ managerId: "mgrB" }))).toBe(false);
  });

  it("allows modify on mutable manager-owned rows", async () => {
    expect(await rules.properties!.modify!(null, doc({ managerId: "mgrA" }))).toBe(true);
    expect(await rules.tenants!.modify!(null, doc({ managerId: "mgrA" }))).toBe(true);
    expect(await rules.propertyManagers!.modify!(null, doc({ _id: "mgrA", managerId: "mgrA" }))).toBe(true);
  });
});
