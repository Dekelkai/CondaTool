import type { Translation } from "./i18n";

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

interface DiagnosticsModalProps {
  t: Translation;
  diagnosticsInfo: DiagnosticsInfo | null;
  running: string | null;
  onRefresh: () => void;
  onClose: () => void;
  onCopy: () => void;
}

export function DiagnosticsModal({ t, diagnosticsInfo, running, onRefresh, onClose, onCopy }: DiagnosticsModalProps) {
  return (
    <div className="guide-overlay">
      <div className="guide-card diagnostics-card">
        <div className="diagnostics-head">
          <h2>{t.diagnosticsTitle}</h2>
          <div className="diagnostics-head-actions">
            <button className="btn btn-secondary" onClick={onCopy} disabled={!diagnosticsInfo}>
              {t.diagnosticsCopy}
            </button>
            <button className="btn btn-secondary" onClick={onRefresh} disabled={!!running}>
              {t.diagnosticsRefresh}
            </button>
          </div>
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
          <button className="btn btn-primary" onClick={onClose}>{t.diagnosticsClose}</button>
        </div>
      </div>
    </div>
  );
}
