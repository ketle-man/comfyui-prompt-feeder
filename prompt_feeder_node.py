import os
import json
import random
import re
import folder_paths

# デバッグ出力フラグ（調査時はTrueにしてください）
DEBUG = False

# テキストファイルの読み書きサイズ上限（100KB）
MAX_TEXT_BYTES = 100 * 1024


def _debug(*args):
    if DEBUG:
        print("[PromptFeeder]", *args)


def get_allowed_base() -> str:
    """許可されたベースディレクトリ（ComfyUI/user/default/prompt-feeder-data）を返す"""
    return os.path.join(folder_paths.base_path, "user", "default", "prompt-feeder-data")


# ----------------------------------------------------------------
# データソース（ルート）
# ----------------------------------------------------------------
# prompt-feeder-data: 従来通りの専用データフォルダ（読み書き可）
# 外部パス: ユーザーが個別に登録した既存のワイルドカード/プロンプト系
#   カスタムノードのデータフォルダ（ComfyUIフォルダ配下限定・読み取り専用）。
ROOT_PFDATA = "prompt-feeder-data"

# ツリー走査から除外するディレクトリ名（重い/無関係なフォルダをスキップ）
EXCLUDED_DIR_NAMES = {
    "__pycache__", "node_modules", ".git", ".svn", ".hg",
    ".venv", "venv", "env", "dist", "build", ".idea", ".vscode",
}


def _get_external_paths_file() -> str:
    return os.path.join(folder_paths.base_path, "user", "default", "prompt-feeder-external-paths.json")


def _load_external_paths() -> dict:
    """登録済み外部パス一覧を返す（{ラベル: ComfyUIフォルダからの相対パス}）"""
    path = _get_external_paths_file()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
    return {}


def _save_external_paths(paths: dict):
    path = _get_external_paths_file()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(paths, f, ensure_ascii=False, indent=2)


def get_root_base(root: str) -> str:
    """ルートキーに対応する許可ベースディレクトリの絶対パスを返す"""
    if root and root != ROOT_PFDATA:
        rel = _load_external_paths().get(root)
        if rel is not None:
            comfy_base = os.path.realpath(folder_paths.base_path)
            base = os.path.realpath(os.path.join(comfy_base, rel))
            # 登録後にComfyUIフォルダ外を指すよう改ざんされていないか再検証
            if base == comfy_base or base.startswith(comfy_base + os.sep):
                return base
    return get_allowed_base()


def normalize_root(value) -> str:
    """未知の値は安全側（prompt-feeder-data）にフォールバックする"""
    if value == ROOT_PFDATA:
        return ROOT_PFDATA
    if isinstance(value, str) and value in _load_external_paths():
        return value
    return ROOT_PFDATA


def resolve_safe_path(root: str, subdirectory: str) -> str:
    """
    ユーザー入力のサブディレクトリ名を受け取り、
    指定ルート配下の絶対パスを返す。パストラバーサルを防ぐ。
    """
    allowed_base = os.path.realpath(get_root_base(root))
    if not subdirectory:
        return allowed_base
    candidate = os.path.realpath(os.path.join(allowed_base, subdirectory))
    if candidate != allowed_base and not candidate.startswith(allowed_base + os.sep):
        raise ValueError("Access denied: directory must be within the allowed root")
    return candidate


def resolve_safe_file(root: str, rel_path: str) -> str:
    """ルート配下の相対ファイルパスを検証し、絶対パスを返す。"""
    base = os.path.realpath(get_root_base(root))
    full = os.path.realpath(os.path.join(base, rel_path))
    if not (full == base or full.startswith(base + os.sep)):
        raise ValueError("Access denied: path must be within the allowed root")
    return full


def natural_sort_key(s):
    """ファイル名を自然順序（1, 2, 10...）でソートするためのキー"""
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split('([0-9]+)', s)]


