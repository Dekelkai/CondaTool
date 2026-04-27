import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { confirm, save, open, message } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExportModal } from "./ExportModal";
import "./App.css";

interface CondaInfo {
  conda_version: string;
  python_version: string;
  root_prefix: string;
}

interface DiagnosticsInfo {
  package_manager_kind: string;
  package_manager_path: string;
  conda_version: string;
  python_version: string;
  root_prefix: string;
  active_environment: string;
  envs_directories: string[];
  package_cache_directories: string[];
  config_files: string[];
  channels: string[];
  proxy_servers: Record<string, string>;
  ssl_verify: string | boolean | null;
}

interface SourceConfigInfo {
  channels: string[];
  default_channels: string[];
  custom_channels: Record<string, string>;
  channel_priority: string;
  config_file: string;
  available_presets: string[];
}

interface Environment {
  path: string;
  python_version: string;
}

interface Package {
  name: string;
  version: string;
  build: string;
  channel: string;
}

interface CommandMeta {
  command: string;
  envPath?: string;
  nextSelectedEnvName?: string;
  clearSelectedEnvOnSuccess?: boolean;
}

type ThemeMode = "light" | "dark" | "system";
type Locale = "zh" | "en";

const MAX_LOG_LINES = 600;
const LOG_FLUSH_DELAY_MS = 48;
const LOG_BATCH_SIZE = 20;

