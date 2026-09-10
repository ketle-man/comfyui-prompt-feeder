[English](README.md) | [日本語](README.ja.md) | 中文

# ComfyUI Prompt Feeder

一个逐条发送文件夹内文本提示词的 ComfyUI 自定义节点。支持两种输入方式：直接在节点上输入，或从内置库中选择 `.txt` 文件。

## Screenshots

<table>
<tr>
<td align="center" width="50%">
<img src="docs/1_node_edit.png" width="320" alt="edit mode"><br>
① <code>edit</code> 模式：直接在节点上输入提示词
</td>
<td align="center" width="50%">
<img src="docs/2_node_library.png" width="320" alt="library mode"><br>
② <code>library</code> 模式：逐条发送文件夹内的 <code>.txt</code> 内容
</td>
</tr>
<tr>
<td align="center" width="50%">
<img src="docs/3_library.png" width="320" alt="Prompt Library"><br>
③ Prompt Library：三栏式文件夹/文件浏览与编辑
</td>
<td align="center" width="50%">
<img src="docs/4_external_paths.png" width="320" alt="External Paths"><br>
④ External Paths：注册其他节点包的 <code>.txt</code> 数据文件夹以复用
</td>
</tr>
</table>

## Features

- **两种输入模式**：
  - `edit`：直接在节点的文本框中输入。一行＝一条提示词（自动跳过空行）。
  - `library`：将库中选中的 `.txt` 文件按行拆分，逐行作为提示词循环输出，处理方式与 edit 模式相同。

- **Playback Controls（播放控制）**：
  - ▶ **Run**：重置索引并开始自动循环。
  - ⏹ **Stop**：停止自动循环。
  - 🔗 **Sel ON/OFF**：切换仅使用库中选中的文件，还是使用文件夹内的全部文件（仅 library 模式有效）。
  - 📂 **Lib**：打开 Prompt Library（仅 library 模式有效）。

- **Prompt Library（三栏面板）**：
  - 左：数据源切换＋文件夹树／中：`.txt` 列表（附首行预览）／右：内容预览＋编辑。
  - 右栏的 **EDIT** 按钮可解锁编辑→编辑→**SAVE** 写回文件。
  - 右栏文件名旁的 **✎** 按钮可重命名文件（Enter 确认／Esc 取消，仅限 `prompt-feeder-data`）。
  - 中栏的 **＋ New** 按钮可创建新的 `.txt` 文件，并直接在同一个弹窗编辑器中填写并保存内容（仅限 `prompt-feeder-data`）。
  - 支持预设的保存、加载与删除，以及全选／取消全选。

- **数据源（注册外部路径）**：
  - 通过库左上角的 **⚙** 按钮，可为其他通配符/提示词类自定义节点包已有的 `.txt` 数据文件夹注册一个「显示名称」，逐个添加（**支持多个**）。
  - 注册的路径必须位于 ComfyUI 目录内（例如 `custom_nodes/ComfyUI-Impact-Pack/wildcards`、`user/default/other-node/data`）。可以输入绝对路径，也可以输入相对于 ComfyUI 文件夹的相对路径。
  - 注册后的路径会作为 `source_root` 的选项（🧩 显示名称）同时出现在节点和库中，并且文件夹树只会显示该文件夹范围内的内容——相比扫描整个 `custom_nodes`，不会再出现无关文件夹。
  - 出于数据保护考虑，已注册的外部路径为**只读**（EDIT/SAVE、＋ New、✎ 重命名均被禁用）。写入操作始终仅限于 `prompt-feeder-data`。
  - 文件夹树会自动排除 `__pycache__`、`.git`、`node_modules`、`venv` 等隐藏或无关文件夹。
  - 已注册的外部路径信息保存在 `ComfyUI/user/default/prompt-feeder-external-paths.json` 中。

- **预览区**：
  - 无需运行工作流即可显示当前设置对应的输出内容（空闲预览），并随 `index` 等参数的变化自动更新。
  - 右上角显示 `当前位置 / 总数` 计数器（例如 `2 / 6`）。
  - 当前模式下不适用的控件会呈半透明的禁用状态显示。

- **Flexible Sorting & Range（library 模式）**：
  - 排序方式：`ascending`（自然顺序）／`descending`／`random`（可通过 `seed` 复现）。
  - 通过 `start_index` / `end_index` 控制范围（按文件为单位，详见下文）。

- **语言**：
  - 节点与提示词库 UI **默认显示英文**（不会跟随浏览器语言自动切换）。
  - 如需使用 日本語 / 中文（简体），请打开 Prompt Library，使用右上角的语言选择器切换。选择会保存在当前浏览器中，提示词库即时生效（节点上的按钮文本在页面重载后生效）。
  - 节点槽位（输入/输出/提示）遵循 ComfyUI 官方 locale（`Comfy > Locale`），通过 `locales/` 下的 `en`/`ja`/`zh` nodeDefs 翻译提供（参见 Comfy-Org/ComfyUI#6558）。