def _collect_library_prompts(root, directory, sort_mode, start_index, end_index,
                            seed, use_selection=True, selected_files="[]") -> list:
    """
    libraryモード用のプロンプト一覧を構築する。
    各ファイルの内容を行分割し、1行=1プロンプトとして連結して返す（editモードと同一扱い）。
    """
    # パスの解決と検証
    target_dir = resolve_safe_path(root, directory)
    _debug(f"target_dir={target_dir}")

    if not os.path.isdir(target_dir):
        raise FileNotFoundError("Specified directory was not found in the selected root")

    # シンボリックリンクを除外
    all_files = [
        f for f in os.listdir(target_dir)
        if f.lower().endswith(".txt")
        and os.path.isfile(os.path.join(target_dir, f))
        and not os.path.islink(os.path.join(target_dir, f))
    ]

    # selected_files フィルタリング
    try:
        sel = json.loads(selected_files) if selected_files else []
    except (json.JSONDecodeError, TypeError):
        sel = []

    if use_selection and sel:
        sel_set = set(sel)
        files = [f for f in all_files if f in sel_set]
        # selected の順序（natural sort）を維持
        files.sort(key=natural_sort_key)
    else:
        # もし選択が無効、またはリストが空なら、すべてのファイルを対象にする
        files = all_files
        files.sort(key=natural_sort_key)

    if not files:
        raise FileNotFoundError("No .txt files found in the specified directory")

    if sort_mode == "descending":
        files.reverse()
    elif sort_mode == "random":
        random.Random(seed).shuffle(files)

    # 範囲指定の適用
    if end_index == 0 or end_index >= len(files):
        files = files[start_index:]
    else:
        files = files[start_index:end_index + 1]

    if not files:
        raise ValueError("No prompts left after applying index range")

    prompts = []
    for fname in files:
        full = os.path.join(target_dir, fname)
        if os.path.islink(full):
            continue
        if os.path.getsize(full) > MAX_TEXT_BYTES:
            raise ValueError(f"File too large (max 100KB): {fname}")
        with open(full, "r", encoding="utf-8") as f:
            content = f.read()
        for line in content.splitlines():
            line = line.strip()
            if line:
                prompts.append(line)

    if not prompts:
        raise ValueError("No readable prompt content found in the specified directory")

    return prompts


def _collect_single_file_prompts(root, directory, filename, sort_mode, start_index, end_index,
                                seed) -> list:
    """
    single_fileモード用のプロンプト一覧を構築する。
    指定した1ファイルの内容を行分割し（1行=1プロンプト）、sort_mode適用後に
    start_index〜end_indexの行範囲だけを返す。
    """
    if not filename:
        raise ValueError("file is required in single_file mode")
    if not filename.lower().endswith(".txt"):
        raise ValueError("Only .txt files are supported")

    rel_path = f"{directory}/{filename}" if directory else filename
    full = resolve_safe_file(root, rel_path)
    _debug(f"single_file target={full}")

    if not os.path.isfile(full) or os.path.islink(full):
        raise FileNotFoundError(f"File not found: {filename}")
    if os.path.getsize(full) > MAX_TEXT_BYTES:
        raise ValueError(f"File too large (max 100KB): {filename}")

    with open(full, "r", encoding="utf-8") as f:
        content = f.read()

    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        raise ValueError("No readable prompt content found in the specified file")

    if sort_mode == "descending":
        lines.reverse()
    elif sort_mode == "random":
        random.Random(seed).shuffle(lines)

    # 範囲指定の適用（行単位）
    if end_index == 0 or end_index >= len(lines):
        lines = lines[start_index:]
    else:
        lines = lines[start_index:end_index + 1]

    if not lines:
        raise ValueError("No prompts left after applying index range")

    return lines


# ----------------------------------------------------------------
# プリセット保存ヘルパー
# ----------------------------------------------------------------
def _get_presets_file() -> str:
    return os.path.join(folder_paths.base_path, "user", "default", "prompt-feeder-presets.json")


def _load_presets() -> dict:
    path = _get_presets_file()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_presets(presets: dict):
    path = _get_presets_file()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(presets, f, ensure_ascii=False, indent=2)


