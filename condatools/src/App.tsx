import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { confirm, save, open, message } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExportModal } from "./ExportModal";
import { InputModal } from "./InputModal";
import { DiagnosticsModal } from "./DiagnosticsModal";
import { SourceConfigModal } from "./SourceConfigModal";
import { ProxyConfigModal } from "./ProxyConfigModal";
import { PackageSearchModal } from "./PackageSearchModal";
import { FeatureGuideModal } from "./FeatureGuideModal";
import { CondaMissingModal } from "./CondaMissingModal";
import { i18n, type Locale } from "./i18n";
import { useCommandRunner } from "./hooks/useCommandRunner";
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

interface ProxyConfig {
  http: string;
  https: string;
  ssl_verify: boolean;
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

const MAX_LOG_LINES = 600;
const LOG_FLUSH_DELAY_MS = 48;
const LOG_BATCH_SIZE = 20;

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
  const [showProxyConfig, setShowProxyConfig] = useState(false);
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig | null>(null);
  const [showPackageSearch, setShowPackageSearch] = useState(false);
  const [packageSearchResults, setPackageSearchResults] = useState<{ name: string; version: string; build: string; channel: string }[] | null>(null);
  const [packageSearchLoading, setPackageSearchLoading] = useState(false);

  // InputModal 状态
  interface InputModalConfig {
    title: string;
    fields: { label: string; placeholder?: string; defaultValue?: string; optional?: boolean }[];
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: (values: string[]) => void;
    validate?: (values: string[]) => string | null;
  }
  const [inputModal, setInputModal] = useState<InputModalConfig | null>(null);

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
    // 给普通日志行添加时间戳（不给分隔行和错误前缀加）
    const shouldTimestamp = !line.startsWith("---") && !line.startsWith("\n---") && !line.startsWith("[ERR]") && !line.startsWith("[SIMULATED]");
    const timestampedLine = shouldTimestamp
      ? `[${new Date().toLocaleTimeString()}] ${line}`
      : line;
    pendingLogsRef.current.push(timestampedLine);

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

