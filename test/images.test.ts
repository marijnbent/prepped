import assert from "node:assert/strict";
import test from "node:test";
import { decodeBase64Image, getUploadPath, MAX_IMAGE_SIZE_BYTES } from "../src/lib/images";

test("rejects upload paths outside the managed directory", () => {
  assert.equal(getUploadPath("../../package.json"), null);
  assert.equal(getUploadPath("/etc/passwd"), null);
});

test("rejects oversized base64 data before image processing", () => {
  const oversizedPayload = "A".repeat(Math.ceil(MAX_IMAGE_SIZE_BYTES * 4 / 3) + 8);
  assert.throws(() => decodeBase64Image(oversizedPayload), /File too large/);
});