# ----------------------------------------------------------------
# サーバー API ルート登録
# ----------------------------------------------------------------
def _setup_routes():
    try:
        from server import PromptServer
        from aiohttp import web

        routes = PromptServer.instance.routes

        @routes.get("/prompt_feeder/tree")
        async def api_tree(request):
            root = normalize_root(request.query.get("root"))
            base = get_root_base(root)
            if root == ROOT_PFDATA:
                os.makedirs(base, exist_ok=True)
            elif not os.path.isdir(base):
                return web.json_response({"tree": []})

            def _scan(path, rel="", depth=0):
                if depth > 20:
                    return []
                items = []
                try:
                    for entry in sorted(os.scandir(path), key=lambda e: e.name.lower()):
                        if entry.is_dir(follow_symlinks=False):
                            if entry.name.startswith(".") or entry.name in EXCLUDED_DIR_NAMES:
                                continue
                            rel_path = (rel + "/" + entry.name) if rel else entry.name
                            items.append({
                                "name": entry.name,
                                "path": rel_path,
                                "children": _scan(entry.path, rel_path, depth + 1),
                            })
                except PermissionError:
                    pass
                return items

            return web.json_response({"tree": _scan(base)})

        @routes.get("/prompt_feeder/files")
        async def api_files(request):
            root = normalize_root(request.query.get("root"))
            subdir = request.query.get("dir", "")
            try:
                target_dir = resolve_safe_path(root, subdir)
            except ValueError:
                return web.json_response({"error": "Access denied"}, status=403)

            if not os.path.isdir(target_dir):
                return web.json_response({"files": []})

            files = sorted(
                [f for f in os.listdir(target_dir)
                 if f.lower().endswith(".txt")
                 and os.path.isfile(os.path.join(target_dir, f))
                 and not os.path.islink(os.path.join(target_dir, f))],
                key=natural_sort_key
            )
            previews = {}
            for fname in files:
                full = os.path.join(target_dir, fname)
                try:
                    if os.path.getsize(full) > MAX_TEXT_BYTES:
                        previews[fname] = ""
                        continue
                    with open(full, "r", encoding="utf-8") as f:
                        content = f.read(200)
                    first_line = content.split("\n")[0] if content else ""
                    previews[fname] = first_line[:50]
                except Exception:
                    previews[fname] = ""
            return web.json_response({"files": files, "previews": previews})

        @routes.get("/prompt_feeder/file_content")
        async def api_file_content(request):
            root = normalize_root(request.query.get("root"))
            rel = request.query.get("path", "")
            if not rel:
                return web.json_response({"error": "path is required"}, status=400)
            try:
                full = resolve_safe_file(root, rel)
                if not os.path.isfile(full) or os.path.islink(full):
                    return web.json_response({"error": "Not found"}, status=404)
            except ValueError:
                return web.json_response({"error": "Access denied"}, status=403)
            except Exception:
                return web.json_response({"error": "Bad request"}, status=400)
            try:
                size_bytes = os.path.getsize(full)
                if size_bytes > MAX_TEXT_BYTES:
                    return web.json_response({"error": "File too large"}, status=413)
                with open(full, "r", encoding="utf-8") as f:
                    content = f.read(MAX_TEXT_BYTES + 1)
                truncated = len(content) > MAX_TEXT_BYTES
                content = content[:MAX_TEXT_BYTES]
                return web.json_response({
                    "name": os.path.basename(full),
                    "content": content,
                    "size_bytes": size_bytes,
                    "char_count": len(content),
                    "truncated": truncated,
                })
            except UnicodeDecodeError:
                return web.json_response({"error": "File is not valid UTF-8 text"}, status=422)
            except Exception:
                return web.json_response({"error": "Could not read file"}, status=500)

        @routes.post("/prompt_feeder/file_content")
        async def api_save_file_content(request):
            try:
                body = await request.json()
            except Exception:
                return web.json_response({"error": "Invalid JSON"}, status=400)
            root = normalize_root(body.get("root"))
            rel = str(body.get("path", ""))
            content = body.get("content", "")
            if root != ROOT_PFDATA:
                return web.json_response({"error": "This root is read-only"}, status=403)
            if not rel:
                return web.json_response({"error": "path is required"}, status=400)
            if not isinstance(content, str):
                return web.json_response({"error": "content must be a string"}, status=400)
            if len(content.encode("utf-8")) > MAX_TEXT_BYTES:
                return web.json_response({"error": "Content too large"}, status=413)
            if not rel.lower().endswith(".txt"):
                return web.json_response({"error": "Only .txt files can be saved"}, status=400)
            try:
                full = resolve_safe_file(root, rel)
                if not os.path.isfile(full) or os.path.islink(full):
                    return web.json_response({"error": "Not found"}, status=404)
            except ValueError:
                return web.json_response({"error": "Access denied"}, status=403)
            except Exception:
                return web.json_response({"error": "Bad request"}, status=400)
            try:
                with open(full, "w", encoding="utf-8") as f:
                    f.write(content)
                return web.json_response({"ok": True})
            except Exception:
                return web.json_response({"error": "Could not write file"}, status=500)

        @routes.post("/prompt_feeder/create_file")
        async def api_create_file(request):
            try:
                body = await request.json()
            except Exception:
                return web.json_response({"error": "Invalid JSON"}, status=400)
            root = normalize_root(body.get("root"))
            if root != ROOT_PFDATA:
                return web.json_response({"error": "This root is read-only"}, status=403)

            directory = str(body.get("directory", ""))
            filename = str(body.get("filename", "")).strip()
            content = body.get("content", "")
            if not isinstance(content, str):
                return web.json_response({"error": "content must be a string"}, status=400)
            if len(content.encode("utf-8")) > MAX_TEXT_BYTES:
                return web.json_response({"error": "Content too large"}, status=413)
            if not filename:
                return web.json_response({"error": "filename is required"}, status=400)
            # ディレクトリ区切り・親ディレクトリ参照を含むファイル名は拒否
            if filename in (".", "..") or filename != os.path.basename(filename):
                return web.json_response({"error": "Invalid filename"}, status=400)
            if not filename.lower().endswith(".txt"):
                filename += ".txt"

            try:
                target_dir = resolve_safe_path(root, directory)
            except ValueError:
                return web.json_response({"error": "Access denied"}, status=403)
            if not os.path.isdir(target_dir):
                return web.json_response({"error": "Directory not found"}, status=404)

            full = os.path.join(target_dir, filename)
            real_full = os.path.realpath(full)
            base = os.path.realpath(get_root_base(root))
            if not (real_full == base or real_full.startswith(base + os.sep)):
                return web.json_response({"error": "Access denied"}, status=403)
            if os.path.exists(full):
                return web.json_response({"error": "File already exists"}, status=409)

            try:
                with open(full, "x", encoding="utf-8") as f:
                    f.write(content)
                rel = (directory + "/" + filename) if directory else filename
                return web.json_response({"ok": True, "path": rel, "name": filename})
            except FileExistsError:
                return web.json_response({"error": "File already exists"}, status=409)
            except Exception:
                return web.json_response({"error": "Could not create file"}, status=500)

        @routes.post("/prompt_feeder/rename_file")
        async def api_rename_file(request):
            try:
                body = await request.json()
            except Exception:
                return web.json_response({"error": "Invalid JSON"}, status=400)
            root = normalize_root(body.get("root"))
            if root != ROOT_PFDATA:
                return web.json_response({"error": "This root is read-only"}, status=403)

            rel = str(body.get("path", ""))
            new_name = str(body.get("new_name", "")).strip()
            if not rel:
                return web.json_response({"error": "path is required"}, status=400)
            if not new_name:
                return web.json_response({"error": "new_name is required"}, status=400)
            if new_name in (".", "..") or new_name != os.path.basename(new_name):
                return web.json_response({"error": "Invalid filename"}, status=400)
            if not new_name.lower().endswith(".txt"):
                new_name += ".txt"

            try:
                full = resolve_safe_file(root, rel)
                if not os.path.isfile(full) or os.path.islink(full):
                    return web.json_response({"error": "Not found"}, status=404)
            except ValueError:
                return web.json_response({"error": "Access denied"}, status=403)

            directory = os.path.dirname(rel).replace("\\", "/")
            new_rel = (directory + "/" + new_name) if directory else new_name
            try:
                new_full = resolve_safe_file(root, new_rel)
            except ValueError:
                return web.json_response({"error": "Access denied"}, status=403)

            if os.path.exists(new_full):
                return web.json_response({"error": "File already exists"}, status=409)

            try:
                os.rename(full, new_full)
                return web.json_response({"ok": True, "path": new_rel, "name": new_name})
            except Exception:
                return web.json_response({"error": "Could not rename file"}, status=500)

        @routes.get("/prompt_feeder/preview")
        async def api_preview(request):
            """実行せずに現在の設定でのプレビュー（件数＋指定indexの1行）を返す"""
            q = request.query

            def _to_int(v, default=0):
                try:
                    return max(0, int(v))
                except (TypeError, ValueError):
                    return default

            root = normalize_root(q.get("root"))
            directory = q.get("dir", "")
            mode = q.get("mode", "library")
            filename = q.get("file", "")
            sort_mode = q.get("sort", "ascending")
            if sort_mode not in ("ascending", "descending", "random"):
                sort_mode = "ascending"
            index = _to_int(q.get("index", "0"))
            start_index = _to_int(q.get("start", "0"))
            end_index = _to_int(q.get("end", "0"))
            seed = _to_int(q.get("seed", "0"))
            use_selection = str(q.get("use_selection", "true")).lower() in ("1", "true", "yes")
            selected_files = q.get("selected_files", "[]")
            try:
                if mode == "single_file":
                    prompts = _collect_single_file_prompts(
                        root, directory, filename, sort_mode, start_index, end_index, seed)
                else:
                    prompts = _collect_library_prompts(
                        root, directory, sort_mode, start_index, end_index,
                        seed, use_selection, selected_files)
            except (FileNotFoundError, ValueError) as e:
                return web.json_response({"total": 0, "index": 0, "prompt": "", "error": str(e)})
            except Exception:
                return web.json_response({"error": "Could not read prompts"}, status=500)
            if not prompts:
                return web.json_response({"total": 0, "index": 0, "prompt": ""})
            i = min(index, len(prompts) - 1)
            return web.json_response({
                "total": len(prompts),
                "index": i,
                "prompt": prompts[i][:500],
            })

        @routes.get("/prompt_feeder/presets")
        async def api_get_presets(request):
            return web.json_response(_load_presets())

        @routes.post("/prompt_feeder/presets")
        async def api_save_preset(request):
            try:
                body = await request.json()
            except Exception:
                return web.json_response({"error": "Invalid JSON"}, status=400)
            name = (body.get("name") or "").strip()
            if not name:
                return web.json_response({"error": "name is required"}, status=400)
            if len(name) > 256:
                return web.json_response({"error": "name too long"}, status=400)
            raw_files = body.get("selected_files", [])
            if not isinstance(raw_files, list) or len(raw_files) > 10000:
                return web.json_response({"error": "selected_files must be an array of at most 10000 items"}, status=400)
            sel_files = [f for f in raw_files if isinstance(f, str)]
            directory = str(body.get("directory", ""))[:1024]
            root = normalize_root(body.get("root"))
            presets = _load_presets()
            presets[name] = {
                "root": root,
                "directory": directory,
                "selected_files": sel_files,
            }
            _save_presets(presets)
            return web.json_response({"ok": True})

        @routes.delete("/prompt_feeder/presets/{name}")
        async def api_delete_preset(request):
            name = request.match_info["name"]
            presets = _load_presets()
            if name in presets:
                del presets[name]
                _save_presets(presets)
            return web.json_response({"ok": True})

        @routes.get("/prompt_feeder/external_paths")
        async def api_get_external_paths(request):
            return web.json_response(_load_external_paths())

        @routes.post("/prompt_feeder/external_paths")
        async def api_add_external_path(request):
            try:
                body = await request.json()
            except Exception:
                return web.json_response({"error": "Invalid JSON"}, status=400)

            label = (body.get("label") or "").strip()
            raw_path = (body.get("path") or "").strip()
            if not label:
                return web.json_response({"error": "label is required"}, status=400)
            if len(label) > 128:
                return web.json_response({"error": "label too long"}, status=400)
            if label == ROOT_PFDATA:
                return web.json_response({"error": "This label is reserved"}, status=400)
            if not raw_path:
                return web.json_response({"error": "path is required"}, status=400)

            comfy_base = os.path.realpath(folder_paths.base_path)
            # 絶対パス・ComfyUIフォルダからの相対パスのどちらでも受け付ける
            candidate = raw_path if os.path.isabs(raw_path) else os.path.join(comfy_base, raw_path)
            real_candidate = os.path.realpath(candidate)
            if not (real_candidate == comfy_base or real_candidate.startswith(comfy_base + os.sep)):
                return web.json_response({"error": "Path must be inside the ComfyUI folder"}, status=403)
            if not os.path.isdir(real_candidate):
                return web.json_response({"error": "Directory not found"}, status=404)

            rel = os.path.relpath(real_candidate, comfy_base).replace("\\", "/")
            paths = _load_external_paths()
            paths[label] = rel
            _save_external_paths(paths)
            return web.json_response({"ok": True, "label": label, "path": rel})

        @routes.delete("/prompt_feeder/external_paths/{label}")
        async def api_delete_external_path(request):
            label = request.match_info["label"]
            paths = _load_external_paths()
            if label in paths:
                del paths[label]
                _save_external_paths(paths)
            return web.json_response({"ok": True})

    except Exception as e:
        print(f"[PromptFeeder] Failed to register routes: {e}")