  const { runCommand } = useCommandRunner<CommandMeta>({
    isForceNoRuntime,
    queueLog,
    handleCommandError,
    clearError: () => setError(null),
    setRunning,
    activeCommandRef,
    activeCommandResultRef,
    activeCommandDoneRef,
  });

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
              // probe 成功后自动加载环境列表
              void runCommand("env-list");
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
          } else if (["source-config-add-channel", "source-config-remove-channel", "source-config-move-channel"].includes(cmd)) {
            if (result.ok) {
              setSourceConfigInfo(result.data);
            } else {
              handleCommandError(result.error);
            }
          } else if (cmd === "proxy-get") {
            if (result.ok) {
              setProxyConfig(result.data);
            } else {
              handleCommandError(result.error);
            }
          } else if (cmd === "proxy-set") {
            if (result.ok) {
              setProxyConfig(result.data);
            } else {
              handleCommandError(result.error);
            }
          } else if (cmd === "proxy-clear") {
            if (result.ok) {
              setProxyConfig(result.data);
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
          } else if (["pkg-install", "pkg-remove", "pkg-upgrade", "pkg-upgrade-all"].includes(cmd)) {
            const requestedEnvPath = activeCommandRef.current?.envPath;
            if (result.ok) {
              queueLog(`--- Package operation successful. Refreshing packages... ---`);
              if (requestedEnvPath && requestedEnvPath === selectedEnvPathRef.current) {
                void runCommand("pkg-list", ["--prefix", requestedEnvPath], { command: "pkg-list", envPath: requestedEnvPath });
              }
            } else {
              handleCommandError(result.error);
            }
          } else if (cmd === "pkg-search") {
            setPackageSearchLoading(false);
            if (result.ok) {
              setPackageSearchResults(result.data);
            } else {
              handleCommandError(result.error);
              setPackageSearchResults([]);
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

  const handleCreateEnv = () => {
    if (running) return;
    setInputModal({
      title: t.createEnv,
      fields: [
        { label: t.createPrompt, placeholder: "my-new-env", defaultValue: "my-new-env" },
        { label: t.pythonPrompt, placeholder: "3.10", defaultValue: "3.10" },
      ],
      confirmLabel: t.createEnv,
      cancelLabel: t.closeGuide,
      validate: ([name]) => {
        if (isEnvNameExists(name)) return t.nameExists(name);
        return null;
      },
      onConfirm: ([name, pythonVersion]) => {
        setInputModal(null);
        void runCommand("env-create", ["--name", name, "--python", pythonVersion]);
      },
    });
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

  const handleRenameEnv = (env: Environment) => {
    if (running) return;
    const oldName = getEnvName(env.path);
    setInputModal({
      title: t.rename,
      fields: [
        { label: t.renamePrompt(oldName), defaultValue: oldName },
      ],
      confirmLabel: t.rename,
      cancelLabel: t.closeGuide,
      validate: ([newName]) => {
        if (newName.toLowerCase() === oldName.toLowerCase()) return null; // 无变化，静默关闭
        if (isEnvNameExists(newName)) return t.nameExists(newName);
        return null;
      },
      onConfirm: ([newName]) => {
        setInputModal(null);
        if (newName.toLowerCase() === oldName.toLowerCase()) return;
        void runCommand("env-rename", ["--old-prefix", env.path, "--new-name", newName], {
          command: "env-rename",
          envPath: env.path,
          nextSelectedEnvName: selectedEnvPath === env.path ? newName : undefined,
        });
      },
    });
  };

  const handleCloneEnv = (env: Environment) => {
    if (running) return;
    const sourceName = getEnvName(env.path);
    setInputModal({
      title: t.clone,
      fields: [
        { label: t.clonePrompt(sourceName), defaultValue: `${sourceName}-clone` },
      ],
      confirmLabel: t.clone,
      cancelLabel: t.closeGuide,
      validate: ([destName]) => {
        if (destName.toLowerCase() === sourceName.toLowerCase()) return t.cloneNameSame;
        if (isEnvNameExists(destName)) return t.nameExists(destName);
        return null;
      },
      onConfirm: ([destName]) => {
        setInputModal(null);
        void runCommand("env-clone", ["--source-prefix", env.path, "--dest-name", destName]);
      },
    });
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

    setInputModal({
      title: t.importEnv,
      fields: [
        { label: t.importPrompt, placeholder: "my-imported-env" },
      ],
      confirmLabel: t.importEnv,
      cancelLabel: t.closeGuide,
      validate: ([name]) => {
        if (isEnvNameExists(name)) return t.nameExists(name);
        return null;
      },
      onConfirm: ([name]) => {
        setInputModal(null);
        void runCommand("env-import", ["--file", filePath, "--name", name]);
      },
    });
  };

  const handleInstallPackage = () => {
    if (running || !selectedEnvPath) return;
    setInputModal({
      title: t.packageInstall,
      fields: [
        { label: t.packageInstallPrompt, placeholder: "numpy" },
        { label: t.packageVersionPrompt, placeholder: "1.24.0", optional: true },
      ],
      confirmLabel: t.packageInstall,
      cancelLabel: t.closeGuide,
      onConfirm: ([packageName, packageVersion]) => {
        setInputModal(null);
        void runCommand("pkg-install", ["--prefix", selectedEnvPath!, "--name", packageName, packageVersion ? "--version" : "", packageVersion], {
          command: "pkg-install",
          envPath: selectedEnvPath!,
        });
      },
    });
  };

  const handleRemovePackage = async (pkg: Package) => {
    if (running || !selectedEnvPath) return;
    const confirmed = await confirm(t.packageRemoveConfirm(pkg.name), { title: t.packageRemoveConfirmTitle });
    if (!confirmed) return;

    void runCommand("pkg-remove", ["--prefix", selectedEnvPath, "--name", pkg.name], {
      command: "pkg-remove",
      envPath: selectedEnvPath,
    });
  };

  const handleUpgradePackage = async (pkg: Package) => {
    if (running || !selectedEnvPath) return;
    const confirmed = await confirm(t.packageUpgradeConfirm(pkg.name), { title: t.packageUpgradeConfirmTitle });
    if (!confirmed) return;

    void runCommand("pkg-upgrade", ["--prefix", selectedEnvPath, "--name", pkg.name], {
      command: "pkg-upgrade",
      envPath: selectedEnvPath,
    });
  };

  const handleUpgradeAllPackages = async () => {
    if (running || !selectedEnvPath) return;
    const confirmed = await confirm(t.packageUpgradeAllConfirm, { title: t.packageUpgradeAllConfirmTitle });
    if (!confirmed) return;

    void runCommand("pkg-upgrade-all", ["--prefix", selectedEnvPath], {
      command: "pkg-upgrade-all",
      envPath: selectedEnvPath,
    });
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

  const handleAddChannel = async (channel: string) => {
    if (running) return;
    await runCommand("source-config-add-channel", ["--channel", channel]);
  };

  const handleRemoveChannel = async (channel: string) => {
    if (running) return;
    await runCommand("source-config-remove-channel", ["--channel", channel]);
  };

  const handleMoveChannel = async (channel: string, direction: "up" | "down") => {
    if (running) return;
    await runCommand("source-config-move-channel", ["--channel", channel, "--direction", direction]);
  };

  const handleOpenProxyConfig = async () => {
    setShowProxyConfig(true);
    if (running) return;
    await runCommand("proxy-get");
  };

  const handleSaveProxy = async (config: ProxyConfig) => {
    if (running) return;
    const args = ["--http", config.http, "--https", config.https, "--ssl-verify", String(config.ssl_verify)];
    const success = await runCommand("proxy-set", args);
    if (success) {
      queueLog(t.proxyConfigSaveSuccess);
    } else {
      await message(t.proxyConfigSaveFailed);
    }
  };

  const handleClearProxy = async () => {
    if (running) return;
    const success = await runCommand("proxy-clear", ["--ssl-verify", "true"]);
    if (success) {
      queueLog(t.proxyConfigClearSuccess);
    }
  };

  const handleSearchPackage = async (query: string) => {
    if (running) return;
    setPackageSearchLoading(true);
    setPackageSearchResults(null);
    await runCommand("pkg-search", ["--query", query]);
  };

  const handleInstallFromSearch = (pkg: { name: string; version: string }) => {
    if (running || !selectedEnvPath) return;
    setShowPackageSearch(false);
    void runCommand("pkg-install", ["--prefix", selectedEnvPath, "--name", pkg.name, "--version", pkg.version], {
      command: "pkg-install",
      envPath: selectedEnvPath,
    });
  };

  const handleCopyDiagnostics = () => {
    if (!diagnosticsInfo) return;
    const lines = [
      `Package Manager: ${diagnosticsInfo.package_manager_kind}`,
      `Executable Path: ${diagnosticsInfo.package_manager_path || "N/A"}`,
      `Conda Version: ${diagnosticsInfo.conda_version}`,
      `Python Version: ${diagnosticsInfo.python_version}`,
      `Root Prefix: ${diagnosticsInfo.root_prefix || "N/A"}`,
      `Active Environment: ${diagnosticsInfo.active_environment || "N/A"}`,
      `SSL Verify: ${String(diagnosticsInfo.ssl_verify ?? "N/A")}`,
      "",
      "Config Files:",
      ...diagnosticsInfo.config_files.map((f) => `  - ${f}`),
      "",
      "Channels:",
      ...diagnosticsInfo.channels.map((c) => `  - ${c}`),
      "",
      "Proxy:",
      ...(Object.keys(diagnosticsInfo.proxy_servers).length === 0
        ? ["  Not configured"]
        : Object.entries(diagnosticsInfo.proxy_servers).map(([k, v]) => `  ${k}: ${v}`)),
      "",
      "Environment Directories:",
      ...diagnosticsInfo.envs_directories.map((d) => `  - ${d}`),
      "",
      "Package Cache:",
      ...diagnosticsInfo.package_cache_directories.map((d) => `  - ${d}`),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      queueLog(t.diagnosticsCopySuccess);
    });
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

      {inputModal && (
        <InputModal
          title={inputModal.title}
          fields={inputModal.fields}
          confirmLabel={inputModal.confirmLabel}
          cancelLabel={inputModal.cancelLabel}
          validate={inputModal.validate}
          onConfirm={inputModal.onConfirm}
          onCancel={() => setInputModal(null)}
        />
      )}

      {showCondaInstallGuide && (
        <CondaMissingModal
          t={t}
          onOpenLink={openExternalLink}
          onClose={() => setShowCondaInstallGuide(false)}
        />
      )}

      {showFeatureGuide && (
        <FeatureGuideModal
          t={t}
          onClose={() => setShowFeatureGuide(false)}
        />
      )}

      {showDiagnostics && (
        <DiagnosticsModal
          t={t}
          diagnosticsInfo={diagnosticsInfo}
          running={running}
          onRefresh={() => void runCommand("diagnostics")}
          onClose={() => setShowDiagnostics(false)}
          onCopy={handleCopyDiagnostics}
        />
      )}

      {showSourceConfig && (
        <SourceConfigModal
          t={t}
          sourceConfigInfo={sourceConfigInfo}
          selectedSourcePreset={selectedSourcePreset}
          running={running}
          onPresetChange={setSelectedSourcePreset}
          onRefresh={() => void runCommand("source-config-get")}
          onApply={() => void handleApplySourcePreset()}
          onAddChannel={(channel) => void handleAddChannel(channel)}
          onRemoveChannel={(channel) => void handleRemoveChannel(channel)}
          onMoveChannel={(channel, dir) => void handleMoveChannel(channel, dir)}
          onClose={() => setShowSourceConfig(false)}
        />
      )}

      {showProxyConfig && (
        <ProxyConfigModal
          t={t}
          proxyConfig={proxyConfig}
          running={running}
          onRefresh={() => void runCommand("proxy-get")}
          onSave={(config) => void handleSaveProxy(config)}
          onClear={() => void handleClearProxy()}
          onClose={() => setShowProxyConfig(false)}
        />
      )}

      {showPackageSearch && (
        <PackageSearchModal
          t={t}
          running={running}
          onSearch={(query) => void handleSearchPackage(query)}
          onInstall={handleInstallFromSearch}
          onClose={() => { setShowPackageSearch(false); setPackageSearchResults(null); setPackageSearchLoading(false); }}
          searchResults={packageSearchResults}
          searchLoading={packageSearchLoading}
        />
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
            <button className="btn btn-secondary" onClick={() => void handleOpenProxyConfig()}>{t.proxyConfig}</button>
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
              <div className="package-actions">
                <button className="btn btn-primary" onClick={() => void handleInstallPackage()} disabled={!selectedEnvPath || !!running}>
                  {t.packageInstall}
                </button>
                <button className="btn btn-secondary" onClick={() => void handleUpgradeAllPackages()} disabled={!selectedEnvPath || !!running}>
                  {t.packageUpgradeAll}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowPackageSearch(true)}>
                  {t.packageSearch}
                </button>
              </div>
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
                      <th>{t.packageUpgrade}</th>
                      <th>{t.remove}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPackages.map((pkg, i) => (
                      <tr key={`${pkg.name}-${i}`}>
                        <td>{pkg.name}</td>
                        <td>{pkg.version}</td>
                        <td>{pkg.channel || "-"}</td>
                        <td>
                          <button className="btn btn-ghost" onClick={() => void handleUpgradePackage(pkg)} disabled={!!running}>
                            {t.packageUpgrade}
                          </button>
                        </td>
                        <td>
                          <button className="btn btn-ghost" onClick={() => void handleRemovePackage(pkg)} disabled={!!running}>
                            {t.packageRemove}
                          </button>
                        </td>
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
