// One-time setup for email and password sign-in.
// Generates the key pair Convex Auth signs sessions with and saves it on your Convex deployment.
//
//   npm run setup:auth            (development deployment, from .env.local)
//   npm run setup:auth -- --prod  (production deployment)
//   add --force to replace existing keys (this signs everyone out)

import { execFileSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const force = args.includes("--force");
const target = prod ? ["--prod"] : [];

function convex(cmdArgs, input) {
  return execFileSync("npx", ["convex", ...cmdArgs, ...target], {
    input,
    encoding: "utf8",
    stdio: [input === undefined ? "inherit" : "pipe", "pipe", "inherit"],
  });
}

function isSet(name) {
  try {
    return convex(["env", "get", name]).trim() !== "";
  } catch {
    return false;
  }
}

if (isSet("JWKS") && !force) {
  console.log("Sign-in keys are already set on this deployment. Nothing to do.");
  console.log("To replace them (this signs everyone out), run: npm run setup:auth -- --force");
  process.exit(0);
}

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });

// Values go in through stdin so the shell never sees or mangles them.
convex(["env", "set", "JWT_PRIVATE_KEY"], privateKey);
convex(["env", "set", "JWKS"], jwks);
if (!prod && !isSet("SITE_URL")) convex(["env", "set", "SITE_URL"], "http://localhost:3000");

console.log(`Sign-in keys saved on your ${prod ? "production" : "development"} Convex deployment.`);
