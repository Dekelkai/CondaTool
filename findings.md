# 发现与决策

## 需求
- 分析 CondaTool 项目并执行上一轮制定的修复计划。
- 优先复现和修复高优先级真实 bug。
- 使用持久化规划文件记录过程。
- 继续优化性能，启动桌面应用做手动测试，并执行打包测试。
- 基于现有能力整理一份功能规划方案，明确必要功能和实施顺序。
- 开始实现诊断页，优先提供当前包管理器、环境、配置和渠道信息。
- 实现源配置，完成本地测试，更新版本与文档，并推送到 GitHub 发布最新版本。
- 接入签名流程，降低另一台机器安装后 runtime 被拦截的概率。
- 修复其他机器上点击执行按钮时弹出黑色命令行窗口的问题。

## 研究发现
- 项目主体位于 `condatools/`，前端使用 React + TypeScript，桌面壳使用 Tauri 2，命令后端使用 Python。
- 当前没有发现现成的测试脚本或 CI 工作流。
- `App.tsx` 中的命令调度依赖 `running` state，存在并发命令和事件乱序风险。
- `pkg-list` 的返回值没有与当前选中环境进行关联校验。
- 删除和重命名环境后，前端选中状态不会根据真实结果同步更新。
- 通过在前端引入串行命令队列并等待 `backend://terminated`，可以让 `probe -> env-list -> pkg-list` 真正按顺序执行。
- 通过记录目标环境名并在 `env-list` 结果返回后重新对齐选中路径，可以修复重命名后的过期选中状态。
- `src-tauri/resources/runtime/` 中实际存在 `backend.exe` 与 `micromamba.exe`，可以直接执行本地后端冒烟测试。
- 本地执行 `backend.exe --package-manager .\micromamba.exe env-list` 成功，但会对 `C:\Users\txkkk\AppData\Roaming\mamba` 输出 `python executable not found`，随后把该环境的 `python_version` 标记为 `N/A`。
- `App.tsx` 当前对每一条日志输出都立即 `setLogs`，在长时间安装/导入环境时会造成高频重渲染。
- `filteredPackages` 直接依赖实时 `searchQuery`，大包列表下会在每次输入时同步过滤整个数组。
- 将日志写入改成批量冲刷后，能显著减少长命令期间的 React 重渲染次数，同时保留日志实时感。
- 将包搜索切换为 `useDeferredValue` 后，大环境包列表输入时更容易保持主线程响应。
- 将后端 `env-list` 的 Python 版本探测从“每个环境一个线程”改为最多 8 个 worker，可避免环境多时的瞬时线程膨胀。
- 实测 `env-list` 当前约耗时 `23.8s`，主要卡在多个环境的 `python --version` 超时。
- 实测 `pkg-list --prefix E:\software\Miniconda` 超过 `124s` 仍未完成，当前最慢路径是 `micromamba list --json`。
- Conda 环境的 `conda-meta/*.json` 已包含 `name`、`version`、`build`、`channel` 信息，也能直接找到 `python-*.json`，可作为更快的数据源。
- 修复后，`env-list` 通过 runtime 实测约 `0.83s`，`pkg-list --prefix E:\software\Miniconda` 约 `0.79s`。
- 当前“运行很慢”的根因主要在后端数据获取策略，不是前端渲染本身。
- `micromamba env list --json` 会返回 `C:\Users\txkkk\AppData\Roaming\mamba`，这是 micromamba 自己的 root prefix，不是你当前 `conda env list` 里的 `base` 环境。
- `micromamba info --json` 里没有 `conda info --json` 风格的 `root_prefix` / `conda_version` 字段；如果直接透传给前端，会把 base 识别逻辑搞错。
- 通过在后端把 `micromamba info` 归一化为 `{ conda_version, python_version, root_prefix }`，并过滤 `env-list` 里不存在的路径，可以让界面结果与本地 `conda env list` 对齐。
- 当前项目功能适合作为“环境级管理 MVP”，但还不适合作为完整的 Conda 日常工作台。
- 最缺的不是 UI 小修补，而是包管理闭环、源配置、代理配置和诊断能力。
- 这些能力已经在 README 待办中部分体现，但还没有结构化的阶段路线文档。
- 第一版诊断页最需要的是统一后的后端诊断数据，而不是先拆独立路由页。
- `micromamba info --json` 中没有直接可供前端使用的诊断结构，需要后端整理成稳定 JSON。
- `micromamba config list --json` 与 `conda config --show --json` 返回结构不同，但都能映射到 `channels/default_channels/custom_channels/channel_priority` 这一统一模型。
- `conda config --file ... --set custom_channels.<name> <url>` 可稳定写入映射；`micromamba config set` 对这类嵌套 key 支持不足。
- `micromamba config sources` 表明当前实际只读取 `C:\Users\txkkk\.condarc`，因此源配置第一版应以用户级 `.condarc` 为唯一写入目标。
- 源配置读取若直接依赖 `config list/show`，会被 `conda`/`micromamba` 的隐式扩展干扰；第一版改为直接解析 `~/.condarc` 中的受管片段更稳定。
- 源配置第一版最终范围收敛为：查看当前配置、查看配置文件路径、切换官方默认源与清华镜像源。
- 当前 `backend.exe` 与 `micromamba.exe` 都是 `NotSigned`，这会明显增加安装后被安全软件隔离的概率。
- 仓库内目前没有发现现成的签名证书、Trusted Signing 配置或 `signtool` 脚本。
- 黑框修复需要作为独立补丁版本发布，否则用户仍会拿到旧版 `0.2.1` 安装包。
- 黑框问题与签名无关，主要来自 Windows 下控制台子进程默认会弹窗。
- 当前 Rust 启动 `backend.exe` 时没有设置 `CREATE_NO_WINDOW`，Python 后端内部启动 `micromamba/conda/python.exe` 时也没有设置隐藏窗口参数。

