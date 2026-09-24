import { describe, expect, it } from "vitest";
import {
  concealConnectionIdentity,
  getAccountIdentity,
  getShowAccountNamesPreference,
  removeConcealedNameUpdate,
} from "@/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

describe("provider account privacy", () => {
  const connection = {
    name: "Production account",
    email: "owner@example.com",
    displayName: "Owner Name",
  };

  it("replaces every account identifier with the numbered private label", () => {
    expect(getAccountIdentity(connection, false, 2)).toEqual({
      primary: "Account 3",
      secondary: null,
    });
  });

  it("keeps the existing primary and secondary labels when names are shown", () => {
    expect(getAccountIdentity(connection, true, 0)).toEqual({
      primary: "Production account",
      secondary: "owner@example.com",
    });
  });

  it("shows names by default and restores only an explicit hidden preference", () => {
    expect(getShowAccountNamesPreference(null)).toBe(true);
    expect(getShowAccountNamesPreference("true")).toBe(true);
    expect(getShowAccountNamesPreference("false")).toBe(false);
    expect(getShowAccountNamesPreference("invalid")).toBe(true);
  });

  it("conceals identity passed to the edit modal without mutating the account", () => {
    expect(concealConnectionIdentity(connection, "Account 3")).toEqual({
      name: "Account 3",
      email: null,
      displayName: null,
    });
    expect(connection.name).toBe("Production account");
  });

  it("does not overwrite the stored account name while identity is hidden", () => {
    const updates = { name: "Account 3", priority: 2 };
    expect(removeConcealedNameUpdate(updates, true)).toEqual({ priority: 2 });
    expect(removeConcealedNameUpdate(updates, false)).toEqual(updates);
  });
});
