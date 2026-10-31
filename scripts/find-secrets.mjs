// Credential-shape detector used locally and in CI.
//   node scripts/find-secrets.mjs               every file git would commit
//   node scripts/find-secrets.mjs <directory>   a build output such as .next/static
// Prints only "path:line rule"; the matching text itself is never echoed.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RULES = new Map([
  ["google-api-key", /\bAIza[\w-]{35}\b/],
  ["pem-private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["gcp-service-account-json", /"type"\s*:\s*"service_account"/],
  ["github-token", /\bgh[opsur]_[A-Za-z0-9]{36,}\b/],
  ["inline-gemini-key", /GEMINI_API_KEY\s*[:=]\s*["']?[\w.-]{16,}/],
]);

const SKIP = /\.(?:png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|zip|gz)$/i;

const dir = process.argv[2];
const files = dir
  ? readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => join(d.parentPath, d.name))
  : execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);

const hits = files
  .filter((file) => !SKIP.test(file))
  .flatMap((file) =>
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .flatMap((line, i) => [...RULES].filter(([, re]) => re.test(line)).map(([rule]) => `${file}:${i + 1} ${rule}`)),
  );

if (hits.length) {
  console.error(`Credential-like content found:\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log(`No credential patterns in ${files.length} file(s)${dir ? ` under ${dir}` : ""}.`);