_setup_routes()


# ----------------------------------------------------------------
# ノード定義
# ----------------------------------------------------------------
class PromptFeeder:
    @classmethod
    def INPUT_TYPES(s):
        root_choices = [ROOT_PFDATA] + sorted(_load_external_paths().keys())
        return {
            "required": {
                "mode": (["edit", "library", "single_file"],),
                "text": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "tooltip": "One prompt per line. Empty lines are skipped."
                }),
                "source_root": (root_choices, {
                    "default": ROOT_PFDATA,
                    "tooltip": "Data source. Registered external paths (via the library's ⚙ Settings) "
                               "are read-only (for reusing existing prompt/wildcard .txt files from other node packs)."
                }),
                "directory": ("STRING", {
                    "default": "",
                    "tooltip": "Subfolder name within the selected source_root. Leave empty to use its root directory."
                }),
                "sort_mode": (["ascending", "descending", "random"],),
                "index": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "start_index": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "end_index": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "use_selection": ("BOOLEAN", {"default": True}),
                "selected_files": ("STRING", {"default": "[]"}),
                # 既存ワークフローの widgets_values（配列・位置ベース）とのズレを避けるため、
                # 新規ウィジェットは必ず末尾に追加する
                "file": ("STRING", {
                    "default": "",
                    "tooltip": "Filename (e.g. hero.txt) within the directory above. Used in single_file mode; "
                               "start_index/end_index then select a line range within this file."
                }),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "load_prompt"
    CATEGORY = "text"
    # send_sync を使用するため常に実行が必要
    OUTPUT_NODE = True

    def load_prompt(self, mode, text, source_root, directory, sort_mode, index, start_index,
                    end_index, seed, use_selection=True, unique_id=None, selected_files="[]", file=""):
        from server import PromptServer

        prompts = []

        if mode == "edit":
            # 改行区切り・空行スキップ
            lines = (text or "").splitlines()
            prompts = [line.strip() for line in lines if line.strip()]
            if not prompts:
                raise ValueError("No prompts found: enter at least one non-empty line in edit mode")
        elif mode == "single_file":
            root = normalize_root(source_root)
            prompts = _collect_single_file_prompts(
                root, directory, file, sort_mode, start_index, end_index, seed)
        else:
            # パスの解決と検証
            root = normalize_root(source_root)
            prompts = _collect_library_prompts(
                root, directory, sort_mode, start_index, end_index,
                seed, use_selection, selected_files)

        total_in_range = len(prompts)
        current = prompts[min(index, total_in_range - 1)]

        next_index = index + 1
        has_next = next_index < total_in_range

        _debug(f"execute: mode={mode} index={index}/{total_in_range} has_next={has_next} node={unique_id}")

        preview_text = current[:500]

        PromptServer.instance.send_sync("prompt_feeder_sync", {
            "node_id": unique_id,
            "next_index": next_index if has_next else 0,
            "has_next": has_next,
            "preview_text": preview_text,
            "mode": mode,
            "index": min(index, total_in_range - 1),
            "total": total_in_range,
        })

        return (current,)


NODE_CLASS_MAPPINGS = {
    "PromptFeeder": PromptFeeder
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptFeeder": "Prompt Feeder"
}
