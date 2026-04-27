# CondaTools 🚀

[中文版介绍 (Chinese Version)](README_zh-CN.md)

CondaTools is a fast, lightweight, and modern Desktop GUI for managing Conda environments. Built with **Tauri**, **React (Vite)**, and **Python**, it allows you to view, create, clone, rename, export, diagnose, and switch source presets for your Conda environments without touching the terminal.

![Tech Stack](https://img.shields.io/badge/Tauri-2.x-orange?logo=tauri)
![Tech Stack](https://img.shields.io/badge/React-19-blue?logo=react)
![Tech Stack](https://img.shields.io/badge/Python-3-green?logo=python)

## ✨ Features

- **Auto-Detection**: Instantly finds your local Conda installation and base environment.
- **Environment Management**: Create, delete, clone, and rename environments through an intuitive UI.
- **Package Viewer**: Select an environment to view and search all installed packages, versions, and channels.
- **Import/Export**: Export environments to `yml` or `txt` files (with or without build numbers), or import an environment from a file.
- **Diagnostics**: Inspect the current package manager, root/base path, config files, channels, proxies, and cache directories.
- **Source Presets**: View current source configuration and switch between official defaults and the TUNA mirror preset with one click.
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
> The current release bundles `backend.exe` and `micromamba.exe` runtime files for diagnostics, source configuration, and environment operations.
> 
> *Advanced (Future)*: To remove the Python dependency for end-users, you can compile the `backend/main.py` into a standalone binary using tools like **PyInstaller**, and configure Tauri to bundle it as a **Sidecar** executable.

## 🔐 Code Signing

Unsigned runtime binaries are more likely to be quarantined by Windows Defender or other endpoint security products after installation. This project now includes signing scripts, but you still need your own code signing certificate.

### Supported modes

1. Local PFX certificate with `signtool.exe`
2. Azure Trusted Signing with `trusted-signing-cli`

### Required input for local PFX signing

1. A PFX certificate file
2. The certificate password
3. Windows SDK Signing Tools (`signtool.exe`)

### Sign release artifacts with local PFX

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sign-release.ps1 \
  -CertificatePath "C:\path\to\your-cert.pfx" \
  -CertificatePassword "your-password"
```

You can also use environment variables:

```powershell
$env:CONDATOOL_SIGN_CERT_PATH = "C:\path\to\your-cert.pfx"
$env:CONDATOOL_SIGN_CERT_PASSWORD = "your-password"
powershell -ExecutionPolicy Bypass -File .\scripts\sign-release.ps1
```

### Build + sign in one step

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1 \
  -Sign \
  -CertificatePath "C:\path\to\your-cert.pfx" \
  -CertificatePassword "your-password"
```

### Azure Trusted Signing

Install the CLI first:

```powershell
cargo install trusted-signing-cli
```

Then configure environment variables:

```powershell
$env:CONDATOOL_TRUSTED_SIGNING_ENDPOINT = "https://wus2.codesigning.azure.net"
$env:CONDATOOL_TRUSTED_SIGNING_ACCOUNT = "YourAccount"
$env:CONDATOOL_TRUSTED_SIGNING_PROFILE = "YourProfile"
```

Run the release pipeline with Trusted Signing:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1 \
  -Sign \
  -SignMode trusted-signing
```
