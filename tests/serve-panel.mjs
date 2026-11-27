import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const files = {
  "/": ["text/html", "tests/panel-fixture.html"],
  "/panel.js": ["text/javascript", "custom_components/family_sink/frontend/panel.js"],
  "/panel.css": ["text/css", "custom_components/family_sink/frontend/panel.css"],
  "/demo": ["application/json", "examples/demo-profiles.json"],
  "/rules": ["application/json", "examples/default-rules.json"],
  "/release-demo.mjs": ["text/javascript", "tests/release-demo.mjs"],
};
createServer(async (request, response) => {
  const item = files[new URL(request.url, "http://127.0.0.1").pathname];
  if (!Array.isArray(item)) {
    response.writeHead(404).end();
    return;
  }
  const [type, path] = item;
  response.writeHead(200, { "Content-Type": type });
  response.end(await readFile(new URL("../" + path, import.meta.url)));
}).listen(Number(process.env.FAMILY_SINK_TEST_PORT ?? 4173), "127.0.0.1");
