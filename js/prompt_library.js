/**
 * Prompt Feeder Library - 3ペインモーダル
 * 左: フォルダツリー / 中: テキストファイル一覧 / 右: 内容プレビュー＋編集
 */

import { app } from "../../scripts/app.js";
import { t, getLang, setLang, LANG_OPTIONS } from "./i18n.js";

const ROOT_PFDATA = "prompt-feeder-data";

export function openPromptLibrary(node) {
    if (document.getElementById("ploop-lib-modal")) return;
    document.body.appendChild(buildModal(node));
}

// ----------------------------------------------------------------
// モーダル本体
// ----------------------------------------------------------------
function buildModal(node) {
    const overlay = el("div", {
        id: "ploop-lib-modal",
        style: "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;" +
               "display:flex;align-items:center;justify-content:center;",
    });
    overlay.addEventListener("keydown", e => { if (e.key === "Escape") overlay.remove(); });
    overlay.addEventListener("click",   e => { if (e.target === overlay) overlay.remove(); });

    const dialog = el("div", {
        style: "background:#1e1e2e;color:#ccc;border-radius:10px;" +
               "width:min(96vw,1100px);height:min(92vh,720px);display:flex;flex-direction:column;" +
               "box-shadow:0 8px 40px rgba(0,0,0,0.9);overflow:hidden;font-family:sans-serif;",
    });

    // ---- ヘッダー ----
    const header = el("div", {
        style: "display:flex;align-items:center;gap:8px;padding:10px 14px;" +
               "background:#16213e;border-bottom:1px solid #333;flex-shrink:0;",
    });
    const titleEl  = el("span", { style: "font-size:15px;font-weight:bold;color:#e0e0ff;flex:1;" }, t("lib.title"));
    // Per-user language opt-in (default: English, no browser auto-detect).
    // Changing it re-opens the library so all labels re-render immediately.
    const langSelect = el("select", {
        style: "background:#1a1a2e;color:#ccc;border:1px solid #3a3a5a;" +
               "border-radius:4px;padding:3px 4px;font-size:11px;flex-shrink:0;",
    });
    langSelect.title = t("lib.lang_tooltip");
    for (const opt of LANG_OPTIONS) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        langSelect.appendChild(o);
    }
    langSelect.value = getLang();
    langSelect.addEventListener("change", () => {
        setLang(langSelect.value);
        overlay.remove();
        openPromptLibrary(node);
    });
    const reloadBtn = mkBtn("↺", "#2a4a7a", t("lib.reload_tooltip"));
    reloadBtn.style.padding = "3px 9px";
    const closeBtn  = el("button", {
        style: "background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:4px 8px;",
    }, "✕");
    closeBtn.onclick = () => overlay.remove();
    header.append(titleEl, langSelect, reloadBtn, closeBtn);

    // ---- 3ペイン ----
    const body = el("div", {
        style: "display:flex;flex:1;overflow:hidden;",
    });

    // 左ペイン
    const leftPane = el("div", {
        style: "width:200px;flex-shrink:0;border-right:1px solid #333;" +
               "display:flex;flex-direction:column;overflow:hidden;",
    });
    const leftHeader = el("div", {
        style: "padding:6px 8px;font-size:11px;font-weight:bold;color:#7a8aaa;" +
               "background:#16213e;border-bottom:1px solid #2a2a4a;flex-shrink:0;" +
               "display:flex;flex-direction:column;gap:5px;",
    });
    const foldersLabel = el("div", {}, t("lib.folders_header"));
    const rootSelect = el("select", {
        style: "flex:1;min-width:0;background:#1a1a2e;color:#ccc;border:1px solid #3a3a5a;" +
               "border-radius:4px;padding:3px 4px;font-size:10px;font-weight:normal;",
    });
    const settingsBtn = mkBtn("⚙", "#3a3a5a", t("lib.settings_tooltip"));
    settingsBtn.style.padding = "3px 7px";
    settingsBtn.style.fontSize = "11px";
    const rootRow = el("div", { style: "display:flex;gap:4px;" });
    rootRow.append(rootSelect, settingsBtn);
    leftHeader.append(foldersLabel, rootRow);
    const treeScroll = el("div", {
        style: "flex:1;overflow-y:auto;padding:6px 4px;",
    });
    leftPane.append(leftHeader, treeScroll);

    // 中ペイン
    const midPane = el("div", {
        style: "flex:1;display:flex;flex-direction:column;overflow:hidden;",
    });
    const midHeader = el("div", {
        style: "display:flex;align-items:center;gap:6px;padding:6px 10px;" +
               "background:#16213e;border-bottom:1px solid #2a2a4a;flex-shrink:0;",
    });
    const newFileBtn  = mkBtn(t("lib.new_file"),     "#2a4a7a", t("lib.new_file_tooltip"));
    const selAllBtn   = mkBtn(t("lib.select_all"),   "#2a5a3a", t("lib.select_all_tooltip"));
    const deselAllBtn = mkBtn(t("lib.deselect_all"), "#5a3a3a", t("lib.deselect_all_tooltip"));
    newFileBtn.style.padding  = "3px 8px";
    selAllBtn.style.padding   = "3px 8px";
    deselAllBtn.style.padding = "3px 8px";
    const midTitle = el("span", { style: "font-size:11px;color:#888;flex:1;" }, t("lib.folder_placeholder"));
    midHeader.append(midTitle, newFileBtn, selAllBtn, deselAllBtn);

    const listScroll = el("div", { style: "flex:1;overflow-y:auto;padding:8px;" });
    const list = el("div", {
        style: "display:flex;flex-direction:column;gap:4px;",
    });
    listScroll.appendChild(list);
    midPane.append(midHeader, listScroll);

    // 右ペイン
    const rightPane = el("div", {
        style: "width:280px;flex-shrink:0;border-left:1px solid #333;" +
               "display:flex;flex-direction:column;overflow:hidden;",
    });
    const rightHeader = el("div", {
        style: "padding:8px 10px;font-size:11px;font-weight:bold;color:#7a8aaa;" +
               "background:#16213e;border-bottom:1px solid #2a2a4a;flex-shrink:0;",
    }, t("lib.info_header"));
    const infoArea = el("div", { style: "flex:1;overflow-y:auto;padding:10px 8px;display:flex;flex-direction:column;gap:6px;" });
    const nameRow = el("div", {
        style: "display:flex;align-items:center;gap:4px;margin-bottom:2px;",
    });
    const infoName = el("div", {
        style: "flex:1;min-width:0;font-size:11px;color:#ccc;word-break:break-all;overflow:hidden;text-overflow:ellipsis;",
    }, "—");
    const renameBtn = el("button", {
        style: "flex-shrink:0;background:none;border:none;color:#7a8aaa;font-size:12px;" +
               "cursor:pointer;padding:0 2px;display:none;",
    }, "✎");
    renameBtn.title = t("lib.rename_tooltip");
    nameRow.append(infoName, renameBtn);
    const infoMeta = el("div", {
        style: "font-size:10px;color:#556;",
    }, "");
    const readonlyBadge = el("div", {
        style: "font-size:10px;color:#c9a34a;display:none;",
    }, t("lib.readonly_badge"));
    const previewArea = el("textarea");
    previewArea.readOnly = true;
    previewArea.placeholder = t("lib.preview_placeholder");
    previewArea.style.cssText = "flex:1;min-height:200px;background:#14142a;color:#ccc;" +
        "border:1px solid #3a3a5a;border-radius:4px;padding:8px;font-size:11px;" +
        "font-family:monospace;resize:none;white-space:pre-wrap;";
    const editBar = el("div", {
        style: "display:flex;gap:6px;flex-shrink:0;",
    });
    const editBtn = mkBtn(t("lib.edit"), "#2a4a7a", t("lib.edit_tooltip"));
    const saveBtn = mkBtn(t("lib.save"), "#2a6a2a", t("lib.save_tooltip"));
    editBtn.style.flex = "1";
    saveBtn.style.flex = "1";
    saveBtn.style.display = "none";
    editBar.append(editBtn, saveBtn);
    infoArea.append(nameRow, infoMeta, readonlyBadge, previewArea, editBar);
    rightPane.append(rightHeader, infoArea);

    body.append(leftPane, midPane, rightPane);

    // ---- フッター ----
    const footer = el("div", {
        style: "display:flex;align-items:center;gap:8px;padding:8px 14px;" +
               "background:#111;border-top:1px solid #2a2a3a;flex-shrink:0;",
    });
    const statusMsg = el("span", { style: "flex:1;font-size:11px;color:#556;" }, "");
    const applyBtn  = mkBtn(t("lib.apply"),  "#2a6a4a", t("lib.apply_tooltip"));
    const cancelBtn = mkBtn(t("lib.close"),  "#555");
    cancelBtn.onclick = () => overlay.remove();
    footer.append(statusMsg, applyBtn, cancelBtn);

    // ---- プリセットバー ----
    const presetBar = el("div", {
        style: "display:flex;align-items:center;gap:6px;padding:6px 14px;" +
               "background:#13172a;border-bottom:1px solid #2a2a4a;flex-shrink:0;flex-wrap:wrap;",
    });
    const presetLabel = el("span", { style: "font-size:11px;color:#7a8aaa;white-space:nowrap;" }, t("lib.preset_label"));
    const presetSelect = el("select", {
        style: "flex:1;min-width:120px;max-width:200px;background:#1a1a2e;color:#ccc;" +
               "border:1px solid #3a3a5a;border-radius:4px;padding:3px 6px;font-size:11px;",
    });
    const loadPresetBtn = mkBtn(t("lib.preset_load"),   "#2a4a7a", t("lib.preset_load_tooltip"));
    const delPresetBtn  = mkBtn(t("lib.preset_delete"), "#5a2a2a", t("lib.preset_delete_tooltip"));
    loadPresetBtn.style.padding = "3px 10px";
    delPresetBtn.style.padding  = "3px 10px";
    const barDivider = el("div", { style: "width:1px;height:18px;background:#333;flex-shrink:0;" });
    const presetNameInput = el("input");
    presetNameInput.type = "text";
    presetNameInput.placeholder = t("lib.preset_name_ph");
    presetNameInput.style.cssText = "background:#1a1a2e;color:#ccc;border:1px solid #3a3a5a;" +
        "border-radius:4px;padding:3px 8px;font-size:11px;width:130px;";
    const savePresetBtn = mkBtn(t("lib.preset_save"), "#2a6a2a", t("lib.preset_save_tooltip"));
    savePresetBtn.style.padding = "3px 10px";
    presetBar.append(presetLabel, presetSelect, loadPresetBtn, delPresetBtn, barDivider, presetNameInput, savePresetBtn);

    dialog.append(header, presetBar, body, footer);
    overlay.appendChild(dialog);

    // ----------------------------------------------------------------
    // 状態
    // ----------------------------------------------------------------
    let currentRoot = ROOT_PFDATA;   // 選択中のデータソース（ルート）
    let currentDir = "";            // 選択中フォルダの相対パス
    let currentFiles = [];          // 現在フォルダの全.txtファイル名
    let currentPreviews = {};       // ファイル名 → 先頭プレビュー
    const checkedFiles = new Set(); // チェック中のファイル名
    let editingFile = null;         // 編集中のファイル相対パス
    let editingLocked = true;

    function isWritableRoot() {
        return currentRoot === ROOT_PFDATA;
    }

    // single_file / prompt モードは1ファイルのみ選択可能
    function isSingleFileMode() {
        const mode = node.widgets?.find(w => w.name === "mode")?.value;
        return mode === "single_file" || mode === "prompt";
    }

    function updateWriteUI() {
        const writable = isWritableRoot();
        newFileBtn.disabled = !writable;
        newFileBtn.style.opacity = writable ? "1" : "0.4";
        newFileBtn.title = writable ? t("lib.new_file_tooltip") : t("lib.new_file_readonly_tooltip");
    }

    // ----------------------------------------------------------------
    // データソース選択肢（prompt-feeder-data + 登録済み外部パス）
    // ----------------------------------------------------------------
    async function refreshRootOptions() {
        let externalPaths = {};
        try {
            const res = await fetch("/prompt_feeder/external_paths");
            externalPaths = await res.json();
        } catch {
            externalPaths = {};
        }
        rootSelect.innerHTML = "";
        const pfOpt = document.createElement("option");
        pfOpt.value = ROOT_PFDATA;
        pfOpt.textContent = t("lib.root_pfdata");
        rootSelect.appendChild(pfOpt);
        for (const label of Object.keys(externalPaths).sort()) {
            const opt = document.createElement("option");
            opt.value = label;
            opt.textContent = `🧩 ${label}`;
            rootSelect.appendChild(opt);
        }
        // 選択中のルートが削除されていた場合は既定値に戻す
        if (currentRoot !== ROOT_PFDATA && !(currentRoot in externalPaths)) {
            currentRoot = ROOT_PFDATA;
        }
        rootSelect.value = currentRoot;
        return externalPaths;
    }

    // ----------------------------------------------------------------
    // 外部パス設定モーダル
    // ----------------------------------------------------------------
    function openExternalPathsSettings() {
        if (document.getElementById("ploop-ext-modal")) return;

        const ov = el("div", {
            id: "ploop-ext-modal",
            style: "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100000;" +
                   "display:flex;align-items:center;justify-content:center;",
        });
        ov.addEventListener("keydown", e => { if (e.key === "Escape") ov.remove(); });
        ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });

        const box = el("div", {
            style: "background:#1e1e2e;color:#ccc;border-radius:10px;width:min(90vw,480px);" +
                   "max-height:min(80vh,560px);display:flex;flex-direction:column;overflow:hidden;" +
                   "box-shadow:0 8px 40px rgba(0,0,0,0.9);font-family:sans-serif;",
        });

        const head = el("div", {
            style: "display:flex;align-items:center;gap:8px;padding:10px 14px;background:#16213e;" +
                   "border-bottom:1px solid #333;flex-shrink:0;",
        });
        const headTitle = el("span", { style: "font-size:14px;font-weight:bold;color:#e0e0ff;flex:1;" }, t("lib.settings_title"));
        const headClose = el("button", { style: "background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:2px 6px;" }, "✕");
        headClose.onclick = () => ov.remove();
        head.append(headTitle, headClose);

        const desc = el("div", { style: "padding:8px 14px 0;font-size:11px;color:#889;line-height:1.5;" }, t("lib.settings_desc"));
        const listWrap = el("div", { style: "flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:6px;" });

        const form = el("div", {
            style: "display:flex;flex-direction:column;gap:6px;padding:10px 14px;" +
                   "background:#13172a;border-top:1px solid #2a2a4a;flex-shrink:0;",
        });
        const labelInput = el("input");
        labelInput.type = "text";
        labelInput.placeholder = t("lib.settings_label_ph");
        labelInput.style.cssText = "background:#1a1a2e;color:#ccc;border:1px solid #3a3a5a;" +
            "border-radius:4px;padding:5px 8px;font-size:12px;box-sizing:border-box;";
        const pathInput = el("input");
        pathInput.type = "text";
        pathInput.placeholder = t("lib.settings_path_ph");
        pathInput.style.cssText = "flex:1;min-width:0;" + labelInput.style.cssText;
        const addBtn = mkBtn(t("lib.settings_add"), "#2a6a2a");
        const addRow = el("div", { style: "display:flex;gap:6px;" });
        addRow.append(pathInput, addBtn);
        form.append(labelInput, addRow);

        box.append(head, desc, listWrap, form);
        ov.appendChild(box);
        document.body.appendChild(ov);

        async function refreshList() {
            listWrap.innerHTML = "";
            let paths = {};
            try {
                const res = await fetch("/prompt_feeder/external_paths");
                paths = await res.json();
            } catch {
                paths = {};
            }
            const labels = Object.keys(paths).sort();
            if (!labels.length) {
                listWrap.appendChild(el("div", {
                    style: "color:#556;font-size:11px;padding:14px 0;text-align:center;",
                }, t("lib.settings_empty")));
                return;
            }
            for (const label of labels) {
                const row = el("div", {
                    style: "display:flex;align-items:center;gap:8px;background:#252540;" +
                           "border-radius:6px;padding:6px 8px;",
                });
                const info = el("div", { style: "flex:1;min-width:0;" });
                info.append(
                    el("div", {
                        style: "font-size:12px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
                        title: label,
                    }, `🧩 ${label}`),
                    el("div", {
                        style: "font-size:10px;color:#778;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
                        title: paths[label],
                    }, paths[label]),
                );
                const delBtn = mkBtn("🗑", "#5a2a2a");
                delBtn.style.padding = "3px 8px";
                delBtn.addEventListener("click", async () => {
                    if (!confirm(t("lib.settings_confirm_delete", label))) return;
                    try {
                        await fetch(`/prompt_feeder/external_paths/${encodeURIComponent(label)}`, { method: "DELETE" });
                        const wasSelected = currentRoot === label;
                        await refreshList();
                        await refreshRootOptions();
                        if (wasSelected) {
                            updateWriteUI();
                            await loadTree();
                            await selectFolder("");
                        }
                    } catch {
                        alert(t("lib.settings_error"));
                    }
                });
                row.append(info, delBtn);
                listWrap.appendChild(row);
            }
        }

        addBtn.addEventListener("click", async () => {
            const label = labelInput.value.trim();
            const p = pathInput.value.trim();
            if (!label || !p) {
                alert(t("lib.settings_missing"));
                return;
            }
            try {
                const res = await fetch("/prompt_feeder/external_paths", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label, path: p }),
                });
                const data = await res.json();
                if (!res.ok) {
                    alert(data.error || t("lib.settings_error"));
                    return;
                }
                labelInput.value = "";
                pathInput.value = "";
                await refreshList();
                await refreshRootOptions();
            } catch {
                alert(t("lib.settings_error"));
            }
        });

        refreshList();
    }

    settingsBtn.addEventListener("click", openExternalPathsSettings);

    function updateStatus() {
        const total = currentFiles.length;
        const sel   = [...checkedFiles].filter(f => currentFiles.includes(f)).length;
        const dir   = currentDir || t("lib.root_label");
        statusMsg.textContent = t("lib.status", sel, total, dir);
    }

    function setEditing(locked) {
        editingLocked = locked;
        previewArea.readOnly = locked;
        previewArea.style.background = locked ? "#14142a" : "#1a1a30";
        previewArea.style.borderColor = locked ? "#3a3a5a" : "#4a90d9";
        editBtn.style.display = locked ? "" : "none";
        saveBtn.style.display = locked ? "none" : "";
    }

    // ----------------------------------------------------------------
    // フォルダツリー描画
    // ----------------------------------------------------------------
    function buildTreeNode(item, depth) {
        const row = el("div", {
            style: `display:flex;align-items:center;gap:4px;padding:3px 4px;` +
                   `padding-left:${6 + depth * 14}px;border-radius:4px;cursor:pointer;` +
                   `transition:background 0.1s;`,
        });
        row.addEventListener("mouseenter", () => row.style.background = "#2a2a4a");
        row.addEventListener("mouseleave", () => {
            row.style.background = currentDir === item.path ? "#1e3a5a" : "";
        });

        const radio = el("input");
        radio.type = "radio";
        radio.name = "ploop-folder-sel";
        radio.style.cssText = "accent-color:#4a90d9;cursor:pointer;flex-shrink:0;";
        radio.dataset.path = item.path;

        const icon = el("span", {
            style: "font-size:13px;flex-shrink:0;",
        }, item.children.length > 0 ? "📂" : "📁");
        const name = el("span", {
            style: "font-size:11px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
        }, item.name);

        row.append(radio, icon, name);

        // 子ツリー
        const children = el("div");
        for (const child of item.children) {
            children.appendChild(buildTreeNode(child, depth + 1));
        }

        const wrap = el("div");
        wrap.append(row, children);

        radio.addEventListener("change", () => {
            if (radio.checked) selectFolder(item.path);
        });
        row.addEventListener("click", e => {
            if (e.target !== radio) { radio.checked = true; selectFolder(item.path); }
        });

        return wrap;
    }

    // ルート行
    function buildRootRow() {
        const row = el("div", {
            style: "display:flex;align-items:center;gap:4px;padding:3px 6px;" +
                   "border-radius:4px;cursor:pointer;transition:background 0.1s;",
        });
        row.addEventListener("mouseenter", () => row.style.background = "#2a2a4a");
        row.addEventListener("mouseleave", () => {
            row.style.background = currentDir === "" ? "#1e3a5a" : "";
        });
        const radio = el("input");
        radio.type = "radio";
        radio.name = "ploop-folder-sel";
        radio.style.cssText = "accent-color:#4a90d9;cursor:pointer;flex-shrink:0;";
        radio.dataset.path = "";
        const icon = el("span", { style: "font-size:13px;" }, "🏠");
        const name = el("span", { style: "font-size:11px;color:#ccc;" }, t("lib.root_label"));
        row.append(radio, icon, name);
        row.addEventListener("click", e => {
            if (e.target !== radio) { radio.checked = true; selectFolder(""); }
        });
        radio.addEventListener("change", () => { if (radio.checked) selectFolder(""); });
        return row;
    }

    async function loadTree() {
        treeScroll.innerHTML = "";
        try {
            const res  = await fetch("/prompt_feeder/tree?root=" + encodeURIComponent(currentRoot));
            const data = await res.json();
            treeScroll.appendChild(buildRootRow());
            for (const item of data.tree ?? []) {
                treeScroll.appendChild(buildTreeNode(item, 0));
            }
        } catch (e) {
            treeScroll.textContent = t("lib.tree_error");
            console.warn("[PromptLibrary] tree load failed:", e);
        }
    }

    // ----------------------------------------------------------------
    // フォルダ選択 → ファイル一覧読み込み
    // ----------------------------------------------------------------
    async function selectFolder(dirPath) {
        if (currentDir !== dirPath) {
            checkedFiles.clear();
        }
        currentDir = dirPath;
        editingFile = null;
        setEditing(true);
        previewArea.value = "";
        infoName.textContent = "—";
        infoMeta.textContent = "";
        list.innerHTML = "";
        midTitle.textContent = t("lib.loading");

        try {
            const params = new URLSearchParams({ root: currentRoot });
            if (dirPath) params.set("dir", dirPath);
            const res   = await fetch("/prompt_feeder/files?" + params.toString());
            const data  = await res.json();
            currentFiles = data.files ?? [];
            currentPreviews = data.previews ?? {};
        } catch (e) {
            currentFiles = [];
            currentPreviews = {};
            console.warn("[PromptLibrary] files load failed:", e);
        }

        midTitle.textContent = dirPath ? `📂 ${dirPath}` : `📂 ${t("lib.root_label")}`;
        renderList();
        updateStatus();
        updateWriteUI();
    }

    // ----------------------------------------------------------------
    // ファイル一覧描画
    // ----------------------------------------------------------------
    function renderList() {
        list.innerHTML = "";
        if (currentFiles.length === 0) {
            const empty = el("div", {
                style: "color:#555;font-size:12px;padding:20px;text-align:center;",
            }, t("lib.no_files"));
            list.appendChild(empty);
            return;
        }
        for (const fname of currentFiles) {
            list.appendChild(buildRow(fname));
        }
    }

    function buildRow(fname) {
        const relPath = currentDir ? `${currentDir}/${fname}` : fname;
        const checked = checkedFiles.has(fname);

        const row = el("div", {
            style: "display:flex;align-items:center;gap:8px;background:#252540;border-radius:6px;" +
                   "padding:6px 8px;" +
                   `border:2px solid ${checked ? "#4a90d9" : "transparent"};` +
                   "cursor:pointer;transition:border-color 0.12s;",
        });
        row.addEventListener("mouseenter", () => {
            if (!checkedFiles.has(fname)) row.style.borderColor = "#4a5a7a";
        });
        row.addEventListener("mouseleave", () => {
            row.style.borderColor = checkedFiles.has(fname) ? "#4a90d9" : "transparent";
        });

        // チェックボックス
        const cb = el("input");
        cb.type = "checkbox";
        cb.checked = checked;
        cb.style.cssText = "width:16px;height:16px;accent-color:#4a90d9;cursor:pointer;flex-shrink:0;";
        cb.addEventListener("change", e => {
            e.stopPropagation();
            if (cb.checked) {
                if (isSingleFileMode()) checkedFiles.clear();
                checkedFiles.add(fname);
            } else {
                checkedFiles.delete(fname);
            }
            if (isSingleFileMode()) {
                renderList();
            } else {
                row.style.borderColor = cb.checked ? "#4a90d9" : "transparent";
            }
            updateStatus();
        });

        // ファイル名＋プレビュー
        const textWrap = el("div", {
            style: "flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;",
        });
        const nameEl = el("div", {
            style: "font-size:11px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
            title: fname,
        }, `📝 ${fname}`);
        const prevEl = el("div", {
            style: "font-size:10px;color:#777;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
        }, currentPreviews[fname] ?? "");
        textWrap.append(nameEl, prevEl);

        row.append(cb, textWrap);

        // クリックで右ペインに内容表示
        row.addEventListener("click", () => showInfo(relPath, fname));

        return row;
    }

    // ----------------------------------------------------------------
    // 右ペイン：内容プレビュー＋編集
    // ----------------------------------------------------------------
    async function showInfo(relPath, fname) {
        editingFile = relPath;
        setEditing(true);
        infoName.textContent = fname;
        infoMeta.textContent = t("lib.loading");
        previewArea.value = "";
        editBtn.style.display = isWritableRoot() ? "" : "none";
        renameBtn.style.display = isWritableRoot() ? "" : "none";
        readonlyBadge.style.display = isWritableRoot() ? "none" : "";

        try {
            const params = new URLSearchParams({ root: currentRoot, path: relPath });
            const res  = await fetch("/prompt_feeder/file_content?" + params.toString());
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "load failed");
            infoName.textContent = data.name ?? fname;
            infoMeta.textContent = `${data.char_count} chars / ${(data.size_bytes / 1024).toFixed(1)} KB` +
                (data.truncated ? " (truncated)" : "");
            previewArea.value = data.content ?? "";
        } catch (e) {
            infoMeta.textContent = t("lib.info_error");
        }
    }

    editBtn.addEventListener("click", () => {
        if (!editingFile || !isWritableRoot()) return;
        setEditing(false);
        previewArea.focus();
    });

    saveBtn.addEventListener("click", async () => {
        if (!editingFile || !isWritableRoot()) return;
        const content = previewArea.value;
        if (new Blob([content]).size > 100 * 1024) {
            alert(t("lib.alert_too_large"));
            return;
        }
        try {
            const res = await fetch("/prompt_feeder/file_content", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ root: currentRoot, path: editingFile, content }),
            });
            if (!res.ok) throw new Error("save failed");
            setEditing(true);
            const fname = editingFile.split("/").pop();
            statusMsg.textContent = t("lib.save_success", fname);
            // 中ペインの先頭プレビューを更新
            const firstLine = (content.split("\n")[0] ?? "").slice(0, 50);
            currentPreviews[fname] = firstLine;
            renderList();
        } catch {
            alert(t("lib.alert_save_error"));
        }
    });

    // ----------------------------------------------------------------
    // ファイル名変更（INFOペインの✎ボタン）
    // ----------------------------------------------------------------
    function startRename() {
        if (!editingFile || !isWritableRoot()) return;
        const oldName = editingFile.split("/").pop();
        const dotIdx = oldName.lastIndexOf(".");

        const input = el("input");
        input.type = "text";
        input.value = oldName;
        input.style.cssText = "flex:1;min-width:0;font-size:11px;color:#ccc;background:#14142a;" +
            "border:1px solid #4a90d9;border-radius:3px;padding:2px 4px;box-sizing:border-box;";

        infoName.replaceWith(input);
        renameBtn.style.display = "none";
        input.focus();
        if (dotIdx > 0) input.setSelectionRange(0, dotIdx);
        else input.select();

        let done = false;

        function restore() {
            input.replaceWith(infoName);
            renameBtn.style.display = isWritableRoot() ? "" : "none";
        }

        async function commit() {
            if (done) return;
            const newName = input.value.trim();
            if (!newName || newName === oldName) {
                done = true;
                restore();
                return;
            }
            if (newName === "." || newName === ".." || /[\\/]/.test(newName)) {
                alert(t("lib.alert_invalid_filename"));
                input.focus();
                return;
            }
            done = true;
            input.disabled = true;
            try {
                const res = await fetch("/prompt_feeder/rename_file", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ root: currentRoot, path: editingFile, new_name: newName }),
                });
                const data = await res.json();
                if (!res.ok) {
                    if (res.status === 409) alert(t("lib.alert_file_exists"));
                    else alert(data.error || t("lib.alert_rename_error"));
                    done = false;
                    input.disabled = false;
                    input.focus();
                    return;
                }
                if (checkedFiles.has(oldName)) {
                    checkedFiles.delete(oldName);
                    checkedFiles.add(data.name);
                }
                restore();
                await selectFolder(currentDir);
                await showInfo(data.path, data.name);
                statusMsg.textContent = t("lib.rename_success", oldName, data.name);
            } catch {
                done = false;
                input.disabled = false;
                alert(t("lib.alert_rename_error"));
            }
        }

        input.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { e.preventDefault(); done = true; restore(); }
        });
        input.addEventListener("blur", commit);
    }

    renameBtn.addEventListener("click", startRename);

    // ----------------------------------------------------------------
    // データソース（ルート）切替
    // ----------------------------------------------------------------
    rootSelect.addEventListener("change", async () => {
        currentRoot = rootSelect.value;
        checkedFiles.clear();
        updateWriteUI();
        await loadTree();
        await selectFolder("");
    });

    // ----------------------------------------------------------------
    // 新規 .txt ファイル作成（モーダル内編集機能で内容を記入）
    // ----------------------------------------------------------------
    newFileBtn.addEventListener("click", async () => {
        if (!isWritableRoot()) return;
        const input = prompt(t("lib.new_file_prompt"), "");
        if (input == null) return;
        const name = input.trim();
        if (!name || name === "." || name === ".." || /[\\/]/.test(name)) {
            alert(t("lib.alert_invalid_filename"));
            return;
        }
        try {
            const res = await fetch("/prompt_feeder/create_file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ root: currentRoot, directory: currentDir, filename: name, content: "" }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 409) alert(t("lib.alert_file_exists"));
                else alert(data.error || t("lib.alert_create_error"));
                return;
            }
            await selectFolder(currentDir);
            await showInfo(data.path, data.name);
            setEditing(false);
            previewArea.focus();
        } catch {
            alert(t("lib.alert_create_error"));
        }
    });

    // ----------------------------------------------------------------
    // 全選択 / 全解除
    // ----------------------------------------------------------------
    selAllBtn.addEventListener("click", () => {
        if (isSingleFileMode()) return; // single_file モードでは1件のみ選択可能
        for (const f of currentFiles) checkedFiles.add(f);
        renderList();
        updateStatus();
    });
    deselAllBtn.addEventListener("click", () => {
        for (const f of currentFiles) checkedFiles.delete(f);
        renderList();
        updateStatus();
    });

    // ----------------------------------------------------------------
    // ノードに適用
    // ----------------------------------------------------------------
    applyBtn.addEventListener("click", () => {
        const singleMode = isSingleFileMode();
        const inCurrent = [...checkedFiles].filter(f => currentFiles.includes(f));

        if (singleMode && inCurrent.length !== 1) {
            alert(t("lib.alert_select_one_file"));
            return;
        }

        const rootWidget = node.widgets?.find(w => w.name === "source_root");
        if (rootWidget) {
            rootWidget.value = currentRoot;
            if (rootWidget.callback) rootWidget.callback.call(rootWidget, rootWidget.value);
        }

        const dirWidget = node.widgets?.find(w => w.name === "directory");
        if (dirWidget) {
            dirWidget.value = currentDir;
            if (dirWidget.callback) dirWidget.callback.call(dirWidget, dirWidget.value);
        }

        if (singleMode) {
            // single_file モード: 選択した1ファイルを file ウィジェットへ反映
            // （mode 自体はここでは変更しない。selected_files/use_selection は対象外）
            const fileWidget = node.widgets?.find(w => w.name === "file");
            if (fileWidget) {
                fileWidget.value = inCurrent[0];
                if (fileWidget.callback) fileWidget.callback.call(fileWidget, fileWidget.value);
            }
        } else {
            const selWidget = node.widgets?.find(w => w.name === "selected_files");
            if (selWidget) {
                selWidget.value = JSON.stringify(inCurrent);
                if (selWidget.callback) selWidget.callback.call(selWidget, selWidget.value);
            }

            // library モードに切り替え
            const modeWidget = node.widgets?.find(w => w.name === "mode");
            if (modeWidget) {
                modeWidget.value = "library";
                if (modeWidget.callback) modeWidget.callback.call(modeWidget, modeWidget.value);
            }
        }

        // インデックスをリセット
        const idxWidget = node.widgets?.find(w => w.name === "index");
        if (idxWidget) {
            idxWidget.value = 0;
            if (idxWidget.callback) idxWidget.callback.call(idxWidget, idxWidget.value);
        }

        if (app.graph && node) {
            app.graph.setDirtyCanvas(true, true);
        }

        overlay.remove();
    });

    // ----------------------------------------------------------------
    // 初期化：既存ウィジェット値を復元
    // ----------------------------------------------------------------
    function initFromNode() {
        const rootWidget = node.widgets?.find(w => w.name === "source_root");
        if (rootWidget?.value) currentRoot = rootWidget.value;
        // 登録が削除済みなど、選択肢に存在しない値は既定値にフォールバック
        const validRoot = [...rootSelect.options].some(o => o.value === currentRoot);
        if (!validRoot) currentRoot = ROOT_PFDATA;
        rootSelect.value = currentRoot;
        updateWriteUI();

        const dirWidget = node.widgets?.find(w => w.name === "directory");
        if (dirWidget?.value) currentDir = dirWidget.value;

        if (isSingleFileMode()) {
            const fileWidget = node.widgets?.find(w => w.name === "file");
            if (fileWidget?.value) checkedFiles.add(fileWidget.value);
        } else {
            const selWidget = node.widgets?.find(w => w.name === "selected_files");
            if (selWidget?.value) {
                try {
                    const arr = JSON.parse(selWidget.value);
                    for (const f of arr) checkedFiles.add(f);
                } catch (_) {}
            }
        }
    }

    // ---- プリセット管理 ----
    let allPresets = {};

    async function refreshPresetSelect() {
        try {
            const res = await fetch("/prompt_feeder/presets");
            allPresets = await res.json();
        } catch {
            allPresets = {};
        }
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = t("lib.preset_placeholder");
        presetSelect.innerHTML = "";
        presetSelect.appendChild(defaultOpt);
        for (const name of Object.keys(allPresets).sort()) {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            presetSelect.appendChild(opt);
        }
    }

    loadPresetBtn.addEventListener("click", async () => {
        const name = presetSelect.value;
        if (!name || !allPresets[name]) return;
        const preset = allPresets[name];
        const targetRoot = preset.root ?? ROOT_PFDATA;
        const targetDir = preset.directory ?? "";
        if (targetRoot !== currentRoot) {
            const validRoot = [...rootSelect.options].some(o => o.value === targetRoot);
            currentRoot = validRoot ? targetRoot : ROOT_PFDATA;
            rootSelect.value = currentRoot;
            updateWriteUI();
            await loadTree();
        }
        // selectFolder が checkedFiles.clear() するので、先にフォルダを切り替える
        await selectFolder(targetDir);
        // フォルダ読み込み完了後にチェック状態を設定して再描画
        checkedFiles.clear();
        for (const f of (preset.selected_files ?? [])) checkedFiles.add(f);
        renderList();
        updateStatus();
        const radios = treeScroll.querySelectorAll("input[type=radio][name='ploop-folder-sel']");
        for (const r of radios) {
            if (r.dataset.path === targetDir) { r.checked = true; break; }
        }
    });

    savePresetBtn.addEventListener("click", async () => {
        const name = presetNameInput.value.trim();
        if (!name) { alert(t("lib.alert_preset_name")); return; }
        if (allPresets[name] && !confirm(t("lib.confirm_overwrite", name))) return;
        const sel = [...checkedFiles].filter(f => currentFiles.includes(f));
        try {
            await fetch("/prompt_feeder/presets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, root: currentRoot, directory: currentDir, selected_files: sel }),
            });
            presetNameInput.value = "";
            await refreshPresetSelect();
            presetSelect.value = name;
            statusMsg.textContent = t("lib.status_saved", name);
        } catch {
            alert(t("lib.alert_save_error"));
        }
    });

    delPresetBtn.addEventListener("click", async () => {
        const name = presetSelect.value;
        if (!name) return;
        if (!confirm(t("lib.confirm_delete", name))) return;
        try {
            await fetch(`/prompt_feeder/presets/${encodeURIComponent(name)}`, { method: "DELETE" });
            await refreshPresetSelect();
            statusMsg.textContent = t("lib.status_deleted", name);
        } catch {
            alert(t("lib.alert_delete_error"));
        }
    });

    reloadBtn.addEventListener("click", loadTree);

    refreshRootOptions().then(() => {
        initFromNode();
        refreshPresetSelect();
        loadTree().then(() => {
            if (currentDir !== "") selectFolder(currentDir);
        });
    });

    return overlay;
}

// ----------------------------------------------------------------
// ヘルパー
// ----------------------------------------------------------------
function el(tag, attrs = {}, text) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === "style") e.style.cssText = v;
        else e[k] = v;
    }
    if (text !== undefined) e.textContent = text;
    return e;
}

function mkBtn(label, bg, title = "") {
    const btn = el("button", {
        style: `padding:5px 11px;background:${bg};color:#fff;border:none;` +
               "border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;" +
               "white-space:nowrap;transition:opacity 0.15s;",
    }, label);
    if (title) btn.title = title;
    btn.addEventListener("mouseenter", () => { if (!btn.disabled) btn.style.opacity = "0.8"; });
    btn.addEventListener("mouseleave", () => { if (!btn.disabled) btn.style.opacity = "1"; });
    return btn;
}
