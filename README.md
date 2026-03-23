<div align="center">
  <h1>CondaTool</h1>
  <p><strong>A modern desktop GUI for environment management</strong></p>
  <p>基于 Tauri + React + Python，支持独立运行时打包（目标产物：CondaTool.exe）。</p>
  <img src="./asset/img.png" alt="CondaTool Preview" width="88%" />
</div>

---

CondaTool 是一个基于 [Tauri](https://tauri.app/) + React + Python 的桌面 GUI 工具，提供环境管理、包查看、导入导出和日志追踪能力。

## ✨ 当前功能

- 环境管理：创建、删除、克隆、重命名
- 环境导入/导出：支持 `yml` / `txt`
- 包列表与搜索
- 中英文界面切换
- 浅色/深色/跟随系统主题
- 实时日志输出
- 缺失运行时错误提示（runtime missing / backend startup failed / package manager init failed）

## 🛠️ 技术栈

- 桌面框架：Tauri v2
- 前端：React + TypeScript + Vite
- 后端：Python（打包为 `backend.exe`）
- 包管理器：内置 `micromamba.exe`
- 桥接层：Rust（Tauri command + 子进程管道）

## 📁 项目结构

- `condatools/src/`：前端 UI
- `condatools/src-tauri/`：Tauri/Rust
- `condatools/backend/`：Python 后端逻辑
- `condatools/src-tauri/resources/runtime/`：内置运行时二进制目录
- `condatools/scripts/prepare_runtime.ps1`：运行时检查脚本

## 🚀 本地开发

```bash
cd condatools
npm install
npm run tauri dev
```

## 🧱 独立打包（目标：CondaTool.exe）

### 1) 先准备运行时文件

在 `condatools/src-tauri/resources/runtime/` 下准备：

- `backend.exe`
- `micromamba.exe`

你可以用脚本生成并检查：

```powershell
# 在仓库根目录执行
.\condatools\backend\build_backend.ps1
.\condatools\scripts\prepare_runtime.ps1
```

### 2) 构建桌面安装包

```powershell
cd .\condatools
npm run tauri build
```

构建完成后，Windows 产物主程序名为：

- `CondaTool.exe`

## 📦 验收建议（Windows 干净环境）

- 无 Python / 无 Conda 前提下安装并启动成功
- `probe` 成功
- 可创建环境、查看包、导入导出
- 日志输出正常

## 🚧 待办事项

- [ ] UI 优化
- [ ] 包安装与卸载（按环境执行）
- [ ] Conda 源管理（查看/新增/删除/优先级调整）
- [ ] 常用源模板（一键切换官方源/社区源）
- [ ] Jupyter Kernel 管理
- [ ] 更完善的错误分级与引导
