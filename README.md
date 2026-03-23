<div align="center">
  <h1>CondaTool</h1>
  <p><strong>A modern desktop GUI for environment management</strong></p>
  <p>面向日常用户的 Conda 环境管理工具：更直观、更省心。</p>
  <img src="./asset/img.png" alt="CondaTool Preview" width="88%" />
  <p>
    <a href="https://github.com/Dekelkai/CondaTool/releases/latest"><img alt="Download Latest Release" src="https://img.shields.io/badge/Download-Latest%20Release-1766D1?style=for-the-badge" /></a>
  </p>
</div>

---

## CondaTool 是什么

CondaTool 是一个桌面应用，用来可视化管理 Python/Conda 环境。你可以用它完成常见操作，而不必记复杂命令。

## 适合谁

- 想快速创建或管理环境的开发者
- 需要查看包版本与依赖的学习者
- 希望把环境导入/导出给他人的团队成员

## 当前功能

- 环境管理：创建、删除、克隆、重命名
- 环境导入/导出：`yml` / `txt`
- 包列表查看与搜索
- 中英文切换
- 主题切换：浅色 / 深色 / 跟随系统
- 实时日志输出

## 待办事项

- [ ] UI 优化
- [ ] 包安装与卸载（按环境执行）
- [ ] Conda 源管理（查看/新增/删除/优先级调整）
- [ ] 常用源模板（一键切换）
- [ ] Jupyter Kernel 管理
- [ ] ...

## 用户安装与使用

1. 从 GitHub Release 下载最新安装包（`.msi` 或 `setup.exe`）。
2. 安装并启动 CondaTool。
3. 点击“刷新环境”加载环境列表。
4. 选择环境后即可查看包信息并进行管理操作。

## 常见问题

- 启动时报 runtime missing：请重新安装，或检查安全软件是否隔离 runtime 文件。
- 无法创建环境：请查看日志窗口中的错误信息进行排查。

## 开发与构建（简版）

> 以下内容面向开发者，普通用户可忽略。

```bash
cd condatools
npm install
npm run tauri dev
```

独立打包（目标 `CondaTool.exe`）请先准备 runtime：`backend.exe` + `micromamba.exe`，然后执行：

```bash
npm run tauri build
```