## Installation（安装）

1. 将本文件夹复制到 ComfyUI 的 `custom_nodes` 目录下（文件夹名称请保持为 `comfyui-prompt-feeder`）。
2. 启动（或重启）ComfyUI，`Prompt Feeder` 节点会出现在 `text` 分类下。

## Prompt Placement（提示词文件放置）

请将 `.txt` 文件放置在以下目录中：

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

- 在节点的 `directory` 字段中输入相对于 `prompt-feeder-data` 的路径；留空则使用根目录。
- 每个 `.txt` 文件须为 UTF-8 编码，且不超过 100KB。一行即为一条提示词（自动跳过空行）。
- **Security（安全性）**：禁止访问每个数据源（`prompt-feeder-data` 及已注册的外部路径）范围之外的内容（路径穿越防护），并排除符号链接。注册外部路径本身也仅限于 ComfyUI 文件夹内部，无法注册该范围之外的位置。已注册的外部路径为只读，编辑（EDIT/SAVE）、新建（＋ New）、重命名（✎）仅能在 `prompt-feeder-data` 中进行。

## Parameters（参数）

| Parameter | Description |
| --- | --- |
| `mode` | `edit`（直接输入） / `library`（选择文件） |
| `text` | 直接输入框（多行）。仅在 edit 模式下有效 |
| `source_root` | 数据源：`prompt-feeder-data`（可读写） / 通过 ⚙ 注册的外部路径（只读）。仅在 library 模式下有效 |
| `directory` | `source_root` 下的子文件夹名称。留空则使用其根目录。仅在 library 模式下有效 |
| `sort_mode` | `ascending`（自然顺序） / `descending` / `random`。仅在 library 模式下有效 |
| `index` | 当前输出位置，Run 时自动更新 |
| `start_index` | 读取范围的起始位置（按文件为单位）。仅在 library 模式下有效 |
| `end_index` | 读取范围的结束位置（0＝到末尾，按文件为单位）。仅在 library 模式下有效 |
| `seed` | 用于复现随机排序，仅在 `sort_mode=random` 时有效 |
| `use_selection` | 是否使用库中的文件选择（通过 Sel 按钮切换）。仅在 library 模式下有效 |

输出：1 个 `STRING`（可连接到 `CLIP Text Encode` 等节点）。

## 按模式区分的控件可用性

| 项目 | Edit 模式 | Library 模式 |
| --- | --- | --- |
| `mode` | ✅ 切换本体 | ✅ |
| `text` | ✅ 提示词来源 | ❌ 被忽略（仍会显示） |
| `source_root` | ❌ 被忽略 | ✅ |
| `directory` | ❌ 被忽略 | ✅ |
| `sort_mode` | ❌ 被忽略（按输入行顺序固定） | ✅ |
| `index` | ✅ | ✅ |
| `start_index` / `end_index` | ❌ 被忽略 | ⚠️ 有效，但范围是**按文件为单位**，而非按行 |
| `seed` | ❌ 被忽略 | ⚠️ 仅在 `sort_mode=random` 时有意义 |
| `use_selection` / `Sel` 按钮 | ❌ 无意义（按钮已禁用） | ✅ |
| `selected_files` | ❌ 被忽略 | ✅ |
| `Lib` 按钮 | ❌ 已禁用 | ✅ |
| `control after generate` | ❌ 因 `seed` 本身无意义而随之无意义 | ⚠️ 仅在 random 时有意义 |
| 预览＋计数器 | ✅ | ✅ |

不适用的控件会以半透明状态显示（值隐藏且不可操作）。其数值会被保留，因此切换回原模式后设置依然有效。

## Notes（注意事项）

- **注意**：`start_index` / `end_index` 是**按文件为单位**的范围设置，而非按行。例如：2 个文件、每个 3 行的情况下，设置 `start_index=1` 表示「从第 2 个文件开始」，即整体的第 4 行开始输出。可通过预览区的计数器（`x / N`）确认总条数。
- 文件名中的数字（例如 `a1.txt`、`a10.txt`）会按自然顺序正确排序。
- 在库中选择后按下 **Apply to Node**，会将文件夹与选择结果应用到节点，并自动将 `mode` 切换为 `library`。
- 同一工作流中可独立运行多个 Prompt Feeder 节点。
- 若循环过程中发生队列错误，Run 按钮会自动重新启用。
- 支持的格式：仅限 `.txt`。
- 刚注册新的外部路径后，节点自身的 `source_root` 下拉选项列表可能要在页面重新加载后才会反映（通过库的 **Apply to Node** 应用则无需重新加载）。

## License

[MIT](LICENSE)
