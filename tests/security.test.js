import test from "node:test";
import assert from "node:assert/strict";

import { getAllowedOrigins, getCookieOptions } from "../src/config/security.js";

test("production cookies use cross-site compatible settings", () => {
  const options = getCookieOptions({ isProd: true, path: "/", maxAge: 15 * 60 * 1000 });

  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "none");
  assert.equal(options.httpOnly, true);
});

test("comma-separated CORS origins are parsed into an allowlist", () => {
  const origins = getAllowedOrigins("https://a.example.com, https://b.example.com");

  assert.deepEqual(origins, ["https://a.example.com", "https://b.example.com"]);
});
