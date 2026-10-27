import test from "node:test";
import assert from "node:assert/strict";
import { en, zh } from "../src/client/locales.js";

test("zh/en dictionaries share keys and have no empty values", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const [key, value] of Object.entries(zh)) {
    assert.equal(typeof value, "string", key);
    assert.notEqual(value.trim(), "", key);
  }
  for (const [key, value] of Object.entries(en)) {
    assert.equal(typeof value, "string", key);
    assert.notEqual(value.trim(), "", key);
  }
});
