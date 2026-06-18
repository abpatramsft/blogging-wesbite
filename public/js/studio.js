// Writing studio frontend: list/select/create posts, live Markdown preview
// (rendered by the backend), save drafts, publish/unpublish, and delete.

const els = {
    list: document.getElementById("post-list"),
    newBtn: document.getElementById("new-post"),
    title: document.getElementById("title"),
    tags: document.getElementById("tags"),
    content: document.getElementById("content"),
    preview: document.getElementById("preview"),
    panes: document.getElementById("editor-panes"),
    writePane: document.getElementById("write-pane"),
    previewPane: document.getElementById("preview-pane"),
    save: document.getElementById("save-btn"),
    publish: document.getElementById("publish-btn"),
    del: document.getElementById("delete-btn"),
    status: document.getElementById("status"),
};

let current = null; // currently loaded post (null = unsaved new post)
let posts = [];

function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[c]);
}

async function api(path, opts) {
    const res = await fetch(`/api${path}`, opts);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.status === 204 ? null : res.json();
}

function jsonOpts(method, body) {
    return {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

function setStatus(msg) {
    els.status.textContent = msg;
    if (msg) {
        clearTimeout(setStatus._t);
        setStatus._t = setTimeout(() => (els.status.textContent = ""), 4000);
    }
}

function renderSidebar() {
    if (!posts.length) {
        els.list.innerHTML = `<li class="sub" style="color:var(--muted)">No posts yet</li>`;
        return;
    }
    els.list.innerHTML = posts
        .map(
            (p) => `
        <li class="sidebar-item ${current && current.slug === p.slug ? "active" : ""}"
            data-slug="${esc(p.slug)}">
            <div class="title">${esc(p.title)}</div>
            <div class="sub">
                <span class="badge badge-${p.status}">${p.status}</span>
            </div>
        </li>`,
        )
        .join("");
    els.list.querySelectorAll(".sidebar-item").forEach((el) => {
        el.addEventListener("click", () => selectPost(el.dataset.slug));
    });
}

async function loadPosts() {
    posts = await api("/posts");
    renderSidebar();
}

function fillEditor(post) {
    current = post;
    els.title.value = post ? post.title : "";
    els.tags.value = post ? (post.tags || []).join(", ") : "";
    els.content.value = post ? post.content : "";
    updatePreview();
    updateButtons();
    renderSidebar();
}

function updateButtons() {
    const isPublished = current && current.status === "published";
    els.publish.textContent = isPublished ? "Unpublish" : "Publish";
    els.del.disabled = !current;
}

async function selectPost(slug) {
    try {
        const post = await api(`/posts/${encodeURIComponent(slug)}`);
        fillEditor(post);
    } catch {
        setStatus("Could not load post.");
    }
}

function newPost() {
    fillEditor(null);
    els.title.focus();
}

let previewTimer = null;
function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 250);
}

async function updatePreview() {
    try {
        const { html } = await api(
            "/render",
            jsonOpts("POST", { content: els.content.value }),
        );
        els.preview.innerHTML = html;
    } catch {
        /* ignore preview errors */
    }
}

function gatherInput() {
    return {
        title: els.title.value,
        tags: els.tags.value,
        content: els.content.value,
        slug: current ? current.slug : undefined,
    };
}

async function save({ silent } = {}) {
    const post = await api("/posts", jsonOpts("POST", gatherInput()));
    current = post;
    await loadPosts();
    updateButtons();
    if (!silent) setStatus("Saved.");
    return post;
}

async function togglePublish() {
    // Make sure latest edits are persisted before changing status.
    const post = await save({ silent: true });
    const verb = post.status === "published" ? "unpublish" : "publish";
    const updated = await api(`/posts/${encodeURIComponent(post.slug)}/${verb}`, {
        method: "POST",
    });
    current = updated;
    await loadPosts();
    updateButtons();
    setStatus(updated.status === "published" ? "Published!" : "Moved to draft.");
}

async function deletePost() {
    if (!current) return;
    if (!confirm(`Delete "${current.title}"? This cannot be undone.`)) return;
    await api(`/posts/${encodeURIComponent(current.slug)}`, { method: "DELETE" });
    setStatus("Deleted.");
    fillEditor(null);
    await loadPosts();
}

function setView(view) {
    els.writePane.style.display = view === "preview" ? "none" : "";
    els.previewPane.style.display = view === "write" ? "none" : "";
    els.panes.style.gridTemplateColumns = view === "split" ? "1fr 1fr" : "1fr";
}

els.newBtn.addEventListener("click", newPost);
els.save.addEventListener("click", () => save().catch(() => setStatus("Save failed.")));
els.publish.addEventListener("click", () =>
    togglePublish().catch(() => setStatus("Action failed.")),
);
els.del.addEventListener("click", () =>
    deletePost().catch(() => setStatus("Delete failed.")),
);
els.content.addEventListener("input", schedulePreview);
document.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => setView(b.dataset.view)),
);

setView("split");
loadPosts().then(() => {
    if (posts.length) selectPost(posts[0].slug);
    else newPost();
});
