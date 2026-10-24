const base = process.env.BASE_URL || "http://localhost:3000";
const hits = Number(process.env.HITS || 3);
// "any" | "zero" | "positive"
const expect = process.env.EXPECT || "any";

async function get(path) {
  const res = await fetch(base + path);
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${res.statusText}`);
  }
  return res.json();
}

for (let i = 0; i < hits; i++) {
  await get("/api/ping");
}

const probe = await get("/api/probe");

const srvx = probe.counts["srvx.request"] ?? 0;
const srvxMiddleware = probe.counts["srvx.middleware"] ?? 0;
const h3 = probe.counts["h3.request"] ?? 0;

console.log(JSON.stringify(probe, null, 2));
console.log("");
console.log(`srvx.request    = ${srvx}`);
console.log(`srvx.middleware = ${srvxMiddleware}`);
console.log(`h3.request      = ${h3}`);

const ok =
  expect === "zero" ? srvx === 0 : expect === "positive" ? srvx > 0 : true;

console.log("");
console.log(`${ok ? "PASS" : "FAIL"} (expected ${expect})`);
process.exitCode = ok ? 0 : 1;