const i18n = {
  zh: {
    appSubtitle: "Conda 环境桌面管理器",
    themeLight: "浅色",
    themeDark: "深色",
    themeSystem: "跟随系统",
    refreshEnv: "刷新环境",
    featureGuide: "功能说明",
    diagnostics: "诊断",
    sourceConfig: "源配置",
    importEnv: "导入环境",
    createEnv: "新建环境",
    running: "执行中",
    simulated: "模拟模式: 包管理器不可用",
    errorPrefix: "错误",
    panelEnv: "环境",
    loadingEnvs: "正在加载环境...",
    noEnvs: "暂无环境，点击顶部“刷新环境”。",
    clone: "克隆",
    export: "导出",
    rename: "重命名",
    remove: "删除",
    panelPkg: "包列表",
    noSelectedEnv: "未选择环境",
    searchPkg: "搜索包名...",
    selectEnvHint: "请先在左侧选择一个环境。",
    loadingPkgs: "正在加载包列表...",
    noMatchedPkg: "没有匹配的包。",
    name: "名称",
    version: "版本",
    channel: "渠道",
    panelLog: "日志",
    clear: "清空",
    startupProbe: "应用启动，正在检查内置运行时...",
    condaMissingTitle: "内置运行时缺失",
    condaMissingDesc1: "CondaTool 依赖内置运行时（backend.exe 与 micromamba.exe）。当前未检测到完整运行时文件。",
    condaMissingDesc2: "请重新安装应用，或在安装目录中检查 runtime 文件是否被杀毒软件隔离。",
    installConda: "查看文档（运行时说明）",
    installMiniconda: "查看 micromamba 文档",
    understood: "我已了解",
    featureTitle: "CondaTool 功能说明",
    featureDesc: "CondaTool 面向需要可视化管理 Conda 环境的开发者与数据工作者，核心目标是减少命令行操作成本，提升环境管理效率。",
    featureItem1: "检查内置运行时（backend.exe 与 micromamba.exe）并加载环境状态。",
    featureItem2: "图形化管理环境：创建、删除、克隆、重命名。",
    featureItem3: "查看并搜索指定环境下的已安装包与版本信息。",
    featureItem4: "支持环境导入/导出（`yml` / `txt`），便于共享与复现。",
    featureItem5: "支持查看诊断信息与源配置，便于定位环境和镜像问题。",
    featureFlow: "推荐流程：先刷新环境列表，必要时查看诊断与源配置，再选择目标环境查看包信息或进行创建/克隆/导入导出等操作。",
    closeGuide: "关闭说明",
    diagnosticsTitle: "诊断信息",
    diagnosticsLoading: "正在收集诊断信息...",
    diagnosticsRefresh: "刷新诊断",
    diagnosticsClose: "关闭诊断",
    diagnosticsPackageManager: "包管理器",
    diagnosticsPackageManagerPath: "执行路径",
    diagnosticsRootPrefix: "根环境路径",
    diagnosticsActiveEnv: "当前活动环境",
    diagnosticsCondaVersion: "Conda 版本",
    diagnosticsPythonVersion: "Python 版本",
    diagnosticsConfigFiles: "配置文件",
    diagnosticsChannels: "当前渠道",
    diagnosticsProxy: "代理配置",
    diagnosticsSslVerify: "SSL 校验",
    diagnosticsEnvDirs: "环境目录",
    diagnosticsPkgCaches: "包缓存目录",
    diagnosticsNone: "未配置",
    sourceConfigTitle: "源配置",
    sourceConfigLoading: "正在读取源配置...",
    sourceConfigRefresh: "刷新源配置",
    sourceConfigClose: "关闭源配置",
    sourceConfigPreset: "预设模板",
    sourceConfigApply: "应用模板",
    sourceConfigCurrentFile: "配置文件",
    sourceConfigChannels: "Channels",
    sourceConfigDefaultChannels: "Default Channels",
    sourceConfigCustomChannels: "Custom Channels",
    sourceConfigPriority: "Channel Priority",
    sourceConfigDefaultsLabel: "官方默认源",
    sourceConfigTunaLabel: "清华镜像",
    sourceConfigApplySuccess: (preset: string) => `已应用源配置模板：${preset}`,
    sourceConfigApplyFailed: "源配置应用失败",
    createPrompt: "请输入新环境名称:",
    createFailTitle: "创建失败",
    nameExists: (name: string) => `环境 \"${name}\" 已存在，请使用其他名称。`,
    pythonPrompt: "请输入 Python 版本 (例如 3.10):",
    removeConfirmTitle: "删除确认",
    removeConfirm: (name: string) => `确认删除环境 \"${name}\" ?\n该操作不可恢复。`,
    renamePrompt: (oldName: string) => `请输入环境 \"${oldName}\" 的新名称:`,
    renameFailTitle: "重命名失败",
    clonePrompt: (sourceName: string) => `请输入克隆环境 \"${sourceName}\" 的新名称:`,
    cloneFailTitle: "克隆失败",
    cloneNameSame: "新环境名称不能与源环境相同。",
    exportTitle: (format: string) => `导出环境为 ${format}`,
    importTitle: "从文件导入环境",
    importPrompt: "请输入导入后新环境名称:",
    importFailTitle: "导入失败",
    envFile: "环境文件",
    cannotOpenLink: "无法打开链接",
    runtimeMissingError: "runtime missing: required runtime files are not available.",
    backendStartupError: "backend startup failed: unable to launch backend runtime.",
    packageManagerInitError: "package manager init failed: package manager runtime is unavailable.",
    themeAria: "主题切换",
    langAria: "语言切换",
  },
  en: {
    appSubtitle: "Desktop Conda Environment Manager",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    refreshEnv: "Refresh Environments",
    featureGuide: "Feature Guide",
    diagnostics: "Diagnostics",
    sourceConfig: "Sources",
    importEnv: "Import",
    createEnv: "New Environment",
    running: "Running",
    simulated: "Simulation Mode: Package manager unavailable",
    errorPrefix: "Error",
    panelEnv: "Environments",
    loadingEnvs: "Loading environments...",
    noEnvs: "No environments. Click \"Refresh Environments\".",
    clone: "Clone",
    export: "Export",
    rename: "Rename",
    remove: "Delete",
    panelPkg: "Packages",
    noSelectedEnv: "No environment selected",
    searchPkg: "Search package...",
    selectEnvHint: "Select an environment from the left panel first.",
    loadingPkgs: "Loading packages...",
    noMatchedPkg: "No matched packages.",
    name: "Name",
    version: "Version",
    channel: "Channel",
    panelLog: "Logs",
    clear: "Clear",
    startupProbe: "App started. Checking bundled runtime...",
    condaMissingTitle: "Bundled Runtime Missing",
    condaMissingDesc1: "CondaTool relies on bundled runtime files (backend.exe and micromamba.exe). Required files are missing or inaccessible.",
    condaMissingDesc2: "Reinstall the app or check whether security software quarantined runtime binaries.",
    installConda: "Open docs (runtime)",
    installMiniconda: "Open micromamba docs",
    understood: "Got it",
    featureTitle: "CondaTool Feature Guide",
    featureDesc: "CondaTool is designed for developers and data professionals who need visual management for Conda environments, reducing command-line overhead and improving efficiency.",
    featureItem1: "Check bundled runtime files (backend.exe and micromamba.exe) and load environment state.",
    featureItem2: "Manage environments visually: create, delete, clone, and rename.",
    featureItem3: "View and search installed packages and versions in any selected environment.",
    featureItem4: "Import/export environments (`yml` / `txt`) for sharing and reproducibility.",
    featureItem5: "Review diagnostics and source configuration to troubleshoot environment and mirror issues.",
    featureFlow: "Recommended flow: refresh environments first, review diagnostics or sources if needed, then inspect packages or perform create/clone/import/export actions.",
    closeGuide: "Close",
    diagnosticsTitle: "Diagnostics",
    diagnosticsLoading: "Collecting diagnostics...",
    diagnosticsRefresh: "Refresh Diagnostics",
    diagnosticsClose: "Close Diagnostics",
    diagnosticsPackageManager: "Package Manager",
    diagnosticsPackageManagerPath: "Executable Path",
    diagnosticsRootPrefix: "Root Prefix",
    diagnosticsActiveEnv: "Active Environment",
    diagnosticsCondaVersion: "Conda Version",
    diagnosticsPythonVersion: "Python Version",
    diagnosticsConfigFiles: "Config Files",
    diagnosticsChannels: "Channels",
    diagnosticsProxy: "Proxy Settings",
    diagnosticsSslVerify: "SSL Verify",
    diagnosticsEnvDirs: "Environment Directories",
    diagnosticsPkgCaches: "Package Cache Directories",
    diagnosticsNone: "Not configured",
    sourceConfigTitle: "Source Configuration",
    sourceConfigLoading: "Loading source configuration...",
    sourceConfigRefresh: "Refresh Sources",
    sourceConfigClose: "Close Sources",
    sourceConfigPreset: "Preset",
    sourceConfigApply: "Apply Preset",
    sourceConfigCurrentFile: "Config File",
    sourceConfigChannels: "Channels",
    sourceConfigDefaultChannels: "Default Channels",
    sourceConfigCustomChannels: "Custom Channels",
    sourceConfigPriority: "Channel Priority",
    sourceConfigDefaultsLabel: "Official Defaults",
    sourceConfigTunaLabel: "TUNA Mirror",
    sourceConfigApplySuccess: (preset: string) => `Applied source preset: ${preset}`,
    sourceConfigApplyFailed: "Failed to apply source preset",
    createPrompt: "Enter new environment name:",
    createFailTitle: "Create Failed",
    nameExists: (name: string) => `Environment \"${name}\" already exists. Please choose another name.`,
    pythonPrompt: "Enter Python version (for example 3.10):",
    removeConfirmTitle: "Delete Confirmation",
    removeConfirm: (name: string) => `Delete environment \"${name}\"?\nThis action cannot be undone.`,
    renamePrompt: (oldName: string) => `Enter a new name for \"${oldName}\":`,
    renameFailTitle: "Rename Failed",
    clonePrompt: (sourceName: string) => `Enter a new name for cloned env \"${sourceName}\":`,
    cloneFailTitle: "Clone Failed",
    cloneNameSame: "New name cannot be the same as source environment.",
    exportTitle: (format: string) => `Export Environment as ${format}`,
    importTitle: "Import Environment from File",
    importPrompt: "Enter the imported environment name:",
    importFailTitle: "Import Failed",
    envFile: "Environment File",
    cannotOpenLink: "Cannot open link",
    runtimeMissingError: "runtime missing: required runtime files are not available.",
    backendStartupError: "backend startup failed: unable to launch backend runtime.",
    packageManagerInitError: "package manager init failed: package manager runtime is unavailable.",
    themeAria: "Theme switch",
    langAria: "Language switch",
  },
} as const;

const CloneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const ExportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const RenameIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const RemoveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [condaInfo, setCondaInfo] = useState<CondaInfo | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCondaInstallGuide, setShowCondaInstallGuide] = useState(false);
  const [selectedEnvPath, setSelectedEnvPath] = useState<string | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportingEnv, setExportingEnv] = useState<Environment | null>(null);
  const [showFeatureGuide, setShowFeatureGuide] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsInfo, setDiagnosticsInfo] = useState<DiagnosticsInfo | null>(null);
  const [showSourceConfig, setShowSourceConfig] = useState(false);
  const [sourceConfigInfo, setSourceConfigInfo] = useState<SourceConfigInfo | null>(null);
  const [selectedSourcePreset, setSelectedSourcePreset] = useState("tuna");
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("condatool-locale");
    return saved === "en" || saved === "zh" ? saved : "zh";
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("condatool-theme-mode");
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const subscribed = useRef(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const localeRef = useRef<Locale>(locale);
  const selectedEnvPathRef = useRef<string | null>(selectedEnvPath);
  const commandQueueRef = useRef<Promise<void>>(Promise.resolve());
  const activeCommandRef = useRef<CommandMeta | null>(null);
  const activeCommandResultRef = useRef<boolean | null>(null);
  const activeCommandDoneRef = useRef<((ok: boolean) => void) | null>(null);
  const pendingSelectedEnvNameRef = useRef<string | null>(null);
  const pendingLogsRef = useRef<string[]>([]);
  const logFlushTimerRef = useRef<number | null>(null);
  const selectedSourcePresetRef = useRef(selectedSourcePreset);

  const forceNoRuntime = String(import.meta.env.VITE_FORCE_RUNTIME_MISSING || import.meta.env.VITE_FORCE_NO_CONDA || "").toLowerCase();
  const isForceNoRuntime = forceNoRuntime === "1" || forceNoRuntime === "true";
  const effectiveTheme = themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : themeMode;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const t = i18n[locale];

  const getEnvName = (fullPath: string) => fullPath.split(/[\\/]/).pop() || fullPath;

  const handleCommandError = (rawError: string) => {
    queueLog(`[ERR] ${rawError}`);
    const currentText = i18n[localeRef.current];
    const normalized = rawError.toLowerCase();

    if (normalized.includes("runtime missing")) {
      setError(currentText.runtimeMissingError);
      setShowCondaInstallGuide(true);
      return;
    }

    if (normalized.includes("backend startup failed")) {
      setError(currentText.backendStartupError);
      return;
    }

    if (normalized.includes("package manager init failed")) {
      setError(currentText.packageManagerInitError);
      return;
    }

    setError(rawError);
  };

  const flushLogs = () => {
    if (logFlushTimerRef.current !== null) {
      window.clearTimeout(logFlushTimerRef.current);
      logFlushTimerRef.current = null;
    }

    if (pendingLogsRef.current.length === 0) return;

    const batchedLogs = pendingLogsRef.current;
    pendingLogsRef.current = [];

    startTransition(() => {
      setLogs((prev) => {
        const nextLogs = [...prev, ...batchedLogs];
        return nextLogs.length > MAX_LOG_LINES ? nextLogs.slice(-MAX_LOG_LINES) : nextLogs;
      });
    });
  };

  const queueLog = (line: string) => {
    pendingLogsRef.current.push(line);

    if (pendingLogsRef.current.length >= LOG_BATCH_SIZE) {
      flushLogs();
      return;
    }

    if (logFlushTimerRef.current !== null) return;

    logFlushTimerRef.current = window.setTimeout(() => {
      flushLogs();
    }, LOG_FLUSH_DELAY_MS);
  };

  const clearLogs = () => {
    pendingLogsRef.current = [];
    if (logFlushTimerRef.current !== null) {
      window.clearTimeout(logFlushTimerRef.current);
      logFlushTimerRef.current = null;
    }
    setLogs([]);
  };

  const openExternalLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (e: any) {
      setError(`${t.cannotOpenLink}: ${String(e)}`);
    }
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem("condatool-theme-mode", mode);
  };

  const handleLocaleChange = (nextLocale: Locale) => {
    setLocale(nextLocale);
    localStorage.setItem("condatool-locale", nextLocale);
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    setSystemPrefersDark(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    return () => {
      pendingLogsRef.current = [];
      if (logFlushTimerRef.current !== null) {
        window.clearTimeout(logFlushTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    selectedEnvPathRef.current = selectedEnvPath;
  }, [selectedEnvPath]);

  useEffect(() => {
    selectedSourcePresetRef.current = selectedSourcePreset;
  }, [selectedSourcePreset]);

  const reconcileSelectedEnvironment = (nextEnvironments: Environment[]) => {
    const pendingSelectedEnvName = pendingSelectedEnvNameRef.current;
    if (pendingSelectedEnvName) {
      pendingSelectedEnvNameRef.current = null;
      const matchedEnv = nextEnvironments.find((env) => getEnvName(env.path).toLowerCase() === pendingSelectedEnvName.toLowerCase());

      if (!matchedEnv) {
        setSelectedEnvPath(null);
        setPackages([]);
        return;
      }

      setSelectedEnvPath(matchedEnv.path);
      setPackages([]);
      void runCommand("pkg-list", ["--prefix", matchedEnv.path], { command: "pkg-list", envPath: matchedEnv.path });
      return;
    }

    const currentSelectedEnvPath = selectedEnvPathRef.current;
    if (!currentSelectedEnvPath) return;

    const selectedStillExists = nextEnvironments.some((env) => env.path === currentSelectedEnvPath);
    if (!selectedStillExists) {
      setSelectedEnvPath(null);
      setPackages([]);
    }
  };

  const runCommand = async (command: string, extraArgs: string[] = [], meta?: Partial<CommandMeta>) => {
    const finalArgs = [command, ...extraArgs].filter((arg) => arg !== "");
    const commandForLog = finalArgs.join(" ");

    const execute = async () => {
      setRunning(commandForLog);
      queueLog(`\n--- Starting command: ${commandForLog} ---`);
      setError(null);
      activeCommandRef.current = { command, ...meta };
      activeCommandResultRef.current = null;

      if (isForceNoRuntime) {
        queueLog(`[SIMULATED] VITE_FORCE_RUNTIME_MISSING is enabled, skip command: ${commandForLog}`);
        handleCommandError("package manager init failed: executable not found");
        return false;
      }

      try {
        const completed = new Promise<boolean>((resolve) => {
          activeCommandDoneRef.current = resolve;
        });
        await invoke("run_backend", { args: finalArgs });
        return await completed;
      } catch (e: any) {
        handleCommandError(String(e));
        return false;
      } finally {
        activeCommandRef.current = null;
        activeCommandResultRef.current = null;
        activeCommandDoneRef.current = null;
        setRunning(null);
      }
    };

    const queued = commandQueueRef.current.then(execute, execute);
    commandQueueRef.current = queued.then(() => undefined, () => undefined);
    return queued;
  };

  useEffect(() => {
    if (subscribed.current) return;
    subscribed.current = true;

    const setupListeners = async () => {
      const unlistenStdout = await listen<any>("backend://stdout", (event) => {
        const line = event.payload;
        try {
          const result = JSON.parse(line);
          const cmd = result.command;
          activeCommandResultRef.current = result.ok === true;

          if (cmd === "probe") {
            if (result.ok) {
              setCondaInfo(result.data);
              setShowCondaInstallGuide(false);
            } else {
              handleCommandError(result.error);
            }
          } else if (cmd === "env-list") {
            if (result.ok) {
              setEnvironments(result.data);
              reconcileSelectedEnvironment(result.data);
            } else {
              handleCommandError(result.error);
            }
          } else if (cmd === "pkg-list") {
            const requestedEnvPath = activeCommandRef.current?.envPath;
            if (result.ok) {
              if (requestedEnvPath && requestedEnvPath === selectedEnvPathRef.current) {
                setPackages(result.data);
              }
            } else {
              handleCommandError(result.error);
              if (requestedEnvPath && requestedEnvPath === selectedEnvPathRef.current) {
                setPackages([]);
              }
            }
          } else if (cmd === "diagnostics") {
            if (result.ok) {
              setDiagnosticsInfo(result.data);
            } else {
              handleCommandError(result.error);
            }
          } else if (cmd === "source-config-get") {
            if (result.ok) {
              setSourceConfigInfo(result.data);
            } else {
              handleCommandError(result.error);
            }
          } else if (cmd === "source-config-apply-preset") {
            if (result.ok) {
              setSourceConfigInfo(result.data);
              queueLog(i18n[localeRef.current].sourceConfigApplySuccess(selectedSourcePresetRef.current));
            } else {
              handleCommandError(result.error);
            }
          } else if (["env-create", "env-remove", "env-rename", "env-import", "env-clone"].includes(cmd)) {
            if (result.ok) {
              if (activeCommandRef.current?.clearSelectedEnvOnSuccess) {
                setSelectedEnvPath(null);
                setPackages([]);
              }

              if (activeCommandRef.current?.nextSelectedEnvName) {
                pendingSelectedEnvNameRef.current = activeCommandRef.current.nextSelectedEnvName;
              }

              const action = cmd.split("-")[1];
              queueLog(`--- Environment ${action} operation successful. Refreshing list... ---`);
              void handleLoadEnvs(false);
            } else {
              handleCommandError(result.error);
            }
          } else if (cmd === "env-export") {
            if (result.ok) {
              queueLog("--- Environment exported successfully. ---");
            } else {
              handleCommandError(result.error);
            }
          }
        } catch {
          queueLog(line);
        }
      });

      const unlistenStderr = await listen<string>("backend://stderr", (event) => {
        queueLog(`[ERR] ${event.payload}`);
      });

      const unlistenTerminated = await listen<string>("backend://terminated", () => {
        flushLogs();
        const currentResult = activeCommandResultRef.current;
        activeCommandDoneRef.current?.(currentResult === true);
      });

      return () => {
        unlistenStdout();
        unlistenStderr();
        unlistenTerminated();
      };
    };

    const unlistenPromise = (async () => {
      const cleanup = await setupListeners();
      await runCommand("probe");
      return cleanup;
    })();

    return () => {
      unlistenPromise.then((cleanup) => cleanup && cleanup());
    };
  }, []);

  const handleLoadEnvs = async (probeFirst = true) => {
    if (probeFirst) {
      const probeSucceeded = await runCommand("probe");
      if (!probeSucceeded) return;
    }
    await runCommand("env-list");
  };

  const isEnvNameExists = (name: string) => {
    if (name.toLowerCase() === "base") return true;
    return environments.some((env) => getEnvName(env.path).toLowerCase() === name.toLowerCase());
  };

  const handleCreateEnv = async () => {
    if (running) return;
    const name = prompt(t.createPrompt, "my-new-env");
    if (!name || !name.trim()) return;
    const trimmedName = name.trim();

    if (isEnvNameExists(trimmedName)) {
      await message(t.nameExists(trimmedName), { title: t.createFailTitle });
      return;
    }

    const pythonVersion = prompt(t.pythonPrompt, "3.10");
    if (!pythonVersion || !pythonVersion.trim()) return;

    void runCommand("env-create", ["--name", trimmedName, "--python", pythonVersion.trim()]);
  };

  const handleEnvSelect = (env: Environment) => {
    if (running) return;
    setSelectedEnvPath(env.path);
    setPackages([]);
    setSearchQuery("");
    void runCommand("pkg-list", ["--prefix", env.path], { command: "pkg-list", envPath: env.path });
  };

  const handleRemoveEnv = async (env: Environment) => {
    if (running) return;
    const envName = getEnvName(env.path);
    const confirmed = await confirm(t.removeConfirm(envName), { title: t.removeConfirmTitle });
    if (!confirmed) return;

    void runCommand("env-remove", ["--prefix", env.path], {
      command: "env-remove",
      envPath: env.path,
      clearSelectedEnvOnSuccess: selectedEnvPath === env.path,
    });
  };

  const handleRenameEnv = async (env: Environment) => {
    if (running) return;
    const oldName = getEnvName(env.path);
    const newName = prompt(t.renamePrompt(oldName), oldName);
    if (!newName || !newName.trim()) return;

    const trimmedName = newName.trim();
    if (trimmedName.toLowerCase() === oldName.toLowerCase()) return;

    if (isEnvNameExists(trimmedName)) {
      await message(t.nameExists(trimmedName), { title: t.renameFailTitle });
      return;
    }

    void runCommand("env-rename", ["--old-prefix", env.path, "--new-name", trimmedName], {
      command: "env-rename",
      envPath: env.path,
      nextSelectedEnvName: selectedEnvPath === env.path ? trimmedName : undefined,
    });
  };

  const handleCloneEnv = async (env: Environment) => {
    if (running) return;
    const sourceName = getEnvName(env.path);
    const destName = prompt(t.clonePrompt(sourceName), `${sourceName}-clone`);
    if (!destName || !destName.trim()) return;

    const trimmedName = destName.trim();
    if (trimmedName.toLowerCase() === sourceName.toLowerCase()) {
      await message(t.cloneNameSame, { title: t.cloneFailTitle });
      return;
    }

    if (isEnvNameExists(trimmedName)) {
      await message(t.nameExists(trimmedName), { title: t.cloneFailTitle });
      return;
    }

    void runCommand("env-clone", ["--source-prefix", env.path, "--dest-name", trimmedName]);
  };

  const openExportModal = (env: Environment) => {
    setExportingEnv(env);
    setIsExportModalOpen(true);
  };

  const handleExportFromModal = async (options: { format: "yml" | "txt"; noBuilds: boolean }) => {
    if (!exportingEnv) return;

    const { format, noBuilds } = options;
    const envName = getEnvName(exportingEnv.path);
    const defaultFileName = format === "yml" ? `${envName}-environment.yml` : `${envName}-requirements.txt`;

    const filePath = await save({
      title: t.exportTitle(format.toUpperCase()),
      defaultPath: defaultFileName,
      filters: [{ name: `${format.toUpperCase()} File`, extensions: [format] }],
    });

    if (filePath) {
      void runCommand("env-export", ["--name", envName, "--file", filePath, "--format", format, noBuilds ? "--no-builds" : ""]);
    }

    setIsExportModalOpen(false);
    setExportingEnv(null);
  };

  const handleImportEnv = async () => {
    if (running) return;

    const filePath = await open({
      title: t.importTitle,
      multiple: false,
      filters: [{ name: t.envFile, extensions: ["yml", "yaml", "txt"] }],
    });

    if (typeof filePath !== "string") return;

    const newName = prompt(t.importPrompt);
    if (!newName || !newName.trim()) return;

    const trimmedName = newName.trim();
    if (isEnvNameExists(trimmedName)) {
      await message(t.nameExists(trimmedName), { title: t.importFailTitle });
      return;
    }

    void runCommand("env-import", ["--file", filePath, "--name", trimmedName]);
  };

  const handleOpenDiagnostics = async () => {
    setShowDiagnostics(true);
    if (running) return;
    await runCommand("diagnostics");
  };

  const handleOpenSourceConfig = async () => {
    setShowSourceConfig(true);
    if (running) return;
    await runCommand("source-config-get");
  };

  const handleApplySourcePreset = async () => {
    if (running) return;
    const success = await runCommand("source-config-apply-preset", ["--preset", selectedSourcePreset]);
    if (!success) {
      await message(t.sourceConfigApplyFailed);
    }
  };

  const sortedEnvironments = useMemo(() => {
    const rootPrefix = condaInfo?.root_prefix;
    if (!environments) return [];
    if (!rootPrefix) return environments;

    return [...environments].sort((a, b) => {
      if (a.path === rootPrefix) return -1;
      if (b.path === rootPrefix) return 1;
      return a.path.localeCompare(b.path);
    });
  }, [environments, condaInfo]);

  const filteredPackages = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return packages;
    return packages.filter((pkg) => pkg.name.toLowerCase().includes(normalizedQuery));
  }, [packages, deferredSearchQuery]);

  const selectedEnvName = selectedEnvPath ? getEnvName(selectedEnvPath) : "";

  return (
    <>
      <ExportModal
        isOpen={isExportModalOpen}
        envName={exportingEnv ? getEnvName(exportingEnv.path) : ""}
        locale={locale}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportingEnv(null);
        }}
        onExport={handleExportFromModal}
      />

      {showCondaInstallGuide && (
        <div className="guide-overlay">
          <div className="guide-card">
            <h2>{t.condaMissingTitle}</h2>
            <p>{t.condaMissingDesc1}</p>
            <p>{t.condaMissingDesc2}</p>
            <div className="guide-links">
              <button className="link-button" onClick={() => openExternalLink("https://github.com/Dekelkai/CondaTool#-独立打包目标condatoolexe")}>{t.installConda}</button>
              <button className="link-button" onClick={() => openExternalLink("https://mamba.readthedocs.io/en/latest/installation/micromamba-installation.html")}>{t.installMiniconda}</button>
            </div>
            <div className="guide-actions">
              <button className="btn btn-primary" onClick={() => setShowCondaInstallGuide(false)}>{t.understood}</button>
            </div>
          </div>
        </div>
      )}

      {showFeatureGuide && (
        <div className="guide-overlay">
          <div className="guide-card">
            <h2>{t.featureTitle}</h2>
            <p>{t.featureDesc}</p>
            <ul className="guide-list">
              <li>{t.featureItem1}</li>
              <li>{t.featureItem2}</li>
              <li>{t.featureItem3}</li>
              <li>{t.featureItem4}</li>
              <li>{t.featureItem5}</li>
            </ul>
            <p>{t.featureFlow}</p>
            <div className="guide-actions">
              <button className="btn btn-primary" onClick={() => setShowFeatureGuide(false)}>{t.closeGuide}</button>
            </div>
          </div>
        </div>
      )}

      {showDiagnostics && (
        <div className="guide-overlay">
          <div className="guide-card diagnostics-card">
            <div className="diagnostics-head">
              <h2>{t.diagnosticsTitle}</h2>
              <button className="btn btn-secondary" onClick={() => void runCommand("diagnostics")} disabled={!!running}>
                {t.diagnosticsRefresh}
              </button>
            </div>

            {!diagnosticsInfo ? (
              <p>{t.diagnosticsLoading}</p>
            ) : (
              <div className="diagnostics-grid">
                <section className="diagnostics-section">
                  <h3>{t.diagnosticsPackageManager}</h3>
                  <dl className="diagnostics-list">
                    <div>
                      <dt>{t.diagnosticsPackageManager}</dt>
                      <dd>{diagnosticsInfo.package_manager_kind}</dd>
                    </div>
                    <div>
                      <dt>{t.diagnosticsPackageManagerPath}</dt>
                      <dd>{diagnosticsInfo.package_manager_path || t.diagnosticsNone}</dd>
                    </div>
                    <div>
                      <dt>{t.diagnosticsCondaVersion}</dt>
                      <dd>{diagnosticsInfo.conda_version}</dd>
                    </div>
                    <div>
                      <dt>{t.diagnosticsPythonVersion}</dt>
                      <dd>{diagnosticsInfo.python_version}</dd>
                    </div>
                    <div>
                      <dt>{t.diagnosticsRootPrefix}</dt>
                      <dd>{diagnosticsInfo.root_prefix || t.diagnosticsNone}</dd>
                    </div>
                    <div>
                      <dt>{t.diagnosticsActiveEnv}</dt>
                      <dd>{diagnosticsInfo.active_environment || t.diagnosticsNone}</dd>
                    </div>
                    <div>
                      <dt>{t.diagnosticsSslVerify}</dt>
                      <dd>{String(diagnosticsInfo.ssl_verify ?? t.diagnosticsNone)}</dd>
                    </div>
                  </dl>
                </section>

                <section className="diagnostics-section">
                  <h3>{t.diagnosticsConfigFiles}</h3>
                  <ul className="diagnostics-items">
                    {(diagnosticsInfo.config_files.length === 0 ? [t.diagnosticsNone] : diagnosticsInfo.config_files).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="diagnostics-section">
                  <h3>{t.diagnosticsChannels}</h3>
                  <ul className="diagnostics-items">
                    {(diagnosticsInfo.channels.length === 0 ? [t.diagnosticsNone] : diagnosticsInfo.channels).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="diagnostics-section">
                  <h3>{t.diagnosticsProxy}</h3>
                  {Object.keys(diagnosticsInfo.proxy_servers).length === 0 ? (
                    <p className="hint">{t.diagnosticsNone}</p>
                  ) : (
                    <dl className="diagnostics-list">
                      {Object.entries(diagnosticsInfo.proxy_servers).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>

                <section className="diagnostics-section">
                  <h3>{t.diagnosticsEnvDirs}</h3>
                  <ul className="diagnostics-items">
                    {(diagnosticsInfo.envs_directories.length === 0 ? [t.diagnosticsNone] : diagnosticsInfo.envs_directories).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="diagnostics-section">
                  <h3>{t.diagnosticsPkgCaches}</h3>
                  <ul className="diagnostics-items">
                    {(diagnosticsInfo.package_cache_directories.length === 0 ? [t.diagnosticsNone] : diagnosticsInfo.package_cache_directories).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            <div className="guide-actions">
              <button className="btn btn-primary" onClick={() => setShowDiagnostics(false)}>{t.diagnosticsClose}</button>
            </div>
          </div>
        </div>
      )}

      {showSourceConfig && (
        <div className="guide-overlay">
          <div className="guide-card diagnostics-card">
            <div className="diagnostics-head">
              <h2>{t.sourceConfigTitle}</h2>
              <button className="btn btn-secondary" onClick={() => void runCommand("source-config-get")} disabled={!!running}>
                {t.sourceConfigRefresh}
              </button>
            </div>

            {!sourceConfigInfo ? (
              <p>{t.sourceConfigLoading}</p>
            ) : (
              <div className="diagnostics-grid">
                <section className="diagnostics-section">
                  <h3>{t.sourceConfigPreset}</h3>
                  <div className="source-preset-actions">
                    <select value={selectedSourcePreset} onChange={(e) => setSelectedSourcePreset(e.target.value)} disabled={!!running}>
                      <option value="defaults">{t.sourceConfigDefaultsLabel}</option>
                      <option value="tuna">{t.sourceConfigTunaLabel}</option>
                    </select>
                    <button className="btn btn-primary" onClick={() => void handleApplySourcePreset()} disabled={!!running}>
                      {t.sourceConfigApply}
                    </button>
                  </div>
                  <dl className="diagnostics-list">
                    <div>
                      <dt>{t.sourceConfigCurrentFile}</dt>
                      <dd>{sourceConfigInfo.config_file}</dd>
                    </div>
                    <div>
                      <dt>{t.sourceConfigPriority}</dt>
                      <dd>{sourceConfigInfo.channel_priority}</dd>
                    </div>
                  </dl>
                </section>

                <section className="diagnostics-section">
                  <h3>{t.sourceConfigChannels}</h3>
                  <ul className="diagnostics-items">
                    {(sourceConfigInfo.channels.length === 0 ? [t.diagnosticsNone] : sourceConfigInfo.channels).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="diagnostics-section">
                  <h3>{t.sourceConfigDefaultChannels}</h3>
                  <ul className="diagnostics-items">
                    {(sourceConfigInfo.default_channels.length === 0 ? [t.diagnosticsNone] : sourceConfigInfo.default_channels).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="diagnostics-section">
                  <h3>{t.sourceConfigCustomChannels}</h3>
                  {Object.keys(sourceConfigInfo.custom_channels).length === 0 ? (
                    <p className="hint">{t.diagnosticsNone}</p>
                  ) : (
                    <dl className="diagnostics-list">
                      {Object.entries(sourceConfigInfo.custom_channels).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
              </div>
            )}

            <div className="guide-actions">
              <button className="btn btn-primary" onClick={() => setShowSourceConfig(false)}>{t.sourceConfigClose}</button>
            </div>
          </div>
        </div>
      )}

      <div className="app-shell">
        <header className="topbar">
          <div>
            <h1>CondaTool</h1>
            <p>{t.appSubtitle}</p>
          </div>
          <div className="topbar-actions">
            <div className="theme-switch" role="group" aria-label={t.themeAria}>
              <button
                className={`theme-switch-btn ${themeMode === "light" ? "active" : ""}`}
                onClick={() => handleThemeModeChange("light")}
              >
                {t.themeLight}
              </button>
              <button
                className={`theme-switch-btn ${themeMode === "dark" ? "active" : ""}`}
                onClick={() => handleThemeModeChange("dark")}
              >
                {t.themeDark}
              </button>
              <button
                className={`theme-switch-btn ${themeMode === "system" ? "active" : ""}`}
                onClick={() => handleThemeModeChange("system")}
              >
                {t.themeSystem}
              </button>
            </div>
            <div className="theme-switch" role="group" aria-label={t.langAria}>
              <button
                className={`theme-switch-btn ${locale === "zh" ? "active" : ""}`}
                onClick={() => handleLocaleChange("zh")}
              >
                中文
              </button>
              <button
                className={`theme-switch-btn ${locale === "en" ? "active" : ""}`}
                onClick={() => handleLocaleChange("en")}
              >
                English
              </button>
            </div>
            <button className="btn btn-secondary" onClick={() => handleLoadEnvs(true)} disabled={!!running}>{t.refreshEnv}</button>
            <button className="btn btn-secondary" onClick={() => void handleOpenSourceConfig()}>{t.sourceConfig}</button>
            <button className="btn btn-secondary" onClick={() => void handleOpenDiagnostics()}>{t.diagnostics}</button>
            <button className="btn btn-secondary" onClick={() => setShowFeatureGuide(true)}>{t.featureGuide}</button>
            <button className="btn btn-secondary" onClick={handleImportEnv} disabled={!!running}>{t.importEnv}</button>
            <button className="btn btn-primary" onClick={handleCreateEnv} disabled={!!running}>{t.createEnv}</button>
          </div>
        </header>

        {(error || condaInfo || running) && (
          <section className="status-row">
            {condaInfo && <span className="status-chip ok">Conda {condaInfo.conda_version}</span>}
            {running && <span className="status-chip busy">{t.running}: {running}</span>}
            {isForceNoRuntime && <span className="status-chip warn">{t.simulated}</span>}
            {error && <span className="status-chip err">{t.errorPrefix}: {error}</span>}
          </section>
        )}

        <main className="app-grid">
          <section className="panel env-panel">
            <div className="panel-head">
              <h2>{t.panelEnv}</h2>
              <span>{sortedEnvironments.length}</span>
            </div>
            <div className="panel-body env-list">
              {running?.startsWith("env-list") ? (
                <p className="hint">{t.loadingEnvs}</p>
              ) : sortedEnvironments.length === 0 ? (
                <p className="hint">{t.noEnvs}</p>
              ) : (
                sortedEnvironments.map((env) => {
                  const name = getEnvName(env.path);
                  const isBase = env.path === condaInfo?.root_prefix;
                  const isSelected = env.path === selectedEnvPath;

                  return (
                    <article
                      key={env.path}
                      className={`env-item${isSelected ? " selected" : ""}${isBase ? " base" : ""}`}
                    >
                      <button className="env-main" onClick={() => handleEnvSelect(env)} disabled={!!running}>
                        <strong>{isBase ? "base" : name}</strong>
                        <small>Python {env.python_version}</small>
                      </button>
                      <div className="env-actions">
                        <button className="icon-btn" onClick={() => handleCloneEnv(env)} disabled={!!running} title={t.clone}>
                          <CloneIcon />
                        </button>
                        {!isBase && (
                          <>
                            <button className="icon-btn" onClick={() => openExportModal(env)} disabled={!!running} title={t.export}>
                              <ExportIcon />
                            </button>
                            <button className="icon-btn" onClick={() => handleRenameEnv(env)} disabled={!!running} title={t.rename}>
                              <RenameIcon />
                            </button>
                            <button className="icon-btn danger" onClick={() => handleRemoveEnv(env)} disabled={!!running} title={t.remove}>
                              <RemoveIcon />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="panel package-panel">
            <div className="panel-head">
              <h2>{t.panelPkg}</h2>
              <span>{selectedEnvName || t.noSelectedEnv}</span>
            </div>
            <div className="panel-tools">
              <input
                type="search"
                placeholder={t.searchPkg}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={!selectedEnvPath}
              />
            </div>
            <div className="panel-body table-wrap">
              {!selectedEnvPath ? (
                <p className="hint">{t.selectEnvHint}</p>
              ) : running?.startsWith("pkg-list") ? (
                <p className="hint">{t.loadingPkgs}</p>
              ) : filteredPackages.length === 0 ? (
                <p className="hint">{t.noMatchedPkg}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{t.name}</th>
                      <th>{t.version}</th>
                      <th>{t.channel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPackages.map((pkg, i) => (
                      <tr key={`${pkg.name}-${i}`}>
                        <td>{pkg.name}</td>
                        <td>{pkg.version}</td>
                        <td>{pkg.channel || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="panel log-panel">
            <div className="panel-head">
              <h2>{t.panelLog}</h2>
              <button className="btn btn-ghost" onClick={clearLogs} disabled={logs.length === 0 && pendingLogsRef.current.length === 0}>{t.clear}</button>
            </div>
            <div className="panel-body log-body" ref={logContainerRef}>
              {logs.length === 0 ? <em>{t.startupProbe}</em> : logs.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export default App;
