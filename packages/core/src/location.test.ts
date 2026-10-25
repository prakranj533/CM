import assert from "node:assert/strict";
import { test } from "node:test";
import { isIndiaLocation } from "./location.js";

test("explicit India mentions match", () => {
  assert.equal(isIndiaLocation("India"), true);
  assert.equal(isIndiaLocation("Bengaluru, India"), true);
  assert.equal(isIndiaLocation("Remote - India"), true);
  assert.equal(isIndiaLocation("PAN India"), true);
  assert.equal(isIndiaLocation("Australia, Canada, India, Ireland, United States"), true);
});

test("bare Indian city names match", () => {
  assert.equal(isIndiaLocation("Bengaluru"), true);
  assert.equal(isIndiaLocation("Gurgaon, Haryana"), true);
  assert.equal(isIndiaLocation("Hyderabad / Pune"), true);
  assert.equal(isIndiaLocation("Noida, UP"), true);
  assert.equal(isIndiaLocation("Thiruvananthapuram"), true);
});

test("non-India locations do not match", () => {
  assert.equal(isIndiaLocation("United States"), false);
  assert.equal(isIndiaLocation("New York, NY (HQ) · Remote (US)"), false);
  assert.equal(isIndiaLocation("Berlin, Germany"), false);
  assert.equal(isIndiaLocation(null), false);
  assert.equal(isIndiaLocation(undefined), false);
  assert.equal(isIndiaLocation(""), false);
});

test("Indiana is not India", () => {
  assert.equal(isIndiaLocation("Indiana"), false);
  assert.equal(isIndiaLocation("Indianapolis, IN"), false);
});
