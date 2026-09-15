"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { safeReturnPath } = require("../../apps/api/dist/modules/identity/return-path");

test("safe relative return paths retain local route, query and fragment", () => {
  assert.equal(safeReturnPath("/manage.html?tab=projects#versions"), "/manage.html?tab=projects#versions");
  assert.equal(safeReturnPath(null), "/");
  assert.equal(safeReturnPath("projects"), "/");
});

test("return paths reject origin escapes, controls, backslashes and repeated encoding", () => {
  for (const candidate of [
    "//evil.example",
    "/%2f%2fevil.example",
    "/%252f%252fevil.example",
    "/\\evil.example",
    "/ok\u0000bad",
    "https://evil.example/",
  ]) {
    assert.equal(safeReturnPath(candidate), "/", candidate);
  }
});
