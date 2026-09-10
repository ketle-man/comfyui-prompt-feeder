English | [日本語](README.ja.md) | [中文](README.zh.md)

# ComfyUI Prompt Feeder

A ComfyUI custom node that feeds text prompts from a folder one at a time. Supports two input methods: typing directly on the node, or selecting `.txt` files from a built-in library.

## Screenshots

<table>
<tr>
<td align="center" width="50%">
<img src="docs/1_node_edit.png" width="320" alt="edit mode"><br>
① <code>edit</code> mode: type prompts directly on the node
</td>
<td align="center" width="50%">
<img src="docs/2_node_library.png" width="320" alt="library mode"><br>
② <code>library</code> mode: feed <code>.txt</code> files from a folder one at a time
</td>
</tr>
<tr>
<td align="center" width="50%">
<img src="docs/3_library.png" width="320" alt="Prompt Library"><br>
③ Prompt Library: a 3-pane picker for browsing/editing folders and files
</td>
<td align="center" width="50%">
<img src="docs/4_external_paths.png" width="320" alt="External Paths"><br>
④ External Paths: register other node packs' <code>.txt</code> data folders for reuse
</td>
</tr>
</table>

## Features

- **Two input modes**:
  - `edit`: type directly into the text area on the node. One prompt per line (empty lines are skipped).
  - `library`: reads the selected `.txt` files from the library, splits them into lines, and loops through them exactly like edit mode.

- **Playback Controls**:
  - ▶ **Run**: resets the index and starts the auto-loop.
  - ⏹ **Stop**: stops the auto-loop.
  - 🔗 **Sel ON/OFF**: toggles between using only the files selected in the library, or every file in the folder (library mode only).
  - 📂 **Lib**: opens the Prompt Library (library mode only).

- **Prompt Library (3-pane picker)**:
  - Left: data source switcher + folder tree / Middle: `.txt` file list (with a first-line preview) / Right: content preview + editor.
  - The **EDIT** button unlocks editing → edit → **SAVE** writes the changes back to the file.
  - The **✎** button next to the file name in the right pane renames the file (Enter to confirm, Esc to cancel; `prompt-feeder-data` only).
  - The **＋ New** button in the middle pane creates a new `.txt` file and opens it directly in the same in-modal editor to write and save its content (`prompt-feeder-data` only).
  - Presets can be saved, loaded, and deleted. Select All / Deselect All are also available.

- **Data sources (registering external paths)**:
  - The **⚙** button at the top-left of the library lets you register existing `.txt` data folders from other wildcard/prompt custom node packs, each under its own label (**multiple entries supported**).
  - Registered paths must stay inside the ComfyUI directory (e.g. `custom_nodes/ComfyUI-Impact-Pack/wildcards`, `user/default/other-node/data`). You can enter either an absolute path or a path relative to the ComfyUI folder.
  - Each registered path appears as a `source_root` choice (🧩 label) on both the node and the library, and the folder tree is scoped to just that folder — so, unlike scanning the whole `custom_nodes` tree, unrelated folders won't show up.
  - Registered external paths are **read-only** for data safety (EDIT/SAVE, ＋ New, and ✎ rename are all disabled there). Writing is always limited to `prompt-feeder-data`.
  - Hidden/irrelevant folders such as `__pycache__`, `.git`, `node_modules`, and `venv` are automatically excluded from the folder tree.
  - Registered external paths are stored in `ComfyUI/user/default/prompt-feeder-external-paths.json`.

- **Preview panel**:
  - Shows the current configuration's output even without running the workflow (idle preview). Updates automatically when `index` and related widgets change.
  - Shows a `current position / total count` counter in the top-right corner (e.g. `2 / 6`).
  - Widgets that are irrelevant to the current mode are dimmed (semi-transparent and disabled).

- **Flexible Sorting & Range** (library mode):
  - Sort modes: `ascending` (natural sort) / `descending` / `random` (reproducible via `seed`).
  - Range control via `start_index` / `end_index` (per-file, see below).

