// Post persistence for the blog-studio canvas.
//
// Posts are stored as Markdown files with a small YAML-ish frontmatter block
// under `<workspace>/content/posts/<slug>.md`. Treating the file path as the
// durable id keeps posts inspectable on disk and committable to the repo.

import { mkdir, readdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import { join } from "node:path";

const SCALAR_KEYS = new Set([
    "title",
    "status",
    "excerpt",
    "createdAt",
    "updatedAt",
    "publishedAt",
]);

export function slugify(input) {
    const base = String(input || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return base || `post-${Date.now()}`;
}

function escapeYaml(value) {
    const str = String(value ?? "");
    if (str === "") return '""';
    if (/[:#\-?\[\]{}&*!|>'"%@`\n]/.test(str) || /^\s|\s$/.test(str)) {
        return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return str;
}

function unquote(value) {
    const v = value.trim();
    if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
    ) {
        return v
            .slice(1, -1)
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
    }
    return v;
}

export function serializePost(post) {
    const lines = ["---"];
    for (const key of SCALAR_KEYS) {
        lines.push(`${key}: ${escapeYaml(post[key] ?? "")}`);
    }
    const tags = Array.isArray(post.tags) ? post.tags.filter(Boolean) : [];
    lines.push(`tags: [${tags.map((t) => escapeYaml(t)).join(", ")}]`);
    lines.push("---");
    lines.push("");
    lines.push(post.content ?? "");
    return lines.join("\n");
}

export function parsePost(slug, raw) {
    const post = {
        slug,
        title: "",
        status: "draft",
        excerpt: "",
        tags: [],
        content: "",
        createdAt: "",
        updatedAt: "",
        publishedAt: "",
    };
    const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw);
    if (!match) {
        post.content = raw;
        post.title = slug;
        return post;
    }
    const [, front, body] = match;
    for (const line of front.split("\n")) {
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key === "tags") {
            const inner = value.replace(/^\[|\]$/g, "").trim();
            post.tags = inner
                ? inner.split(",").map((t) => unquote(t)).filter(Boolean)
                : [];
        } else if (SCALAR_KEYS.has(key)) {
            post[key] = unquote(value);
        }
    }
    post.content = body.replace(/^\n/, "");
    if (!post.title) post.title = slug;
    return post;
}

export class PostStore {
    constructor(workspacePath) {
        const root = workspacePath || process.cwd();
        this.dir = join(root, "content", "posts");
    }

    async ensureDir() {
        await mkdir(this.dir, { recursive: true });
    }

    filePath(slug) {
        return join(this.dir, `${slug}.md`);
    }

    async list() {
        await this.ensureDir();
        let entries = [];
        try {
            entries = await readdir(this.dir);
        } catch {
            return [];
        }
        const posts = [];
        for (const name of entries) {
            if (!name.endsWith(".md")) continue;
            const slug = name.slice(0, -3);
            try {
                const post = await this.get(slug);
                if (post) posts.push(post);
            } catch {
                /* skip unreadable */
            }
        }
        posts.sort((a, b) =>
            String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
        );
        return posts;
    }

    async get(slug) {
        try {
            const raw = await readFile(this.filePath(slug), "utf8");
            return parsePost(slug, raw);
        } catch {
            return null;
        }
    }

    async exists(slug) {
        try {
            await stat(this.filePath(slug));
            return true;
        } catch {
            return false;
        }
    }

    deriveExcerpt(content) {
        const text = String(content || "")
            .replace(/```[\s\S]*?```/g, " ")
            .replace(/[#>*_`~\-!\[\]()]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return text.slice(0, 160);
    }

    async save(input) {
        await this.ensureDir();
        const now = new Date().toISOString();
        let slug = input.slug ? slugify(input.slug) : "";
        const title = (input.title || "").trim() || "Untitled post";
        if (!slug) {
            slug = slugify(title);
            // Avoid clobbering an existing post when creating a fresh one.
            let candidate = slug;
            let n = 2;
            while (await this.exists(candidate)) {
                candidate = `${slug}-${n++}`;
            }
            slug = candidate;
        }
        const existing = await this.get(slug);
        const tags = Array.isArray(input.tags)
            ? input.tags
            : typeof input.tags === "string"
              ? input.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : existing?.tags || [];
        const content =
            input.content != null ? input.content : existing?.content || "";
        const status = input.status || existing?.status || "draft";
        const post = {
            slug,
            title,
            status,
            tags,
            content,
            excerpt:
                (input.excerpt || "").trim() ||
                this.deriveExcerpt(content) ||
                existing?.excerpt ||
                "",
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            publishedAt:
                status === "published"
                    ? existing?.publishedAt || input.publishedAt || now
                    : existing?.publishedAt || "",
        };
        await writeFile(this.filePath(slug), serializePost(post), "utf8");
        return post;
    }

    async publish(slug) {
        const post = await this.get(slug);
        if (!post) return null;
        return this.save({ ...post, status: "published" });
    }

    async unpublish(slug) {
        const post = await this.get(slug);
        if (!post) return null;
        return this.save({ ...post, status: "draft" });
    }

    async remove(slug) {
        try {
            await unlink(this.filePath(slug));
            return true;
        } catch {
            return false;
        }
    }
}
