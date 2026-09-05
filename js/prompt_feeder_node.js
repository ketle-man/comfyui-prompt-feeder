import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { openPromptLibrary } from "./prompt_library.js";
import { t } from "./i18n.js";

// デバッグ出力フラグ（調査時はtrueにしてください）
const DEBUG = false;

function debugLog(...args) {
	if (DEBUG) console.log("[PromptFeeder]", ...args);
}

// ノードごとの実行状態 Map<nodeId(string), { running: boolean, setRunning: fn }>
const _nodeStates = new Map();
// ノードごとの遅延タイマー ID Map<nodeId(string), timerId>
const _nodeTimers = new Map();
// ノードごとのプレビュー状態 Map<nodeId(string), { text, lastText }>
const _nodePreviewStates = new Map();
// ノードごとの実行世代カウンタ Map<nodeId(string), number>
// Run押下ごとに+1し、古い世代の遅延タイマーはキュー投入しない（ stale timer 対策）
const _nodeRunGen = new Map();
let _setupDone = false;

app.registerExtension({
	name: "Antigravity.PromptFeeder",

	// ---- ノード定義フック ----
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData.name !== "PromptFeeder") return;

		const onNodeCreated = nodeType.prototype.onNodeCreated;
		nodeType.prototype.onNodeCreated = function () {
			const ret = onNodeCreated?.apply(this, arguments);
			const node = this;

			// ---- コンテナ ----
			const container = document.createElement("div");
			container.style.cssText =
				"display:flex;align-items:center;justify-content:center;gap:4px;" +
				"padding:5px;margin-top:5px;box-sizing:border-box;width:100%;";

			// ---- ボタン生成 ----
			const runBtn  = makeBtn(t("node.run"),      "#2a7a3a", t("node.run_title"));
			const stopBtn = makeBtn(t("node.stop"),     "#7a2a2a", t("node.stop_title"));
			const libBtn  = makeBtn(t("node.lib"),      "#3a3a8a", t("node.lib_title"));
			const selBtn  = makeBtn(t("node.sel_on"),   "#4a708b", t("node.sel_title"));

			// 停止状態で初期化
			stopBtn.disabled = true;
			stopBtn.style.opacity = "0.4";

			// ---- 状態管理 ----
			function setRunning(running) {
				_nodeStates.set(String(node.id), { running, setRunning });
				runBtn.disabled  = running;
				runBtn.style.opacity  = running ? "0.4" : "1";
				stopBtn.disabled = !running;
				stopBtn.style.opacity = running ? "1" : "0.4";
			}

			function updateSelBtn(val) {
				selBtn.textContent = val ? t("node.sel_on") : t("node.sel_off");
				selBtn.style.background = val ? "#4a708b" : "#444";
				selBtn.style.color = val ? "#fff" : "#aaa";
			}

		// ---- プレビューパネル（テキスト表示・3行分） ----
		const PREVIEW_H = 62;
		const COUNTER_H = 18;
		const BUTTONS_H = 46;
		const BOTTOM_PAD = 10;
		const previewPanel = document.createElement("div");
		previewPanel.style.cssText =
			`width:100%;padding:4px 5px ${BOTTOM_PAD}px;` +
			"box-sizing:border-box;display:none;overflow:hidden;";
		const previewText = document.createElement("div");
		previewText.style.cssText =
			`width:100%;height:${PREVIEW_H}px;overflow-y:auto;border-radius:4px;` +
			"background:#0d0d0d;color:#ccc;font-size:11px;line-height:1.4;padding:6px 8px;" +
			"box-sizing:border-box;white-space:pre-wrap;word-break:break-word;";
			previewText.textContent = "";
			const counterEl = document.createElement("div");
			counterEl.style.cssText =
				"font-size:10px;color:#7a8aaa;padding:0 5px 2px;text-align:right;";
			counterEl.textContent = "";
			previewPanel.append(counterEl, previewText);

		function setPreviewText(text) {
			const existing = _nodePreviewStates.get(String(node.id));
			_nodePreviewStates.set(String(node.id), {
				text: previewText,
				counter: counterEl,
				lastText: text ?? existing?.lastText ?? "",
			});
			if (text !== undefined) {
				previewText.textContent = text;
			}
		}
		function setCounterText(text) {
			const ps = _nodePreviewStates.get(String(node.id));
			if (ps) ps.counter.textContent = text ?? "";
			else counterEl.textContent = text ?? "";
		}
		setPreviewText("");
		previewPanel.style.display = "block";

		const getW = (name) => node.widgets?.find(w => w.name === name);

		// ---- アイドル時プレビュー（実行しなくても現在の設定内容を表示） ----
		let _previewReq = 0;
		async function updateIdlePreview() {
			const id = String(node.id);
			if (_nodeStates.get(id)?.running) return; // 実行中はsync更新を優先
			const mode = getW("mode")?.value ?? "edit";
			const idx = Math.max(0, Number(getW("index")?.value ?? 0));
			if (mode === "edit") {
				const lines = String(getW("text")?.value ?? "")
					.split("\n").map(s => s.trim()).filter(Boolean);
				if (!lines.length) {
					setPreviewText("");
					setCounterText("");
					return;
				}
				const i = Math.min(idx, lines.length - 1);
				setPreviewText(lines[i]);
				setCounterText(`${i + 1} / ${lines.length}`);
				return;
			}
			// library: サーバに現在の設定での件数＋該当行を問合せ
			const req = ++_previewReq;
			try {
				const params = new URLSearchParams({
					root: String(getW("source_root")?.value ?? "prompt-feeder-data"),
					dir: String(getW("directory")?.value ?? ""),
					sort: String(getW("sort_mode")?.value ?? "ascending"),
					index: String(idx),
					start: String(getW("start_index")?.value ?? 0),
					end: String(getW("end_index")?.value ?? 0),
					seed: String(getW("seed")?.value ?? 0),
					use_selection: String(getW("use_selection")?.value ?? true),
					selected_files: String(getW("selected_files")?.value ?? "[]"),
				});
				const res = await fetch("/prompt_feeder/preview?" + params.toString());
				const data = await res.json();
				if (req !== _previewReq) return; // 古い応答は破棄
				if (_nodeStates.get(id)?.running) return;
				if (!res.ok || !data.total) {
					setPreviewText("");
					setCounterText("");
					return;
				}
				setPreviewText(data.prompt ?? "");
				setCounterText(`${data.index + 1} / ${data.total}`);
			} catch (e) {
				debugLog("idle preview fetch failed:", e);
			}
		}

		// ウィジェット変更時にアイドルプレビューを更新（コールバックを連鎖）
		let _previewTimer = null;
		function hookWidget(name, delay = 0) {
			const w = getW(name);
			if (!w) return;
			const orig = w.callback;
			w.callback = function (...args) {
				// ComfyUI内部コールバックは this=widget を前提とするため中継する
				if (orig) orig.apply(this, args);
				if (delay > 0) {
					clearTimeout(_previewTimer);
					_previewTimer = setTimeout(updateIdlePreview, delay);
				} else {
					updateIdlePreview();
				}
			};
		}
		hookWidget("mode");
		hookWidget("text", 300);
		hookWidget("source_root");
		hookWidget("directory");
		hookWidget("index");
		hookWidget("sort_mode");
		hookWidget("start_index");
		hookWidget("end_index");
		hookWidget("seed");
		hookWidget("use_selection");
		hookWidget("selected_files");
		updateIdlePreview();

			// 初期登録
			setRunning(false);

			// ---- ボタン動作 ----
			runBtn.onclick = async () => {
				const id = String(node.id);
				if (_nodeStates.get(id)?.running) {
					debugLog(`Run ignored (already running): node=${id}`);
					return;
				}
				const gen = (_nodeRunGen.get(id) ?? 0) + 1;
				_nodeRunGen.set(id, gen);
				const idxW = node.widgets?.find(w => w.name === "index");
				if (idxW) idxW.value = 0;
				setRunning(true);
				debugLog(`Run pressed: node=${id} gen=${gen}`);
				try {
					await app.queuePrompt(0, 1);
					debugLog(`queuePrompt ok: node=${id} gen=${gen}`);
				} catch (e) {
					console.error("[PromptFeeder] queuePrompt failed:", e);
					setRunning(false);
				}
			};

			stopBtn.onclick = () => setRunning(false);
			libBtn.onclick  = () => openPromptLibrary(node);
			selBtn.onclick  = () => {
				const w = node.widgets?.find(w => w.name === "use_selection");
				if (w) {
					w.value = !w.value;
					updateSelBtn(w.value);
					if (w.callback) w.callback.call(w, w.value);
					node.setDirtyCanvas(true, true);
				}
			};

			container.append(runBtn, stopBtn, libBtn, selBtn);

			// ---- 外側ラッパー（ボタン行 + プレビューパネル）----
			const outerWrapper = document.createElement("div");
			outerWrapper.style.cssText = "width:100%;";
			outerWrapper.append(container, previewPanel);

			// ---- DOM ウィジェット登録 ----
			const domWidget = node.addDOMWidget(
				"prompt_feeder_controls",
				"prompt_feeder_controls",
				outerWrapper,
				{ getValue() { return ""; }, setValue() {} }
			);

			// ウィジェットの隠蔽と初期化
			const hideWidget = (name) => {
				const w = node.widgets?.find(w => w.name === name);
				if (w) {
					w.type = "hidden";
					w.hidden = true;
					w.computeSize = () => [0, -4]; // LiteGraphの隠しウィジェットの慣習
					if (w.element) w.element.style.display = "none";
				}
				return w;
			};

			setTimeout(() => {
				hideWidget("selected_files");
				const useW = hideWidget("use_selection");
				if (useW) updateSelBtn(useW.value);

				// mode 切替で sel ボタンの有効/無効・ウィジェットの減光を切り替え
				//（disabled ウィジェットは半透明描画＋値非表示＋操作不可になる。
				//  バックエンドへの値送信には影響しない）
				const EDIT_ONLY = ["text"];
				const LIB_ONLY = ["source_root", "directory", "sort_mode", "start_index", "end_index", "seed"];
				const modeW = node.widgets?.find(w => w.name === "mode");
				const applyMode = (modeVal) => {
					const isLib = modeVal === "library";
					selBtn.disabled = !isLib;
					selBtn.style.opacity = isLib ? "1" : "0.4";
					libBtn.disabled = !isLib;
					libBtn.style.opacity = isLib ? "1" : "0.4";
					for (const name of EDIT_ONLY) {
						const w = node.widgets?.find(w => w.name === name);
						if (w) w.disabled = isLib;
					}
					for (const name of LIB_ONLY) {
						const w = node.widgets?.find(w => w.name === name);
						if (w) w.disabled = !isLib;
					}
					node.setDirtyCanvas(true, true);
				};
				if (modeW) {
					applyMode(modeW.value);
					const origCb = modeW.callback;
					modeW.callback = function (...args) {
						if (origCb) origCb.apply(this, args);
						applyMode(args[0]);
					};
				}

				// ボタンが収まる最小幅を保証
				node.min_size = [277, 50];
				const sz = node.computeSize();
				sz[0] = Math.max(sz[0], 277);
				node.setSize(sz);
				node.setDirtyCanvas(true, true);
			}, 20);

		domWidget.computeSize = function(width) {
			return [width, BUTTONS_H + COUNTER_H + PREVIEW_H + BOTTOM_PAD];
		};

			node.onRemoved = function () {
				const id = String(node.id);
				clearTimeout(_nodeTimers.get(id));
				_nodeTimers.delete(id);
				_nodeStates.delete(id);
				_nodePreviewStates.delete(id);
				_nodeRunGen.delete(id);
			};

			return ret;
		};
	},

	// ---- グローバル同期イベント ----
	async setup() {
		if (_setupDone) return;
		_setupDone = true;

		api.addEventListener("prompt_feeder_sync", ({ detail }) => {
			const { node_id, next_index, has_next, preview_text, index, total } = detail;
			if (node_id == null) return;
			debugLog(`sync received: node=${node_id} next=${next_index} has_next=${has_next}`);
			const node = app.graph.getNodeById(Number(node_id));
			if (!node) return;

			const indexWidget = node.widgets?.find(w => w.name === "index");
			if (!indexWidget) return;

			// プレビュー更新
			if (preview_text !== undefined) {
				const ps = _nodePreviewStates.get(String(node.id));
				if (ps?.text) {
					ps.lastText = preview_text;
					ps.text.textContent = preview_text;
				}
				if (ps?.counter && index !== undefined && total !== undefined) {
					ps.counter.textContent = `${index + 1} / ${total}`;
				}
			}

			const state   = _nodeStates.get(String(node.id));
			const running = state?.running ?? false;

			if (has_next && running) {
				indexWidget.value = next_index;
				const capturedNodeId = String(node.id);
				const capturedGen = _nodeRunGen.get(capturedNodeId) ?? 0;
				clearTimeout(_nodeTimers.get(capturedNodeId));
				const timerId = setTimeout(async () => {
					_nodeTimers.delete(capturedNodeId);
					// Stop が押された場合・古い世代のタイマーはキューに追加しない
					const currentState = _nodeStates.get(capturedNodeId);
					const currentGen = _nodeRunGen.get(capturedNodeId) ?? 0;
					if (!currentState?.running || currentGen !== capturedGen) {
						debugLog(`timer skipped: node=${capturedNodeId} running=${currentState?.running} gen=${currentGen} (captured ${capturedGen})`);
						return;
					}
					debugLog(`timer queueing: node=${capturedNodeId} gen=${capturedGen}`);
					try {
						await app.queuePrompt(0, 1);
					} catch (e) {
						console.error("[PromptFeeder] queuePrompt failed:", e);
						if (currentState?.setRunning) currentState.setRunning(false);
					}
				}, 500);
				_nodeTimers.set(capturedNodeId, timerId);
			} else {
				debugLog(`loop end: node=${String(node.id)} has_next=${has_next} running=${running}`);
				indexWidget.value = 0;
				if (state?.setRunning) state.setRunning(false);
			}
		});

		// ComfyUI がワークフローをキャンセル・エラー終了した際に running フラグをリセット
		const stopAll = () => {
			Array.from(_nodeStates.values()).forEach((state) => {
				if (state.running && state.setRunning) state.setRunning(false);
			});
		};
		api.addEventListener("execution_error",       stopAll);
		api.addEventListener("execution_interrupted", stopAll);
	}
});

// ---- ボタン生成ヘルパー ----
function makeBtn(label, bg, title = "") {
	const btn = document.createElement("button");
	btn.textContent = label;
	if (title) btn.title = title;
	btn.style.cssText =
		`padding:6px 4px;flex:1;background:${bg};color:#fff;border:none;` +
		"border-radius:4px;cursor:pointer;font-size:10px;font-weight:bold;" +
		"transition:all 0.15s;white-space:nowrap;box-shadow: 0 1px 2px rgba(0,0,0,0.3);";
	btn.addEventListener("mouseover", () => { if (!btn.disabled) btn.style.opacity = "0.8"; });
	btn.addEventListener("mouseout",  () => { if (!btn.disabled) btn.style.opacity = "1"; });
	return btn;
}
