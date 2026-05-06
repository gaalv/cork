/* global console, process */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const env = { ...process.env, NOXE_PARITY_EXPORT: "1", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" };
const cargo = existsSync(join(process.env.HOME ?? "", ".cargo", "bin", "cargo"))
  ? join(process.env.HOME ?? "", ".cargo", "bin", "cargo")
  : "cargo";
execFileSync("pnpm", ["exec", "vitest", "run", "tests/parity/parser-parity.spec.ts"], {
  stdio: "inherit",
  env,
});
execFileSync(cargo, ["test", "--test", "parity"], {
  cwd: "src-tauri",
  stdio: "inherit",
  env,
});

const tsOutput = readFileSync("target/parser-parity-ts.json", "utf8");
const rustOutput = readFileSync("target/parser-parity-rust.json", "utf8");
if (tsOutput !== rustOutput) {
  console.error("Parser parity mismatch between TypeScript and Rust outputs.");
  process.exit(1);
}
console.log("Parser parity OK");
