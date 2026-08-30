import { describe, it, expect } from "vitest";

import {
  comboRoutedModels,
  normalizeDisabledMembers,
} from "../../open-sse/services/comboMembers.js";
import { getComboModelsFromData } from "../../open-sse/services/combo.js";
import { getComboCapabilities } from "../../src/lib/publishedModelsCatalog.js";

describe("normalizeDisabledMembers", () => {
  it("drops entries that are not members of the route", () => {
    expect(normalizeDisabledMembers(["a/1", "gone/9"], ["a/1", "b/2"])).toEqual(["a/1"]);
  });

  it("de-duplicates, trims, and rejects non-arrays", () => {
    expect(normalizeDisabledMembers([" a/1 ", "a/1", ""], ["a/1"])).toEqual(["a/1"]);
    expect(normalizeDisabledMembers({ "a/1": true }, ["a/1"])).toEqual([]);
    expect(normalizeDisabledMembers(undefined)).toEqual([]);
  });

  it("keeps every entry when no member list is given", () => {
    expect(normalizeDisabledMembers(["a/1", "b/2"])).toEqual(["a/1", "b/2"]);
  });
});

describe("comboRoutedModels", () => {
  it("preserves member order while skipping switched-off members", () => {
    expect(comboRoutedModels({
      models: ["a/1", "b/2", "c/3"],
      disabledMembers: ["b/2"],
    })).toEqual(["a/1", "c/3"]);
  });

  it("returns the original array untouched when nothing is disabled", () => {
    const models = ["a/1", "b/2"];
    expect(comboRoutedModels({ models })).toBe(models);
    expect(comboRoutedModels({ models, disabledMembers: [] })).toBe(models);
  });

  it("survives a missing combo or member list", () => {
    expect(comboRoutedModels(undefined)).toEqual([]);
    expect(comboRoutedModels({ disabledMembers: ["a/1"] })).toEqual([]);
  });
});

describe("routing with switched-off members", () => {
  const combos = [{
    name: "route-a",
    models: ["codex/gpt-5.6-sol", "glm/glm-5"],
    disabledMembers: ["codex/gpt-5.6-sol"],
  }];

  it("expands a combo to its enabled members only", () => {
    expect(getComboModelsFromData("route-a", combos)).toEqual(["glm/glm-5"]);
  });

  // A route with every member off must be indistinguishable from an empty route,
  // or the router would try to fall back across zero models.
  it("treats an all-off route as no combo at all", () => {
    expect(getComboModelsFromData("route-a", [{
      name: "route-a",
      models: ["codex/gpt-5.6-sol"],
      disabledMembers: ["codex/gpt-5.6-sol"],
    }])).toBeNull();
  });
});

describe("advertised capabilities with switched-off members", () => {
  // codex/gpt-5.6-sol advertises search; oc/mimo-v2.5-free does not. Switching the
  // only search-capable member off must stop the public model claiming search.
  it("derives Caps from the enabled members only", () => {
    const models = ["codex/gpt-5.6-sol", "oc/mimo-v2.5-free"];
    expect(getComboCapabilities({ models }).search).toBe(true);
    expect(getComboCapabilities({
      models,
      disabledMembers: ["codex/gpt-5.6-sol"],
    }).search).toBe(false);
  });

  it("still lets an explicit override win over the derived value", () => {
    expect(getComboCapabilities({
      models: ["codex/gpt-5.6-sol"],
      disabledMembers: ["codex/gpt-5.6-sol"],
      capabilityOverrides: { search: true },
    }).search).toBe(true);
  });
});
