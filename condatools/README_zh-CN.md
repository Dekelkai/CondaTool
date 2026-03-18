# CondaTools 🚀

[English Version](README.md)

CondaTools 是一款快速、轻量且现代化的桌面 GUI 工具，用于管理 Conda 环境。基于 **Tauri**、**React (Vite)** 和 **Python** 构建，它允许您轻松查看、创建、克隆、重命名和导出您的 Conda 环境，全过程无需接触繁琐的命令行。

![Tech Stack](https://img.shields.io/badge/Tauri-2.x-orange?logo=tauri)
![Tech Stack](https://img.shields.io/badge/React-19-blue?logo=react)
![Tech Stack](https://img.shields.io/badge/Python-3-green?logo=python)

## ✨ 主要功能

- **自动化探测**：启动即自动寻找您本地安装的 Conda 根路径及 Base 环境。
- **环境管理**：通过直观的用户界面创建、删除、克隆和重命名 Conda 环境。
- **依赖包预览**：点击任意环境，右侧即可搜索并查看该环境下所有已安装包的名称、版本与渠道 (Channel)。
- **导入/导出**：支持把环境依赖导出为 `yml` 或 `txt` 文件（可选是否剥除具体的 Build 编号以增加跨平台兼容性），也支持从配置文件导入创建新环境。
- **实时控制台日志**：内置日志界面，实时反馈后台正在执行的精确 Conda 命令和输出结果，报错一目了然。

## 🛠️ 项目架构

该应用复用了 Tauri 强大的 IPC（进程间通信）机制，桥接了 React 界面和模块化的 Python 后端：
- **前端 (`src/`)**：React + TypeScript + Vite，负责展示 UI 并发送指令。
- **Tauri 后端 (`src-tauri/`)**：Rust 层，作为系统级桥梁，负责开启子进程调用 Python。
- **Python 脚本 (`backend/`)**：模块化的 CLI 工具，直接通过命令行调度本地的 `conda` 并格式化输出为 JSON。

## 🚀 启动开发环境

1. **环境准备**：请确保您的电脑上已经安装好了 [Node.js](https://nodejs.org/)、[Rust](https://rustup.rs/) 和 [Conda/Miniconda](https://docs.conda.io/)。
2. **安装依赖**：
   ```bash
   npm install
   ```
3. **运行开发服务器**：
   ```bash
   npm run tauri dev
   ```
   这条命令会同时启动 Vite 前端热更新和 Tauri 原生应用。您对 React 或 Python 代码的任何修改都可以直接热加载或在下次操作时生效。

## 📦 打包与分发说明

如果您想要将该应用程序打包成独立的桌面安装包（如 `.msi` 或 `.exe`）以分享给其他人使用：

```bash
npm run tauri build
```

打包完成后，输出文件会保存在 `src-tauri/target/release/` 目录下。

> **⚠️ 重要打包说明**：
> 目前的架构依赖于操作系统的 Python 和 Conda 来执行管理命令。因此，当您把打包好的应用发给朋友时，他们的电脑上也**必须**已经安装了 Conda 和 Python，并且配置好了全局环境变量 (`PATH`) 才能正常运行。
> 
> *进阶方案*：如果您想要实现完全绿色的“点开即用”，没有任何外部环境依赖。您可以后续使用 **PyInstaller** 将 `backend/main.py` 编译为一个独立的二级可执行文件，并通过 Tauri 的 **Sidecar（附加程序）** 机制将其挂载到应用内。
