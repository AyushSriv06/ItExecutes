import dotenv from "dotenv"
dotenv.config()
import express from "express";
import { createServer } from "http";
import { initWs } from "./ws";
import cors from "cors";
import http from "http";
import https from "https";
import { URL } from "url";
import { spawn } from "child_process";
import path from "path";

const app = express();
app.use(cors());
const httpServer = createServer(app);

initWs(httpServer);

// Start the simple server in the background
const simpleServerPath = path.join(__dirname, 'simple-server.js');
const simpleServer = spawn('node', [simpleServerPath], {
    stdio: 'pipe',
    detached: false
});

simpleServer.stdout.on('data', (data) => {
    console.log(`Simple server: ${data}`);
});

simpleServer.stderr.on('data', (data) => {
    console.error(`Simple server error: ${data}`);
});

simpleServer.on('close', (code) => {
    console.log(`Simple server exited with code ${code}`);
});

// Very lightweight proxy to common dev server ports inside the pod so the Output iframe works
// Tries our simple server (8080) first, then Vite (5173), React/Node (3000)
const candidatePorts = (process.env.OUTPUT_PORTS || "8080,5173,3000")
  .split(",")
  .map((p) => parseInt(p.trim(), 10))
  .filter((p) => !Number.isNaN(p));

async function tryProxy(req: express.Request, res: express.Response) {
  const pathWithQuery = req.url || "/";
  for (const port of candidatePorts) {
    try {
      const target = new URL(`http://127.0.0.1:${port}${pathWithQuery}`);
      const client = target.protocol === "https:" ? https : http;
      await new Promise<void>((resolve, reject) => {
        const proxyReq = client.request(
          target,
          {
            method: req.method,
            headers: req.headers as http.OutgoingHttpHeaders,
          },
          (proxyRes) => {
            if (!proxyRes.statusCode) {
              reject(new Error("No status from upstream"));
              return;
            }
            // Consider anything >= 200 and < 500 as a usable upstream response
            if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 500) {
              res.status(proxyRes.statusCode);
              Object.entries(proxyRes.headers).forEach(([k, v]) => {
                if (typeof v !== "undefined") res.setHeader(k, v as string);
              });
              proxyRes.pipe(res);
              proxyRes.on("end", () => resolve());
            } else {
              // Consume and try next
              proxyRes.resume();
              proxyRes.on("end", () => reject(new Error(`Bad upstream status ${proxyRes.statusCode}`)));
            }
          }
        );
        proxyReq.on("error", reject);
        if (req.readable) {
          req.pipe(proxyReq);
        } else {
          proxyReq.end();
        }
      });
      return; // success
    } catch (err) {
      // Try next port
    }
  }
  res.status(503).send("No app is listening on 5173/3000/8080 inside the workspace.");
}

// Only proxy normal browser navigations/assets; leave WS server on same port
app.get("/*", async (req, res) => {
  await tryProxy(req, res);
});

const port = process.env.PORT || 3005;
httpServer.listen(port, () => {
  console.log(`listening on *:${port}`);
});

// Cleanup on exit
process.on('SIGTERM', () => {
    simpleServer.kill();
    process.exit(0);
});

process.on('SIGINT', () => {
    simpleServer.kill();
    process.exit(0);
});