// Public blog frontend: a tiny hash-router that lists published posts and
// renders an individual article. Markdown is rendered to HTML by the backend.

const app = document.getElementById("app");

function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[c]);
}

function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

async function api(path, opts) {
    const res = await fetch(`/api${path}`, opts);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.status === 204 ? null : res.json();
}

function tagsHtml(tags) {
    if (!tags || !tags.length) return "";
    return tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ");
}

async function renderList() {
    app.innerHTML = `<div class="empty">Loading posts…</div>`;
    let posts;
    try {
        posts = await api("/posts?status=published");
    } catch {
        app.innerHTML = `<div class="empty">Could not load posts.</div>`;
        return;
    }
    if (!posts.length) {
        app.innerHTML = `<div class="empty">
            No published posts yet.<br />
            Head to the <a href="/studio.html">Studio</a> to write one.
        </div>`;
        return;
    }
    const items = posts
        .map(
            (p) => `
        <li class="post-card">
            <h2><a href="#/post/${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h2>
            <div class="meta">
                <span>${fmtDate(p.publishedAt || p.updatedAt)}</span>
                ${tagsHtml(p.tags)}
            </div>
            ${p.excerpt ? `<p class="excerpt">${esc(p.excerpt)}</p>` : ""}
        </li>`,
        )
        .join("");
    app.innerHTML = `<ul class="post-list">${items}</ul>`;
}

async function renderPost(slug) {
    app.innerHTML = `<div class="empty">Loading…</div>`;
    let post;
    try {
        post = await api(`/posts/${encodeURIComponent(slug)}`);
    } catch {
        app.innerHTML = `<div class="empty">Post not found. <a href="#/">Back home</a></div>`;
        return;
    }
    app.innerHTML = `
        <article class="article">
            <a href="#/">&larr; All posts</a>
            <h1>${esc(post.title)}</h1>
            <div class="meta">
                <span>${fmtDate(post.publishedAt || post.updatedAt)}</span>
                ${tagsHtml(post.tags)}
            </div>
            <div class="article-body">${post.html || ""}</div>
        </article>`;
}

function router() {
    const hash = location.hash || "#/";
    const m = /^#\/post\/(.+)$/.exec(hash);
    if (m) {
        renderPost(decodeURIComponent(m[1]));
    } else {
        renderList();
    }
    window.scrollTo(0, 0);
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
router();
