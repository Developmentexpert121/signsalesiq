import { build as esbuild, stop as esbuildStop } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, cp, mkdir } from "fs/promises";
import { existsSync } from "fs";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@aws-sdk/client-s3",
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "sharp",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("copying uploads directory...");
  if (existsSync("uploads")) {
    await mkdir("dist/uploads", { recursive: true });
    await cp("uploads", "dist/uploads", { recursive: true });
  }

  if (existsSync("outputs")) {
    await mkdir("dist/outputs", { recursive: true });
    await cp("outputs", "dist/outputs", { recursive: true });
  }

  console.log("copying migrations directory...");
  if (existsSync("migrations")) {
    await mkdir("dist/migrations", { recursive: true });
    await cp("migrations", "dist/migrations", { recursive: true });
  } else {
    console.warn("No migrations directory found - schema auto-creation will be skipped");
  }

  console.log("copying seed-export.json...");
  if (existsSync("seed-export.json")) {
    await cp("seed-export.json", "dist/seed-export.json");
    console.log("  ✓ seed-export.json copied to dist/");
  } else {
    console.warn("  ⚠ seed-export.json not found — auto-seed on fresh DB will be skipped");
  }
}

buildAll()
  .then(async () => {
    try {
      await esbuildStop();
    } catch {}
    console.log("build complete — exiting cleanly");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
