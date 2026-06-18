// Extension: blog-studio
// A modern blogging studio canvas to write, preview, and publish blog posts.
//
// Wiring only: a single loopback HTTP server backs the canvas iframe and
// exposes a small JSON API + SSE stream over the post store. Agent-callable
// actions let the assistant create, publish, list, and fetch posts too.

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CanvasError, createCanvas, joinSession } from "@github/copilot-sdk/extension";
import { PostStore } from "./store.mjs";
import { renderApp } from "./client.mjs";

// This file lives at <repo>/.github/extensions/blog-studio/extension.mjs, so the
// repo root is four directories up. Posts are written under <repo>/content/posts
// so they are committable and become part of the blog site.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

let store;
let httpUrl = null;
let httpServer = null;
const sseClients = new Set();

function broadcast(payload) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of sseClients) {
        try {
            res.write(data);
        } catch {
            sseClients.delete(res);
        }
    }
}

async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (!chunks.length) return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
        return {};
    }
}

function sendJson(res, status, body) {
    const payload = body == null ? "" : JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
    });
    res.end(payload);
}

async function handleRequest(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const path = url.pathname;
    const method = req.method || "GET";

    try {
        if (method === "GET" && path === "/") {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(renderApp());
            return;
        }

        if (method === "GET" && path === "/events") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });
            res.write("retry: 3000\n\n");
            sseClients.add(res);
            req.on("close", () => sseClients.delete(res));
            return;
        }

        if (method === "GET" && path === "/api/posts") {
            sendJson(res, 200, await store.list());
            return;
        }

        // /api/posts/:slug  (+ /publish, /unpublish)
        const m = /^\/api\/posts\/([^/]+)(\/publish|\/unpublish)?$/.exec(path);
        if (m) {
            const slug = decodeURIComponent(m[1]);
            const verb = m[2];
            if (verb === "/publish" && method === "POST") {
                const post = await store.publish(slug);
                if (!post) return sendJson(res, 404, { error: "not found" });
                broadcast({ type: "changed", slug: post.slug });
                return sendJson(res, 200, post);
            }
            if (verb === "/unpublish" && method === "POST") {
                const post = await store.unpublish(slug);
                if (!post) return sendJson(res, 404, { error: "not found" });
                broadcast({ type: "changed", slug: post.slug });
                return sendJson(res, 200, post);
            }
            if (!verb && method === "GET") {
                const post = await store.get(slug);
                if (!post) return sendJson(res, 404, { error: "not found" });
                return sendJson(res, 200, post);
            }
            if (!verb && method === "PUT") {
                const body = await readBody(req);
                const post = await store.save({ ...body, slug });
                broadcast({ type: "changed", slug: post.slug });
                return sendJson(res, 200, post);
            }
            if (!verb && method === "DELETE") {
                await store.remove(slug);
                broadcast({ type: "changed", slug });
                res.writeHead(204);
                res.end();
                return;
            }
        }

        if (method === "PUT" && path === "/api/posts") {
            const body = await readBody(req);
            const post = await store.save(body);
            broadcast({ type: "changed", slug: post.slug });
            return sendJson(res, 200, post);
        }

        sendJson(res, 404, { error: "not found" });
    } catch (err) {
        sendJson(res, 500, { error: String(err?.message || err) });
    }
}

async function ensureServer() {
    if (httpUrl) return httpUrl;
    httpServer = createServer(handleRequest);
    await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    const port = typeof address === "object" && address ? address.port : 0;
    httpUrl = `http://127.0.0.1:${port}/`;
    return httpUrl;
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "blog-studio",
            displayName: "Blog Studio",
            description:
                "Write, preview, and publish blog posts in a modern studio; posts persist as Markdown in the repo.",
            open: async () => {
                const url = await ensureServer();
                return { title: "Blog Studio", url, status: "ready" };
            },
            actions: [
                {
                    name: "create_post",
                    description:
                        "Create a new blog post (or update an existing one when a slug is given). Optionally publish it.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            title: { type: "string", description: "Post title" },
                            content: { type: "string", description: "Markdown body" },
                            tags: {
                                type: "array",
                                items: { type: "string" },
                                description: "Tags for the post",
                            },
                            slug: {
                                type: "string",
                                description: "Existing slug to update; omit to create new",
                            },
                            publish: {
                                type: "boolean",
                                description: "Publish immediately",
                            },
                        },
                        required: ["title"],
                    },
                    handler: async (ctx) => {
                        const input = ctx.input || {};
                        const post = await store.save({
                            title: input.title,
                            content: input.content,
                            tags: input.tags,
                            slug: input.slug,
                            status: input.publish ? "published" : undefined,
                        });
                        broadcast({ type: "changed", slug: post.slug });
                        return { slug: post.slug, status: post.status, title: post.title };
                    },
                },
                {
                    name: "publish_post",
                    description: "Publish an existing draft by slug.",
                    inputSchema: {
                        type: "object",
                        properties: { slug: { type: "string" } },
                        required: ["slug"],
                    },
                    handler: async (ctx) => {
                        const post = await store.publish(ctx.input?.slug);
                        if (!post) throw new CanvasError("not_found", "Post not found");
                        broadcast({ type: "changed", slug: post.slug });
                        return { slug: post.slug, status: post.status };
                    },
                },
                {
                    name: "list_posts",
                    description: "List all blog posts with their status.",
                    handler: async () => {
                        const posts = await store.list();
                        return posts.map((p) => ({
                            slug: p.slug,
                            title: p.title,
                            status: p.status,
                            tags: p.tags,
                            updatedAt: p.updatedAt,
                        }));
                    },
                },
                {
                    name: "get_post",
                    description: "Get the full content of a post by slug.",
                    inputSchema: {
                        type: "object",
                        properties: { slug: { type: "string" } },
                        required: ["slug"],
                    },
                    handler: async (ctx) => {
                        const post = await store.get(ctx.input?.slug);
                        if (!post) throw new CanvasError("not_found", "Post not found");
                        return post;
                    },
                },
                {
                    name: "delete_post",
                    description: "Delete a post by slug.",
                    inputSchema: {
                        type: "object",
                        properties: { slug: { type: "string" } },
                        required: ["slug"],
                    },
                    handler: async (ctx) => {
                        const ok = await store.remove(ctx.input?.slug);
                        broadcast({ type: "changed", slug: ctx.input?.slug });
                        return { deleted: ok };
                    },
                },
            ],
        }),
    ],
});

store = new PostStore(repoRoot);
session.log("Blog Studio canvas ready", { level: "info", ephemeral: true });
