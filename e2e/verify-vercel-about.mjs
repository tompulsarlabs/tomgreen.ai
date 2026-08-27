import { spawn } from "node:child_process";

const port = "3199";
const origin = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "start", "--", "-p", port, "-H", "127.0.0.1"], {
  env: { ...process.env, VERCEL: "1" },
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
} finally {
  server.kill("SIGTERM");
}
