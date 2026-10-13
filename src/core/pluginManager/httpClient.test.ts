/**
 * @jest-environment node
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import { createServer, Server } from "node:http";
import type { AddressInfo } from "node:net";
import axios from "./httpClient";

describe("plugin HTTP requests", () => {
    let server: Server;
    let baseUrl: string;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    beforeAll(async () => {
        server = createServer((request, response) => {
            if (request.url === "/unavailable") {
                response.writeHead(503);
                response.end("unavailable");
                return;
            }
            const timer = setTimeout(() => {
                timers.delete(timer);
                response.setHeader("Content-Type", "application/json");
                response.end(JSON.stringify({
                    isEnd: true,
                    data: [{ id: "song-1", title: "Search result" }],
                }));
            }, 3000);
            timers.add(timer);
        });
        await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterEach(() => {
        timers.forEach(timer => clearTimeout(timer));
        timers.clear();
    });

    afterAll(async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        }));
    });

    it("returns search results when the first response takes over two seconds", async () => {
        const response = await axios.get(`${baseUrl}/search`, { proxy: false });

        expect(response.data.data).toEqual([{ id: "song-1", title: "Search result" }]);
    }, 15_000);

    it("honors a plugin's explicit shorter timeout", async () => {
        await expect(axios.get(`${baseUrl}/search`, {
            proxy: false,
            timeout: 50,
        })).rejects.toMatchObject({ code: "ECONNABORTED" });
    });

    it("rejects HTTP failures so the search page can show its retry state", async () => {
        await expect(axios.get(`${baseUrl}/unavailable`, { proxy: false }))
            .rejects.toMatchObject({ response: { status: 503 } });
    });
});
