// Returns the full single-page HTML for the blog-studio canvas. The page is
// self-contained (inline CSS + JS, no external requests) so it renders inside
// the sandboxed canvas iframe. It talks to the extension over plain HTTP/JSON
// and listens to Server-Sent Events for live cross-panel sync.

export function renderApp() {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Blog Studio</title>
<style>
:root {
  --bg: var(--background-color-default, #0d1117);
  --panel: var(--background-color-muted, rgba(255,255,255,0.03));
  --border: var(--border-color-default, #30363d);
  --text: var(--text-color-default, #e6edf3);
  --muted: var(--text-color-muted, #8b949e);
  --accent: var(--true-color-blue, #4493f8);
  --accent-muted: var(--true-color-blue-muted, rgba(68,147,248,0.15));
  --green: var(--true-color-green, #3fb950);
  --green-muted: var(--true-color-green-muted, rgba(63,185,80,0.15));
  --red: var(--true-color-red, #f85149);
  --radius: 10px;
  --font: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  --mono: var(--font-mono, "SFMono-Regular", Consolas, monospace);
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
button { font-family: inherit; cursor: pointer; }
input, textarea { font-family: inherit; color: inherit; }

/* Top bar */
.topbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
  flex: 0 0 auto;
}
.brand { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 15px; letter-spacing: .2px; }
.brand .dot { width: 22px; height: 22px; border-radius: 6px;
  background: linear-gradient(135deg, var(--accent), #a371f7);
  display: grid; place-items: center; color: #fff; font-size: 13px; }
.topbar .spacer { flex: 1; }
.btn {
  border: 1px solid var(--border); background: var(--panel); color: var(--text);
  padding: 7px 13px; border-radius: 8px; font-size: 13px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 6px; transition: .12s;
}
.btn:hover { border-color: var(--accent); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.primary:hover { filter: brightness(1.08); }
.btn.ghost { background: transparent; }
.btn.danger:hover { border-color: var(--red); color: var(--red); }
.btn:disabled { opacity: .45; cursor: not-allowed; }

.layout { flex: 1; display: flex; min-height: 0; }

/* Sidebar */
.sidebar {
  width: 270px; flex: 0 0 270px; border-right: 1px solid var(--border);
  display: flex; flex-direction: column; min-height: 0; background: rgba(0,0,0,0.12);
}
.sidebar .head { padding: 12px 14px 8px; display: flex; align-items: center; justify-content: space-between; }
.sidebar .head h2 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); }
.newbtn { border: none; background: var(--accent-muted); color: var(--accent); border-radius: 7px;
  width: 26px; height: 26px; font-size: 18px; line-height: 1; display: grid; place-items: center; }
.newbtn:hover { background: var(--accent); color: #fff; }
.postlist { overflow-y: auto; flex: 1; padding: 4px 8px 12px; }
.post-item { padding: 10px 11px; border-radius: 9px; border: 1px solid transparent; margin-bottom: 4px; }
.post-item:hover { background: var(--panel); }
.post-item.active { background: var(--accent-muted); border-color: var(--accent); }
.post-item .t { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.post-item .meta { display: flex; align-items: center; gap: 7px; margin-top: 5px; }
.badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
  padding: 2px 7px; border-radius: 20px; }
.badge.draft { background: rgba(139,148,158,0.18); color: var(--muted); }
.badge.published { background: var(--green-muted); color: var(--green); }
.post-item .date { font-size: 11px; color: var(--muted); }
.empty { padding: 30px 16px; text-align: center; color: var(--muted); font-size: 13px; }

/* Main */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.editor-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-bottom: 1px solid var(--border); }
.editor-toolbar .status { font-size: 12px; color: var(--muted); }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.seg button { border: none; background: transparent; color: var(--muted); padding: 6px 12px; font-size: 12.5px; font-weight: 600; }
.seg button.on { background: var(--panel); color: var(--text); }

.workspace { flex: 1; display: flex; min-height: 0; }
.pane { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pane.split { border-right: 1px solid var(--border); }
.scroll { overflow-y: auto; flex: 1; }

.titlefield { width: 100%; border: none; background: transparent; outline: none;
  font-size: 26px; font-weight: 700; padding: 22px 28px 6px; color: var(--text); }
.titlefield::placeholder { color: var(--muted); opacity: .6; }
.tagsfield { width: 100%; border: none; background: transparent; outline: none;
  font-size: 13px; padding: 4px 28px 14px; color: var(--accent); }
.tagsfield::placeholder { color: var(--muted); opacity: .6; }
.bodyfield { width: 100%; flex: 1; border: none; background: transparent; outline: none;
  resize: none; padding: 6px 28px 28px; font-family: var(--mono); font-size: 14px; line-height: 1.7;
  color: var(--text); min-height: 200px; }
.bodyfield::placeholder { color: var(--muted); opacity: .55; }

/* Reader / preview */
.reader { padding: 26px 30px 60px; max-width: 760px; }
.reader h1 { font-size: 30px; margin: 0 0 6px; line-height: 1.2; }
.reader .byline { color: var(--muted); font-size: 13px; margin-bottom: 24px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.reader .chip { background: var(--accent-muted); color: var(--accent); padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.prose { font-size: 15.5px; line-height: 1.75; }
.prose h1 { font-size: 25px; margin: 28px 0 12px; }
.prose h2 { font-size: 21px; margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 1px solid var(--border); }
.prose h3 { font-size: 17px; margin: 22px 0 8px; }
.prose p { margin: 12px 0; }
.prose a { color: var(--accent); text-decoration: none; }
.prose a:hover { text-decoration: underline; }
.prose code { font-family: var(--mono); font-size: 13px; background: var(--panel); padding: 2px 6px; border-radius: 5px; }
.prose pre { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; overflow-x: auto; }
.prose pre code { background: none; padding: 0; }
.prose blockquote { border-left: 3px solid var(--accent); margin: 14px 0; padding: 4px 16px; color: var(--muted); }
.prose ul, .prose ol { padding-left: 24px; margin: 12px 0; }
.prose li { margin: 5px 0; }
.prose img { max-width: 100%; border-radius: 8px; }
.prose hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
.prose table { border-collapse: collapse; margin: 14px 0; }
.prose th, .prose td { border: 1px solid var(--border); padding: 6px 12px; }

.placeholder-full { flex: 1; display: grid; place-items: center; text-align: center; color: var(--muted); padding: 40px; }
.placeholder-full .big { font-size: 17px; font-weight: 600; color: var(--text); margin-bottom: 6px; }

.toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%) translateY(80px);
  background: var(--text); color: var(--bg); padding: 9px 18px; border-radius: 20px; font-size: 13px;
  font-weight: 600; opacity: 0; transition: .25s; pointer-events: none; }
.toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
</style>
</head>
<body>
<div class="topbar">
  <div class="brand"><span class="dot">✎</span> Blog Studio</div>
  <div class="spacer"></div>
  <span class="status" id="savestate"></span>
  <button class="btn ghost danger" id="deleteBtn" title="Delete post" disabled>Delete</button>
  <button class="btn" id="saveBtn" disabled>Save draft</button>
  <button class="btn primary" id="publishBtn" disabled>Publish</button>
</div>
<div class="layout">
  <aside class="sidebar">
    <div class="head"><h2>Posts</h2><button class="newbtn" id="newBtn" title="New post">+</button></div>
    <div class="postlist" id="postlist"></div>
  </aside>
  <main class="main">
    <div class="editor-toolbar">
      <span class="status" id="metaline">No post selected</span>
      <div class="spacer" style="flex:1"></div>
      <div class="seg" id="viewseg">
        <button data-view="edit" class="on">Edit</button>
        <button data-view="split">Split</button>
        <button data-view="read">Preview</button>
      </div>
    </div>
    <div class="workspace" id="workspace">
      <div class="placeholder-full" id="welcome">
        <div>
          <div class="big">Welcome to your Blog Studio ✨</div>
          <div>Create a new post or pick one from the sidebar to start writing.</div>
          <div style="margin-top:16px"><button class="btn primary" id="welcomeNew">+ New post</button></div>
        </div>
      </div>
    </div>
  </main>
</div>
<div class="toast" id="toast"></div>

<script>
// ---- tiny markdown renderer (self-contained) ----
function escapeHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function inline(s){
  s = escapeHtml(s);
  s = s.replace(/!\\[([^\\]]*)\\]\\(([^)\\s]+)\\)/g,'<img alt="$1" src="$2" />');
  s = s.replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\`([^\`]+)\`/g,'<code>$1</code>');
  s = s.replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>');
  s = s.replace(/(^|[^*])\\*([^*]+)\\*/g,'$1<em>$2</em>');
  s = s.replace(/_([^_]+)_/g,'<em>$1</em>');
  return s;
}
function renderMarkdown(src){
  const lines = String(src||"").replace(/\\r\\n/g,"\\n").split("\\n");
  let html="", i=0;
  while(i<lines.length){
    let line=lines[i];
    if(/^\`\`\`/.test(line)){
      const lang=line.slice(3).trim(); let buf=[]; i++;
      while(i<lines.length && !/^\`\`\`/.test(lines[i])){ buf.push(escapeHtml(lines[i])); i++; }
      i++; html+='<pre><code>'+buf.join("\\n")+'</code></pre>'; continue;
    }
    if(/^\\s*$/.test(line)){ i++; continue; }
    let m;
    if(m=/^(#{1,6})\\s+(.*)$/.exec(line)){ const l=m[1].length; html+='<h'+l+'>'+inline(m[2])+'</h'+l+'>'; i++; continue; }
    if(/^\\s*([-*_])\\s*\\1\\s*\\1[-*_\\s]*$/.test(line)){ html+='<hr />'; i++; continue; }
    if(/^\\s*>/.test(line)){ let buf=[]; while(i<lines.length && /^\\s*>/.test(lines[i])){ buf.push(lines[i].replace(/^\\s*>\\s?/,"")); i++; } html+='<blockquote>'+renderMarkdown(buf.join("\\n"))+'</blockquote>'; continue; }
    if(/^\\s*[-*+]\\s+/.test(line)){ let buf=[]; while(i<lines.length && /^\\s*[-*+]\\s+/.test(lines[i])){ buf.push('<li>'+inline(lines[i].replace(/^\\s*[-*+]\\s+/,""))+'</li>'); i++; } html+='<ul>'+buf.join("")+'</ul>'; continue; }
    if(/^\\s*\\d+\\.\\s+/.test(line)){ let buf=[]; while(i<lines.length && /^\\s*\\d+\\.\\s+/.test(lines[i])){ buf.push('<li>'+inline(lines[i].replace(/^\\s*\\d+\\.\\s+/,""))+'</li>'); i++; } html+='<ol>'+buf.join("")+'</ol>'; continue; }
    let buf=[];
    while(i<lines.length && !/^\\s*$/.test(lines[i]) && !/^(#{1,6})\\s/.test(lines[i]) && !/^\\s*[-*+]\\s/.test(lines[i]) && !/^\\s*\\d+\\.\\s/.test(lines[i]) && !/^\\s*>/.test(lines[i]) && !/^\`\`\`/.test(lines[i])){ buf.push(lines[i]); i++; }
    html+='<p>'+inline(buf.join("\\n"))+'</p>';
  }
  return html;
}

// ---- state ----
let posts = [];
let current = null;       // active post object (server copy)
let dirty = false;
let view = "edit";
let saveTimer = null;

const $ = (id)=>document.getElementById(id);
const api = async (path, opts)=>{ const r = await fetch(path, opts); if(!r.ok) throw new Error(await r.text()); return r.status===204?null:r.json(); };
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1600); }
function fmtDate(iso){ if(!iso) return ""; try{ return new Date(iso).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}catch{return "";} }

async function loadPosts(){ posts = await api("/api/posts"); renderList(); }

function renderList(){
  const el=$("postlist");
  if(!posts.length){ el.innerHTML='<div class="empty">No posts yet.<br/>Click + to write your first one.</div>'; return; }
  el.innerHTML="";
  for(const p of posts){
    const d=document.createElement("div");
    d.className="post-item"+(current&&current.slug===p.slug?" active":"");
    d.innerHTML='<div class="t"></div><div class="meta"><span class="badge '+p.status+'">'+p.status+'</span><span class="date">'+fmtDate(p.updatedAt)+'</span></div>';
    d.querySelector(".t").textContent=p.title||"Untitled";
    d.onclick=()=>selectPost(p.slug);
    el.appendChild(d);
  }
}

function buildEditor(){
  const ws=$("workspace");
  ws.innerHTML=
    '<div class="pane split" id="editPane">'+
      '<div class="scroll" style="display:flex;flex-direction:column">'+
        '<input class="titlefield" id="title" placeholder="Post title" />'+
        '<input class="tagsfield" id="tags" placeholder="tags, comma, separated" />'+
        '<textarea class="bodyfield" id="body" placeholder="Write your story in Markdown..."></textarea>'+
      '</div>'+
    '</div>'+
    '<div class="pane" id="readPane"><div class="scroll"><div class="reader" id="reader"></div></div></div>';
  $("title").value=current.title||"";
  $("tags").value=(current.tags||[]).join(", ");
  $("body").value=current.content||"";
  $("title").addEventListener("input",onEdit);
  $("tags").addEventListener("input",onEdit);
  $("body").addEventListener("input",onEdit);
  applyView();
  renderReader();
}

function applyView(){
  const editPane=$("editPane"), readPane=$("readPane");
  if(!editPane) return;
  if(view==="edit"){ editPane.style.display="flex"; editPane.classList.remove("split"); readPane.style.display="none"; }
  else if(view==="read"){ editPane.style.display="none"; readPane.style.display="flex"; }
  else { editPane.style.display="flex"; editPane.classList.add("split"); readPane.style.display="flex"; }
  for(const b of $("viewseg").children) b.classList.toggle("on", b.dataset.view===view);
}

function renderReader(){
  const r=$("reader"); if(!r) return;
  const title=$("title")?$("title").value:current.title;
  const tags=$("tags")?$("tags").value.split(",").map(t=>t.trim()).filter(Boolean):(current.tags||[]);
  const body=$("body")?$("body").value:current.content;
  let byline='<span>'+(current.status==="published"?"Published "+fmtDate(current.publishedAt||current.updatedAt):"Draft · "+fmtDate(current.updatedAt))+'</span>';
  for(const t of tags) byline+='<span class="chip">'+t.replace(/</g,"&lt;")+'</span>';
  r.innerHTML='<h1>'+(title||"Untitled").replace(/</g,"&lt;")+'</h1><div class="byline">'+byline+'</div><div class="prose">'+renderMarkdown(body)+'</div>';
}

function collect(){
  return { slug: current.slug, title: $("title").value, tags: $("tags").value, content: $("body").value };
}

function onEdit(){
  dirty=true;
  setSaveState("Unsaved changes");
  renderReader();
  $("saveBtn").disabled=false;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>saveCurrent(true), 1200); // autosave
}

function setSaveState(t){ $("savestate").textContent=t; }

async function saveCurrent(silent){
  if(!current) return;
  const payload=collect();
  const saved=await api("/api/posts"+(current.slug?"/"+current.slug:""), {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
  const wasNew=!current.slug;
  current=saved; dirty=false;
  setSaveState("Saved "+new Date().toLocaleTimeString());
  $("saveBtn").disabled=true;
  await loadPosts();
  updateToolbar();
  if(!silent) toast("Draft saved");
  if(wasNew) history.replaceState(null,"","#"+saved.slug);
  return saved;
}

async function publishCurrent(){
  if(!current) return;
  if(dirty || !current.slug) await saveCurrent(true);
  const saved=await api("/api/posts/"+current.slug+"/publish",{method:"POST"});
  current=saved; await loadPosts(); updateToolbar(); renderReader();
  toast("Published 🎉"); view="read"; applyView();
}

async function unpublishCurrent(){
  const saved=await api("/api/posts/"+current.slug+"/unpublish",{method:"POST"});
  current=saved; await loadPosts(); updateToolbar(); renderReader(); toast("Moved to drafts");
}

async function deleteCurrent(){
  if(!current||!current.slug) return;
  await api("/api/posts/"+current.slug,{method:"DELETE"});
  current=null; await loadPosts(); showWelcome(); toast("Deleted");
}

function updateToolbar(){
  const has=!!current;
  $("deleteBtn").disabled=!has||!current.slug;
  $("publishBtn").disabled=!has;
  $("saveBtn").disabled=!has||!dirty;
  if(has){
    $("metaline").textContent=(current.status==="published"?"Published":"Draft")+(current.slug?" · "+current.slug:" · (unsaved)");
    if(current.status==="published"){ $("publishBtn").textContent="Unpublish"; $("publishBtn").classList.remove("primary"); }
    else { $("publishBtn").textContent="Publish"; $("publishBtn").classList.add("primary"); }
  } else { $("metaline").textContent="No post selected"; }
}

async function selectPost(slug){
  const p = await api("/api/posts/"+slug);
  current=p; dirty=false; view = view==="edit"?"edit":view;
  buildEditor(); updateToolbar(); renderList(); setSaveState("");
  history.replaceState(null,"","#"+slug);
}

function newPost(){
  current={ slug:"", title:"", tags:[], content:"", status:"draft", updatedAt:new Date().toISOString() };
  dirty=false; buildEditor(); updateToolbar(); renderList(); setSaveState("New draft");
  setTimeout(()=>$("title")&&$("title").focus(),0);
}

function showWelcome(){
  $("workspace").innerHTML='<div class="placeholder-full"><div><div class="big">Welcome to your Blog Studio ✨</div><div>Create a new post or pick one from the sidebar.</div><div style="margin-top:16px"><button class="btn primary" id="welcomeNew">+ New post</button></div></div></div>';
  $("welcomeNew").onclick=newPost;
  updateToolbar();
}

// ---- events wiring ----
$("newBtn").onclick=newPost;
if($("welcomeNew")) $("welcomeNew").onclick=newPost;
$("saveBtn").onclick=()=>saveCurrent(false);
$("publishBtn").onclick=()=>{ if(current&&current.status==="published") unpublishCurrent(); else publishCurrent(); };
$("deleteBtn").onclick=()=>{ if(confirm("Delete this post permanently?")) deleteCurrent(); };
for(const b of $("viewseg").children){ b.onclick=()=>{ view=b.dataset.view; applyView(); }; }
document.addEventListener("keydown",(e)=>{ if((e.ctrlKey||e.metaKey)&&e.key==="s"){ e.preventDefault(); if(current) saveCurrent(false); }});

// ---- live sync via SSE ----
try{
  const es=new EventSource("/events");
  es.onmessage=(ev)=>{
    try{ const data=JSON.parse(ev.data);
      if(data.type==="changed"){
        loadPosts();
        if(current&&current.slug&&data.slug===current.slug&&!dirty){ selectPost(current.slug); }
      }
    }catch{}
  };
}catch{}

// ---- boot ----
(async()=>{
  await loadPosts();
  const hash=location.hash.replace("#","");
  if(hash && posts.some(p=>p.slug===hash)) selectPost(hash);
  else { showWelcome(); }
})();
</script>
</body>
</html>`;
}
