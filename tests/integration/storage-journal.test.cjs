"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MemoryOperationJournal,
  StorageOperationError,
} = require("../../apps/api/dist/platform/storage-operations/journal");

const request = {
  actorId: "2c99b1b7-ae27-4dd1-9db5-64bd7e95b7f2",
  kind: "checkpoint",
  idempotencyKey: "save-01",
  requestHash: "a".repeat(64),
};

test("identical retries return the original operation receipt", () => {
  const journal = new MemoryOperationJournal(() => "e3874272-7b2f-4c8c-903d-ae6e20bdc12d");

  const first = journal.begin(request);
  const retry = journal.begin(request);

  assert.deepEqual(retry, first);
  assert.equal(journal.list().length, 1);
  assert.equal(first.state, "pending");
});

test("an idempotency key cannot be reused for changed content", () => {
  const journal = new MemoryOperationJournal(() => "e3874272-7b2f-4c8c-903d-ae6e20bdc12d");
  journal.begin(request);

  assert.throws(
    () => journal.begin({ ...request, requestHash: "b".repeat(64) }),
    (error) => error instanceof StorageOperationError && error.code === "IDEMPOTENCY_KEY_REUSED",
  );
});

test("operation state can progress forward but never jump from pending to complete", () => {
  const journal = new MemoryOperationJournal(() => "e3874272-7b2f-4c8c-903d-ae6e20bdc12d");
  const operation = journal.begin(request);

  assert.throws(
    () => journal.transition(operation.id, "succeeded"),
    (error) => error instanceof StorageOperationError && error.code === "INVALID_OPERATION_TRANSITION",
  );
  assert.equal(journal.transition(operation.id, "running").state, "running");
  assert.equal(journal.transition(operation.id, "bytes_ready").state, "bytes_ready");
  assert.equal(journal.transition(operation.id, "succeeded").state, "succeeded");
});
