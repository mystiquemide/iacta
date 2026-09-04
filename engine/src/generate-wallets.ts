import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
const walletNames = ["OPS", "RETIARIUS", "SECUTOR", "THRAEX", "MURMILLO"] as const;

if (existsSync(envPath) && process.argv[2] !== "--rotate") {
  console.error(`Wallet file already exists at ${envPath}. Use --rotate only when intentionally replacing it.`);
  process.exit(1);
}

const wallets = walletNames.map((name) => {
  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  return { name, privateKey, address };
});

const lines = [
  "# Local IACTA burner wallets. Never commit or share this file.",
  ...wallets.flatMap(({ name, privateKey, address }) => [
    `IACTA_${name}_ADDRESS=${address}`,
    `IACTA_${name}_PRIVATE_KEY=${privateKey}`,
  ]),
  "",
];

writeFileSync(envPath, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
chmodSync(envPath, 0o600);

console.log(JSON.stringify({
  path: envPath,
  wallets: wallets.map(({ name, address }) => ({ name, address })),
}, null, 2));
