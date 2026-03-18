# CondaTools 🚀

[中文版介绍 (Chinese Version)](README_zh-CN.md)

CondaTools is a fast, lightweight, and modern Desktop GUI for managing Conda environments. Built with **Tauri**, **React (Vite)**, and **Python**, it allows you to effortlessly view, create, clone, rename, and export your Conda environments without touching the terminal.

![Tech Stack](https://img.shields.io/badge/Tauri-2.x-orange?logo=tauri)
![Tech Stack](https://img.shields.io/badge/React-19-blue?logo=react)
![Tech Stack](https://img.shields.io/badge/Python-3-green?logo=python)

## ✨ Features

- **Auto-Detection**: Instantly finds your local Conda installation and base environment.
- **Environment Management**: Create, delete, clone, and rename environments through an intuitive UI.
- **Package Viewer**: Select an environment to view and search all installed packages, versions, and channels.
- **Import/Export**: Export environments to `yml` or `txt` files (with or without build numbers), or import an environment from a file.
- **Real-Time Logs**: Built-in console viewer displays real-time execution logs and exact conda commands running in the background.

## 🛠️ Architecture

The app uses Tauri's powerful IPC to communicate between a React interface and a modular Python backend backend:
- **Frontend (`src/`)**: React + TypeScript + Vite. 
- **Tauri Backend (`src-tauri/`)**: Rust layer that spans processes and bridges the UI with Python.
- **Python Scripts (`backend/`)**: Modular python CLI wrapper around the local `conda` executable.

## 🚀 Development Setup

1. **Prerequisites**: Make sure you have [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/), and [Conda/Miniconda](https://docs.conda.io/) installed.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run Dev Server**:
   ```bash
   npm run tauri dev
   ```
   This command starts the Vite Frontend and the Tauri Rust backend simultaneously. Any changes to React files or Python files will be reflected immediately.

## 📦 Packaging & Distribution

To build the application into a standalone executable (`.msi` and `.exe`) that you can distribute to others:

```bash
npm run tauri build
```

The output will be located in `src-tauri/target/release/`. 

> **Important Note**: 
> The application currently utilizes the system's Conda installation to manage environments. When distributing this app, the user's machine **must** have Python and Conda installed and accessible in their system `PATH`.
> 
> *Advanced (Future)*: To remove the Python dependency for end-users, you can compile the `backend/main.py` into a standalone binary using tools like **PyInstaller**, and configure Tauri to bundle it as a **Sidecar** executable.
