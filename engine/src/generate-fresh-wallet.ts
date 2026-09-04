import { appendFileSync, chmodSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

if (/^IACTA_FRESH_PRIVATE_KEY=/m.test(env)) {
  console.error(`A FRESH wallet already exists in ${envPath}.`);
  process.exit(1);
}

const privateKey = generatePrivateKey();
const address = privateKeyToAccount(privateKey).address;

appendFileSync(envPath, [
  "",
  "# Additional isolated IACTA burner. Never commit or share this file.",
  `IACTA_FRESH_ADDRESS=${address}`,
  `IACTA_FRESH_PRIVATE_KEY=${privateKey}`,
  "",
].join("\n"), { encoding: "utf8", mode: 0o600 });
chmodSync(envPath, 0o600);

console.log(JSON.stringify({ path: envPath, name: "FRESH", address }, null, 2));
