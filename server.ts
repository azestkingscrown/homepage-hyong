import http from "node:http";
import { handleHttpRequest } from "./bridge/http.ts";

const PORT = Number.parseInt(process.env.PORT || "3030", 10) || 3030;
const HOST = process.env.HOST || "0.0.0.0";

const server = http.createServer((req, res) => {
  void handleHttpRequest(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`💗 homepage-hyong listening on http://${HOST}:${PORT} (powered by hyeong-lang v0.4.5 .hyeong)`);
});