- **Language**:
  - The node and library UI is **English by default** (no browser-language auto-switching).
  - To use 日本語 / 中文（简体）, open the Prompt Library and switch the language selector in the header (top-right). Your choice is saved per browser and applied immediately to the library (node buttons pick it up after a page reload).
  - Node slots (inputs/outputs/tooltips) follow the official ComfyUI locale (`Comfy > Locale`) via `locales/` (`en`/`ja`/`zh` nodeDefs translations, see Comfy-Org/ComfyUI#6558).

## Installation

1. Copy this folder into ComfyUI's `custom_nodes` directory (keep the folder name as `comfyui-prompt-feeder`).
2. Start (or restart) ComfyUI. The `Prompt Feeder` node will appear in the `text` category.

## Prompt Placement

Place your `.txt` files under the following directory:

```text
ComfyUI/
└── user/
    └── default/
        └── prompt-feeder-data/      ← root folder
            ├── character/           ← subfolders supported
            │   ├── eyes.txt
            │   └── hair.txt
            └── sample.txt
```

- Enter a path relative to `prompt-feeder-data` in the node's `directory` field. Leave it empty to use the root folder.
- Each `.txt` file must be UTF-8 and up to 100KB. One line is treated as one prompt (empty lines are skipped).
- **Security**: access outside each data source (`prompt-feeder-data` and any registered external paths) is blocked (path traversal protection). Symlinks are excluded. Registering an external path itself is also limited to locations inside the ComfyUI folder — nothing outside it can be registered. Registered external paths are read-only; editing (EDIT/SAVE), creating (＋ New), and renaming (✎) are only possible in `prompt-feeder-data`.

## Parameters

| Parameter | Description |
| --- | --- |
| `mode` | `edit` (type directly) / `library` (pick files) |
| `text` | Direct-entry field (multi-line). Only used in edit mode |
| `source_root` | Data source: `prompt-feeder-data` (read/write) / an external path registered via ⚙ (read-only). Only used in library mode |
| `directory` | Subfolder under `source_root`. Leave empty to use its root. Only used in library mode |
| `sort_mode` | `ascending` (natural sort) / `descending` / `random`. Only used in library mode |
| `index` | The current output position. Updated automatically by Run |
| `start_index` | Start of the read range (per file). Only used in library mode |
| `end_index` | End of the read range (0 = to the end, per file). Only used in library mode |
| `seed` | Used to reproduce random sorting. Only relevant when `sort_mode=random` |
| `use_selection` | Whether to use the library's file selection (toggled by the Sel button). Only used in library mode |

Output: one `STRING` (connect it to `CLIP Text Encode`, etc.).

## Widget availability by mode

| Item | Edit mode | Library mode |
| --- | --- | --- |
| `mode` | ✅ the switch itself | ✅ |
| `text` | ✅ prompt source | ❌ ignored (still shown) |
| `source_root` | ❌ ignored | ✅ |
| `directory` | ❌ ignored | ✅ |
| `sort_mode` | ❌ ignored (input line order is fixed) | ✅ |
| `index` | ✅ | ✅ |
| `start_index` / `end_index` | ❌ ignored | ⚠️ active, but the range is **per file**, not per line |
| `seed` | ❌ ignored | ⚠️ only relevant when `sort_mode=random` |
| `use_selection` / `Sel` button | ❌ meaningless (button is disabled) | ✅ |
| `selected_files` | ❌ ignored | ✅ |
| `Lib` button | ❌ disabled | ✅ |
| `control after generate` | ❌ meaningless, since `seed` itself is meaningless | ⚠️ only meaningful with random |
| Preview + counter | ✅ | ✅ |

Widgets that don't apply are dimmed (semi-transparent, value hidden, and disabled). Their values are preserved, so switching modes back keeps your settings intact.

## Notes

- **Note**: `start_index` / `end_index` define a range **per file**, not per line. Example: with 2 files of 3 lines each, `start_index=1` means "from the 2nd file onward" — i.e., from the overall 4th line. Check the preview panel's counter (`x / N`) for the total count.
- Numbers in file names (e.g. `a1.txt`, `a10.txt`) are sorted correctly in natural order.
- After selecting in the library, pressing **Apply to Node** applies the folder and selection to the node and automatically switches `mode` to `library`.
- Multiple Prompt Feeder nodes can run independently in the same workflow.
- If a queue error occurs mid-loop, the Run button is automatically re-enabled.
- Supported format: `.txt` only.
- Right after registering a new external path, it may not show up in the node's own `source_root` dropdown until the page is reloaded (applying it via the library's **Apply to Node** does not require a reload).

## License

[MIT](LICENSE)
