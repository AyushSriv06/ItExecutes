import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { saveToS3, fetchS3Folder } from "./aws";
import path from "path";
import fs from "fs";
import { fetchDir, fetchFileContent, saveFile } from "./fs";
import { TerminalManager } from "./pty";

const terminalManager = new TerminalManager();

export function initWs(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: {
            // Should restrict this more!
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    
    // Determine workspace directory (container vs local dev)
    const WORKSPACE_DIR = fs.existsSync('/workspace')
        ? '/workspace'
        : path.resolve(process.cwd(), 'workspace');

    if (!fs.existsSync(WORKSPACE_DIR)) {
        fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    }

    io.on("connection", async (socket) => {
        // Auth checks should happen here
        const host = socket.handshake.headers.host;
        console.log(`host is ${host}`);
        // Prefer explicit replId from query when running on localhost
        const replIdFromQuery = typeof socket.handshake.query?.replId === 'string' ? socket.handshake.query?.replId as string : undefined;
        // Split the host by '.' and take the first part as replId
        const replIdFromHost = host?.split('.')[0];
        const replId = replIdFromQuery || replIdFromHost;
    
        if (!replId) {
            socket.disconnect();
            terminalManager.clear(socket.id);
            return;
        }

        socket.on("init", async () => {
        // If workspace is empty locally, hydrate it from S3 (code/<replId>/)
        try {
            const existing = fs.readdirSync(WORKSPACE_DIR);
            if (!existing || existing.length === 0) {
                await fetchS3Folder(`code/${replId}/`, WORKSPACE_DIR);
            }
        } catch (err) {
            console.error("workspace hydrate check failed", err);
        }

        socket.emit("loaded", {
            rootContent: await fetchDir(WORKSPACE_DIR, "")
        });
        });

        initHandlers(socket, replId, WORKSPACE_DIR);
    });
}

function initHandlers(socket: Socket, replId: string, WORKSPACE_DIR: string) {

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });

    socket.on("fetchDir", async (dir: string, callback) => {
        const dirPath = path.join(WORKSPACE_DIR, dir);
        const contents = await fetchDir(dirPath, dir);
        callback(contents);
    });

    socket.on("fetchContent", async ({ path: filePath }: { path: string }, callback) => {
        const fullPath = path.join(WORKSPACE_DIR, filePath);
        const data = await fetchFileContent(fullPath);
        callback(data);
    });

    // TODO: contents should be diff, not full file
    // Should be validated for size
    // Should be throttled before updating S3 (or use an S3 mount)
    socket.on("updateContent", async ({ path: filePath, content }: { path: string, content: string }) => {
        const fullPath =  path.join(WORKSPACE_DIR, filePath);
        await saveFile(fullPath, content);
        await saveToS3(`code/${replId}`, filePath, content);
    });

    socket.on("requestTerminal", async () => {
        terminalManager.createPty(socket.id, replId, (data, id) => {
            socket.emit('terminal', {
                data: Buffer.from(data,"utf-8")
            });
        }, WORKSPACE_DIR);
    });
    
    socket.on("terminalData", async ({ data }: { data: string, terminalId: number }) => {
        terminalManager.write(socket.id, data);
    });

}