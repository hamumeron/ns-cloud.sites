"use strict";
// ──────────────────────────────────────────
//  CodeDrop — app.ts
//  Compile:  tsc app.ts --target ES2020 --outFile app.js
// ──────────────────────────────────────────
// ── Storage ──────────────────────────────
const STORAGE_KEY = "codedrop_projects";
function loadProjects() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
function saveProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}
// ── State ────────────────────────────────
let projects = loadProjects();
let currentFiles = [createFile("index.html", getDefaultHtml())];
let activeFileId = currentFiles[0].id;
let currentView = "editor";
function createFile(name, content = "") {
    return {
        id: crypto.randomUUID(),
        name,
        content,
        lang: detectLang(name),
    };
}
function detectLang(name) {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const map = {
        html: "html", htm: "html",
        css: "css",
        js: "javascript", ts: "typescript",
        json: "json", md: "markdown",
        txt: "text",
    };
    return map[ext] ?? "text";
}
function getDefaultHtml() {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>My Site</title>
  <style>
    body {
      font-family: sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f0f4f8;
    }
    h1 { color: #2d3748; }
  </style>
</head>
<body>
  <h1>Hello, World! 👋</h1>
</body>
</html>`;
}
// ── Bundle: merge files into single HTML ─
function bundleFiles(files) {
    const html = files.find(f => f.lang === "html");
    if (!html)
        return "";
    let doc = html.content;
    // Inline CSS files
    const cssFiles = files.filter(f => f.lang === "css");
    const cssInline = cssFiles
        .map(f => `<style>/* ${f.name} */\n${f.content}</style>`)
        .join("\n");
    // Inline JS files
    const jsFiles = files.filter(f => f.lang === "javascript" || f.lang === "typescript");
    const jsInline = jsFiles
        .map(f => `<script>/* ${f.name} */\n${f.content}<\/script>`)
        .join("\n");
    // Inject before </head>
    if (cssInline) {
        doc = doc.replace(/<\/head>/i, `${cssInline}\n</head>`);
    }
    // Inject before </body>
    if (jsInline) {
        doc = doc.replace(/<\/body>/i, `${jsInline}\n</body>`);
    }
    return doc;
}
// ── DOM Helpers ──────────────────────────
function $(sel) {
    return document.querySelector(sel);
}
function showToast(msg, type = "info") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = `toast ${type} show`;
    setTimeout(() => { el.classList.remove("show"); }, 2800);
}
// ── Render: file list ────────────────────
function renderFileList() {
    const ul = $("#file-list");
    ul.innerHTML = "";
    currentFiles.forEach(f => {
        const li = document.createElement("li");
        li.className = "file-item" + (f.id === activeFileId ? " active" : "");
        li.dataset.id = f.id;
        li.innerHTML = `
      <span class="file-icon">${fileIcon(f.lang)}</span>
      <span class="file-name">${escHtml(f.name)}</span>
      <button class="file-del" title="削除">✕</button>
    `;
        li.addEventListener("click", (e) => {
            const del = e.target.closest(".file-del");
            if (del) {
                if (currentFiles.length === 1) {
                    showToast("最低1つのファイルが必要です", "error");
                    return;
                }
                currentFiles = currentFiles.filter(x => x.id !== f.id);
                if (activeFileId === f.id)
                    activeFileId = currentFiles[0].id;
                renderAll();
                return;
            }
            saveCurrentContent();
            activeFileId = f.id;
            renderAll();
        });
        ul.appendChild(li);
    });
}
function fileIcon(lang) {
    const icons = {
        html: "H", css: "C", javascript: "J", typescript: "T",
        json: "{}", markdown: "M", text: "T",
    };
    return icons[lang] ?? "F";
}
function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// ── Render: tabs ─────────────────────────
function renderTabs() {
    const bar = $("#editor-tabs");
    bar.innerHTML = "";
    currentFiles.forEach(f => {
        const btn = document.createElement("button");
        btn.className = "editor-tab" + (f.id === activeFileId ? " active" : "");
        btn.innerHTML = `${escHtml(f.name)}<button class="tab-close" title="閉じる">✕</button>`;
        btn.addEventListener("click", (e) => {
            const close = e.target.closest(".tab-close");
            if (close) {
                if (currentFiles.length === 1) {
                    showToast("最低1つのファイルが必要です", "error");
                    return;
                }
                currentFiles = currentFiles.filter(x => x.id !== f.id);
                if (activeFileId === f.id)
                    activeFileId = currentFiles[0].id;
                renderAll();
                return;
            }
            saveCurrentContent();
            activeFileId = f.id;
            renderAll();
        });
        bar.appendChild(btn);
    });
}
// ── Render: editor ───────────────────────
function renderEditor() {
    const ta = $("#code-editor");
    const active = currentFiles.find(f => f.id === activeFileId);
    if (active) {
        ta.value = active.content;
        updateLineNumbers(active.content);
    }
}
function updateLineNumbers(content) {
    const lines = content.split("\n").length;
    const ln = $("#line-numbers");
    ln.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
}
function saveCurrentContent() {
    const ta = $("#code-editor");
    const f = currentFiles.find(x => x.id === activeFileId);
    if (f)
        f.content = ta.value;
}
// ── Render: preview ──────────────────────
function renderPreview() {
    const frame = $("#preview-frame");
    const empty = $("#preview-empty");
    const urlPath = $("#preview-url-path");
    const htmlFile = currentFiles.find(f => f.lang === "html");
    if (!htmlFile) {
        frame.classList.remove("visible");
        empty.classList.remove("hidden");
        return;
    }
    const bundled = bundleFiles(currentFiles);
    frame.classList.add("visible");
    empty.classList.add("hidden");
    urlPath.textContent = htmlFile.name;
    const blob = new Blob([bundled], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    frame.src = url;
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
// ── Render: sites ─────────────────────────
function renderSites() {
    const grid = $("#sites-grid");
    const empty = $("#sites-empty");
    grid.innerHTML = "";
    if (projects.length === 0) {
        empty.classList.remove("hidden");
        return;
    }
    empty.classList.add("hidden");
    projects.slice().reverse().forEach(p => {
        const card = document.createElement("div");
        card.className = "site-card";
        const date = new Date(p.publishedAt).toLocaleDateString("ja-JP");
        const exts = [...new Set(p.files.map(f => f.name.split(".").pop() ?? ""))];
        card.innerHTML = `
      <div class="site-thumb">
        <div class="site-thumb-placeholder">
          <span style="font-family:monospace;font-size:11px;color:var(--text3)">&lt;${p.name}&gt;</span>
        </div>
      </div>
      <div class="site-info">
        <div class="site-name-label">${escHtml(p.name)}</div>
        <div class="site-meta-row">
          <span class="site-slug">/${p.slug}</span>
          <span class="site-date">${date}</span>
        </div>
        ${p.description ? `<p style="font-size:12px;color:var(--text2);margin-top:6px">${escHtml(p.description)}</p>` : ""}
        <div class="site-tags">
          ${exts.map(e => `<span class="site-tag">.${e}</span>`).join("")}
        </div>
      </div>
    `;
        // Lazy-render thumbnail
        const thumb = card.querySelector(".site-thumb");
        card.addEventListener("mouseenter", () => {
            if (thumb.querySelector("iframe"))
                return;
            const iframe = document.createElement("iframe");
            iframe.setAttribute("sandbox", "allow-scripts");
            const blob = new Blob([p.htmlContent], { type: "text/html" });
            iframe.src = URL.createObjectURL(blob);
            thumb.querySelector(".site-thumb-placeholder")?.remove();
            thumb.appendChild(iframe);
        });
        card.addEventListener("click", () => openViewer(p));
        grid.appendChild(card);
    });
}
// ── Viewer ───────────────────────────────
function openViewer(p) {
    const viewer = $("#site-viewer");
    const frame = $("#viewer-frame");
    const slugEl = $("#viewer-slug");
    viewer.className = "site-viewer open";
    slugEl.textContent = p.slug;
    const blob = new Blob([p.htmlContent], { type: "text/html" });
    frame.src = URL.createObjectURL(blob);
    $("#viewer-close").onclick = () => { viewer.className = "site-viewer"; };
    $("#viewer-delete").onclick = () => {
        if (!confirm(`「${p.name}」を削除しますか？`))
            return;
        projects = projects.filter(x => x.id !== p.id);
        saveProjects(projects);
        viewer.className = "site-viewer";
        renderSites();
        showToast("削除しました", "info");
    };
    $("#viewer-edit").onclick = () => {
        // Load project files into editor
        currentFiles = p.files.map(f => ({ ...f }));
        activeFileId = currentFiles[0].id;
        $("#site-name").value = p.name;
        $("#site-desc").value = p.description;
        viewer.className = "site-viewer";
        switchView("editor");
        renderAll();
    };
}
// ── Publish ──────────────────────────────
function generateSlug(name) {
    const base = name
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        || "my-site";
    // Ensure uniqueness
    const existing = new Set(projects.map(p => p.slug));
    let slug = base;
    let n = 1;
    while (existing.has(slug))
        slug = `${base}-${n++}`;
    return slug;
}
function openPublishModal() {
    saveCurrentContent();
    const name = $("#site-name").value.trim() || "my-site";
    const desc = $("#site-desc").value.trim();
    const slug = generateSlug(name);
    const summary = document.createElement("div");
    summary.innerHTML = currentFiles
        .map(f => `<div>📄 ${escHtml(f.name)} <span style="color:var(--text3)">(${f.content.length} chars)</span></div>`)
        .join("");
    const summaryEl = $("#publish-summary");
    summaryEl.innerHTML = "";
    summaryEl.appendChild(summary);
    $("#modal-url-slug").textContent = slug;
    $("#publish-modal").classList.add("open");
    $("#modal-confirm").onclick = () => {
        const bundled = bundleFiles(currentFiles);
        const project = {
            id: crypto.randomUUID(),
            name,
            slug,
            description: desc,
            files: currentFiles.map(f => ({ ...f })),
            publishedAt: new Date().toISOString(),
            htmlContent: bundled,
        };
        projects.push(project);
        saveProjects(projects);
        $("#publish-modal").classList.remove("open");
        showToast(`✓ 「${name}」を公開しました！`, "success");
        renderSites();
        switchView("sites");
    };
}
// ── View switching ────────────────────────
function switchView(view) {
    currentView = view;
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    $(`#view-${view}`).classList.add("active");
    $(`#nav-${view}`).classList.add("active");
    if (view === "sites")
        renderSites();
}
// ── Render all ────────────────────────────
function renderAll() {
    renderFileList();
    renderTabs();
    renderEditor();
    renderPreview();
}
// ── Tab key in textarea ───────────────────
function setupEditorKeys() {
    const ta = $("#code-editor");
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            ta.value = ta.value.slice(0, start) + "  " + ta.value.slice(end);
            ta.selectionStart = ta.selectionEnd = start + 2;
            onEditorChange();
        }
    });
    ta.addEventListener("input", onEditorChange);
    ta.addEventListener("scroll", syncScroll);
}
function onEditorChange() {
    const ta = $("#code-editor");
    const f = currentFiles.find(x => x.id === activeFileId);
    if (f) {
        f.content = ta.value;
        updateLineNumbers(ta.value);
    }
    debouncePreview();
}
function syncScroll() {
    const ta = $("#code-editor");
    const ln = $("#line-numbers");
    ln.scrollTop = ta.scrollTop;
}
let previewTimer = null;
function debouncePreview() {
    if (previewTimer)
        clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 600);
}
// ── Add file dialog ───────────────────────
function promptAddFile() {
    const name = prompt("ファイル名を入力してください (例: style.css, script.js)");
    if (!name || !name.trim())
        return;
    const trimmed = name.trim();
    if (currentFiles.find(f => f.name === trimmed)) {
        showToast("同じ名前のファイルが既にあります", "error");
        return;
    }
    const f = createFile(trimmed, "");
    currentFiles.push(f);
    activeFileId = f.id;
    renderAll();
}
// ── Init ─────────────────────────────────
function init() {
    setupEditorKeys();
    // Nav
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const view = btn.dataset.view;
            if (view)
                switchView(view);
        });
    });
    // Add file
    $("#add-file-btn").addEventListener("click", promptAddFile);
    // Publish
    $("#publish-btn").addEventListener("click", () => {
        saveCurrentContent();
        openPublishModal();
    });
    // Modal close/cancel
    $("#modal-close").addEventListener("click", () => {
        $("#publish-modal").classList.remove("open");
    });
    $("#modal-cancel").addEventListener("click", () => {
        $("#publish-modal").classList.remove("open");
    });
    // Refresh preview
    $("#refresh-preview").addEventListener("click", () => {
        saveCurrentContent();
        renderPreview();
    });
    // Sites buttons
    $("#new-project-btn").addEventListener("click", () => {
        currentFiles = [createFile("index.html", getDefaultHtml())];
        activeFileId = currentFiles[0].id;
        $("#site-name").value = "";
        $("#site-desc").value = "";
        switchView("editor");
        renderAll();
    });
    $("#goto-editor-btn").addEventListener("click", () => switchView("editor"));
    // Click outside modal
    $("#publish-modal").addEventListener("click", (e) => {
        if (e.target === e.currentTarget) {
            $("#publish-modal").classList.remove("open");
        }
    });
    // Initial render
    switchView("editor");
    renderAll();
}
document.addEventListener("DOMContentLoaded", init);
