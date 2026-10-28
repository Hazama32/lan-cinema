import { createServer } from "node:http";
import os from "node:os";
import next from "next";
import { attachRealtime } from "./src/server/realtime";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const httpServer = createServer();
const app = next({ dev, hostname: "localhost", port, httpServer });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // URUTAN PENTING: listener Next dipasang dulu, baru Socket.IO.
  // Socket.IO mencegat path /socket.io/, sisanya diteruskan ke Next.
  httpServer.on("request", (req, res) => {
    void handle(req, res);
  });
  attachRealtime(httpServer);

  httpServer.listen(port, () => {
    console.log(`LAN Cinema (${dev ? "dev" : "production"}) siap:`);
    console.log(`  http://localhost:${port}`);
    for (const list of Object.values(os.networkInterfaces()))
      for (const i of list ?? [])
        if (i.family === "IPv4" && !i.internal) console.log(`  http://${i.address}:${port}`);
  });
});