// Public blog frontend: a tiny hash-router that lists published posts and
// renders an individual article. Markdown is rendered to HTML by the backend.
// Visual language inspired by SE Brain — light, editorial, mono accents.

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

function readingTime(text) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
}

async function api(path, opts) {
    const res = await fetch(`/api${path}`, opts);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.status === 204 ? null : res.json();
}

function tagsHtml(tags) {
    if (!tags || !tags.length) return "";
    return `<span class="tags">${tags
        .map((t) => `<span class="tag">${esc(t)}</span>`)
        .join("")}</span>`;
}

// Apply scroll-in reveal to freshly rendered elements.
function observeReveals() {
    const els = document.querySelectorAll(".reveal:not(.in)");
    if (!("IntersectionObserver" in window)) {
        els.forEach((el) => el.classList.add("in"));
        return;
    }
    const io = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add("in");
                    obs.unobserve(e.target);
                }
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
}

function matchesQuery(post, query) {
    if (!query) return true;
    const haystack = [
        post.title,
        post.excerpt,
        ...(Array.isArray(post.tags) ? post.tags : []),
    ]
        .join(" ")
        .toLowerCase();
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => haystack.includes(term));
}

function cardHtml(p, i) {
    const date = fmtDate(p.publishedAt || p.updatedAt);
    return `
        <article class="post-card reveal">
            <span class="num">${String(i + 1).padStart(2, "0")}</span>
            <h2><a href="#/post/${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h2>
            ${p.excerpt ? `<p class="excerpt">${esc(p.excerpt)}</p>` : `<p class="excerpt"></p>`}
            <div class="meta">
                ${date ? `<span>${date}</span>` : ""}
                ${date && p.tags && p.tags.length ? `<span class="dot-sep"></span>` : ""}
                ${tagsHtml(p.tags)}
            </div>
        </article>`;
}

async function renderList() {
    app.innerHTML = `<div class="container"><div class="empty">Loading posts…</div></div>`;
    let posts;
    try {
        posts = await api("/posts?status=published");
    } catch {
        app.innerHTML = `<div class="container"><div class="empty">Could not load posts.</div></div>`;
        return;
    }

    const hero = `
        <section class="hero">
            <div class="container hero-inner">
                <span class="eyebrow"><span class="pulse" aria-hidden="true"></span> Markdown-native blog</span>
                <h1 class="hero-title">Writing that<br />compounds<span class="period">.</span></h1>
                <p class="hero-sub">
                    A locally-deployable blog where every post is just <strong>Markdown</strong> on disk —
                    drafted in the Studio, rendered clean, and published when it's ready.
                </p>
                <div class="hero-actions">
                    <a class="btn btn-solid btn-lg" href="#posts">Read the latest <span aria-hidden="true">→</span></a>
                    <a class="btn btn-ghost btn-lg" href="/studio.html">Open the Studio</a>
                </div>
            </div>
        </section>`;

    if (!posts.length) {
        app.innerHTML =
            hero +
            `<section class="section" id="posts"><div class="container">
                <div class="empty">
                    No published posts yet.<br />
                    Head to the <a href="/studio.html">Studio</a> to write one.
                </div>
            </div></section>`;
        observeReveals();
        return;
    }

    app.innerHTML =
        hero +
        `<section class="section" id="posts"><div class="container">
            <div class="section-head reveal">
                <span class="kicker">The archive</span>
                <h2 class="section-title">Latest posts</h2>
            </div>
            <div class="search-bar reveal">
                <input
                    id="search-input"
                    type="search"
                    class="search-input"
                    placeholder="Search posts by title, tag, or summary…"
                    autocomplete="off"
                    aria-label="Search posts"
                />
            </div>
            <div class="post-grid" id="post-grid"></div>
        </div></section>`;

    const input = document.getElementById("search-input");
    const grid = document.getElementById("post-grid");

    function update() {
        const query = input.value.trim();
        const matches = posts.filter((p) => matchesQuery(p, query));
        if (!matches.length) {
            grid.innerHTML = `<div class="empty">No posts match “${esc(query)}”.</div>`;
            return;
        }
        grid.innerHTML = matches.map((p, i) => cardHtml(p, i)).join("");
        observeReveals();
    }

    input.addEventListener("input", update);
    update();
    observeReveals();
}

async function renderPost(slug) {
    app.innerHTML = `<div class="container"><div class="empty">Loading…</div></div>`;
    let post;
    try {
        post = await api(`/posts/${encodeURIComponent(slug)}`);
    } catch {
        app.innerHTML = `<div class="container"><div class="empty">Post not found. <a href="#/">Back home</a></div></div>`;
        return;
    }
    const date = fmtDate(post.publishedAt || post.updatedAt);
    const mins = readingTime(post.content);
    app.innerHTML = `
        <section class="section">
            <div class="container">
                <article class="article">
                    <a class="back-link" href="#/">← All posts</a>
                    <div class="article-header">
                        <h1>${esc(post.title)}</h1>
                        <div class="meta">
                            ${date ? `<span>${date}</span>` : ""}
                            ${date ? `<span class="dot-sep"></span>` : ""}
                            <span>${mins} min read</span>
                            ${post.tags && post.tags.length ? `<span class="dot-sep"></span>` : ""}
                            ${tagsHtml(post.tags)}
                        </div>
                    </div>
                    <div class="article-body">${post.html || ""}</div>
                    <div class="article-footer">
                        <a class="back-link" href="#/">← Back to all posts</a>
                    </div>
                </article>
            </div>
        </section>`;
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

// Header glass-on-scroll.
function initHeader() {
    const header = document.getElementById("siteHeader");
    if (!header) return;
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
}

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

initHeader();
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
router();
