// Serves `.next/standalone` locally exactly as the container does (`node server.js`).
// `next build` leaves `.next/static` and `public/` outside the standalone folder, so they are copied in first.
import { fork } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const out = join(".next", "standalone");
const entry = join(out, "server.js");

if (!existsSync(entry)) {
  console.error("Missing .next/standalone/server.js. Build first: npm run build");
  process.exit(1);
}

cpSync(join(".next", "static"), join(out, ".next", "static"), { recursive: true });
if (existsSync("public")) cpSync("public", join(out, "public"), { recursive: true });

const child = fork(entry, { stdio: "inherit" });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", (code) => process.exit(code ?? 0));
