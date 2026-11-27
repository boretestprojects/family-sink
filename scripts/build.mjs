import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const root = new URL("../", import.meta.url);
const read = async (path) => (await readFile(new URL(path, root), "utf8")).replaceAll("\r\n", "\n");
const integration = "custom_components/family_sink/";
const stylesheet = await read("frontend/dashboard.css") + "\n" + await read("frontend/layout.css");
const tailwind = await postcss(tailwindcss({
  content: ["./frontend/**/*.{js,jsx}"],
})).process(stylesheet, { from: "frontend/dashboard.css" });
const fontDirectory = "node_modules/@fontsource-variable/manrope/";
const subsets = new Set(["latin", "latin-ext", "cyrillic", "cyrillic-ext"]);
const fontBlocks = (await read(fontDirectory + "index.css")).split(/(?=\/\* manrope-)/).filter((block) =>
  subsets.has(block.match(/\/\* manrope-(.*)-wght-normal/)?.[1]),
);
const manrope = [];
for (const block of fontBlocks) {
  const file = block.match(/url\(\.\/files\/([^)]*)\)/)[1];
  const encoded = await readFile(new URL(fontDirectory + "files/" + file, root), "base64");
  manrope.push({
    source: `url(data:font/woff2;base64,${encoded}) format('woff2')`,
    unicodeRange: block.match(/unicode-range:\s*([^;]+);/)[1],
  });
}
const js = (await build({
  entryPoints: ["frontend/panel.jsx"],
  bundle: true,
  write: false,
  format: "esm",
  minify: true,
  legalComments: "inline",
  target: ["es2022"],
  define: {
    "process.env.NODE_ENV": '"production"',
    __FAMILY_SINK_MANROPE__: JSON.stringify(manrope),
  },
})).outputFiles[0].text;
const css = tailwind.css;
const version = createHash("sha256").update(js).update(css).digest("hex").slice(0, 16);
const notices = [];
for (const [name, path] of [
  ["React", "react/LICENSE"],
  ["React DOM", "react-dom/LICENSE"],
  ["Scheduler", "scheduler/LICENSE"],
  ["Tailwind CSS", "tailwindcss/LICENSE"],
  ["Manrope", "@fontsource-variable/manrope/LICENSE"],
]) {
  notices.push(name + "\n" + (await read("node_modules/" + path)).trim());
}
const files = {
  "frontend/panel.js": js,
  "frontend/panel.css": css,
  "_version.py": `"""Build hash for browser cache invalidation."""\n\nASSET_VERSION = "${version}"\n`,
  "THIRD_PARTY_NOTICES.txt": notices.join("\n\n") + "\n",
  LICENSE: await read("LICENSE"),
};
if (process.argv.includes("--check")) {
  for (const [path, data] of Object.entries(files)) {
    if (await read(integration + path) !== data) {
      throw new Error(`Release assets are stale. Run npm run build (${path}).`);
    }
  }
} else {
  await mkdir(new URL(integration + "frontend/", root), { recursive: true });
  for (const [path, data] of Object.entries(files)) await writeFile(new URL(integration + path, root), data);
}
