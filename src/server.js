// Express backend for the blogging website.
//
// Serves a small REST API over the Markdown post store plus a static frontend
// (a public blog and a writing studio). Markdown is rendered to HTML on the
// server with `marked` so the frontend stays dependency-free.

import express from "express";
import { marked } from "marked";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { PostStore } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const store = new PostStore(repoRoot);

marked.setOptions({ gfm: true, breaks: false });

const app = express();
app.use(express.json({ limit: "2mb" }));

function withHtml(post) {
    if (!post) return post;
    return { ...post, html: marked.parse(post.content || "") };
}

const api = express.Router();

// List posts. Pass ?status=published to only return published posts.
api.get("/posts", async (req, res, next) => {
    try {
        let posts = await store.list();
        if (req.query.status) {
            posts = posts.filter((p) => p.status === req.query.status);
        }
        res.json(posts);
    } catch (err) {
        next(err);
    }
});

// Create a new post (or update when a slug is supplied).
api.post("/posts", async (req, res, next) => {
    try {
        const post = await store.save(req.body || {});
        res.status(201).json(post);
    } catch (err) {
        next(err);
    }
});

api.get("/posts/:slug", async (req, res, next) => {
    try {
        const post = await store.get(req.params.slug);
        if (!post) return res.status(404).json({ error: "not found" });
        res.json(withHtml(post));
    } catch (err) {
        next(err);
    }
});

api.put("/posts/:slug", async (req, res, next) => {
    try {
        const post = await store.save({ ...req.body, slug: req.params.slug });
        res.json(post);
    } catch (err) {
        next(err);
    }
});

api.delete("/posts/:slug", async (req, res, next) => {
    try {
        const ok = await store.remove(req.params.slug);
        if (!ok) return res.status(404).json({ error: "not found" });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
});

api.post("/posts/:slug/publish", async (req, res, next) => {
    try {
        const post = await store.publish(req.params.slug);
        if (!post) return res.status(404).json({ error: "not found" });
        res.json(post);
    } catch (err) {
        next(err);
    }
});

api.post("/posts/:slug/unpublish", async (req, res, next) => {
    try {
        const post = await store.unpublish(req.params.slug);
        if (!post) return res.status(404).json({ error: "not found" });
        res.json(post);
    } catch (err) {
        next(err);
    }
});

// Render arbitrary Markdown to HTML (used by the studio live preview).
api.post("/render", (req, res) => {
    res.json({ html: marked.parse(String(req.body?.content || "")) });
});

app.use("/api", api);

app.use(express.static(join(repoRoot, "public")));

// JSON 404 for unknown API routes; everything else falls through to static.
app.use("/api", (_req, res) => res.status(404).json({ error: "not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    res.status(500).json({ error: String(err?.message || err) });
});

app.listen(PORT, HOST, () => {
    console.log(`Blogging website running at http://${HOST}:${PORT}`);
    console.log(`  Public blog:    http://${HOST}:${PORT}/`);
    console.log(`  Writing studio: http://${HOST}:${PORT}/studio.html`);
});