## 技术决策
| 决策 | 理由 |
|------|------|
| 通过请求标识和命令状态引用修复前端竞态 | 最小化侵入，同时覆盖多条故障链 |
| 保持现有 Tauri 事件协议，尽量不改 Rust/Python | 当前问题主要集中在前端状态流，修改面更小 |
| 使用 `useRef` 保存最新 locale、选中环境和活动命令 | 避免监听器闭包读取首帧旧状态 |
| 优先做日志批量刷新和延迟搜索 | 能以最小代价改善桌面端主观流畅度 |
| 对不存在 Python 的环境目录直接返回 `N/A` | 避免无意义 stderr 噪音和异常开销 |
| 优先读取 `conda-meta` 获取 Python 版本与包列表 | 避免启动多个 Python 解释器和执行超慢的 `micromamba list` |
| 保留包管理器回退路径 | 当环境缺少 `conda-meta` 或元数据损坏时仍能工作 |
| 后端负责屏蔽 `conda` 与 `micromamba` 的语义差异 | 前端只消费统一结构，避免再次出现假环境 |
| 功能规划优先围绕“高频真实场景闭环”展开 | 比继续追加零散小功能更能提升产品完整度 |
| 诊断页优先展示只读信息 | 先把“看清配置”做出来，再继续做“修改配置” |
| 源配置写入优先使用 `conda config --file ~/.condarc` | 这样既能影响 conda，也能被 micromamba 读取，兼容性最稳 |
| 源配置最终改为直接维护 `.condarc` 的受管片段 | 避免 CLI 不同行为导致展示与写入不一致 |
| 签名流程优先支持本地 PFX + signtool | 这是最直接、最常见、最容易在现有发布流程中落地的方案 |
| 黑框修复优先使用 Windows `CREATE_NO_WINDOW` | 比修改 PyInstaller 为 `--noconsole` 风险更低，不会破坏现有 stdout/stderr IPC |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| 项目根目录不存在规划文件 | 已在项目根创建并初始化 |
| 目前缺少自动化测试入口 | 通过构建验证和针对性行为检查补足本轮验证 |
| 监听器回调读取的是初始渲染闭包 | 改为从 ref 读取最新状态 |
| `env-list` 对无 Python 的 mamba 根目录输出 stderr 警告 | 当前命令仍成功，先记录为观察结果，后续可视需要降噪 |
| `env-list` 旧版 `backend.exe` 仍会输出旧行为 | 重新执行 `build_backend.ps1` 并替换 runtime 中的二进制 |
| 界面里多出一个 `mamba` 环境而本地 `conda env list` 没有 | 对比数据源后，确认是 `micromamba` root prefix 被误显示；已在后端过滤并归一化 |

## 资源
- `condatools/src/App.tsx`
- `condatools/src-tauri/src/main.rs`
- `condatools/backend/CondaTool_conda/commands.py`

## 视觉/浏览器发现
- 本轮未使用浏览器或多模态查看。
