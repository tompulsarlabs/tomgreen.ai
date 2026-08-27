import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

// The /about gate is evaluated at BUILD time (the route is statically
// prerendered), so the contract must build with VERCEL=1 before asserting.
// Building into an isolated dist dir keeps the working .next intact.
const distDir = ".next-vercel-contract";
const port = "3199";
const origin = `http://127.0.0.1:${port}`;
const env = { ...process.env, VERCEL: "1", NEXT_DIST_DIR: distDir };

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`)),
    );
    child.on("error", reject);
  });
}

await rm(distDir, { recursive: true, force: true });
await run("npx", ["next", "build"]);

const server = spawn("npx", ["next", "start", "-p", port, "-H", "127.0.0.1"], {
  env,
  stdio: "ignore",
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!ready) throw new Error("Vercel contract server did not start");

  const about = await fetch(`${origin}/about`);
  if (about.status !== 404) throw new Error(`/about returned ${about.status}, expected 404`);

  const home = await (await fetch(origin)).text();
  if (home.includes('href="/about"')) throw new Error("Home shell exposes an About link");

  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  if (sitemap.includes("/about")) throw new Error("Sitemap exposes About");

  console.log("Vercel /about contract holds: 404, no nav link, no sitemap entry.");
} finally {
  server.kill("SIGTERM");
  await rm(distDir, { recursive: true, force: true });
}
