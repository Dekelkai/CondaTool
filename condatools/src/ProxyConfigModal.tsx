import { useEffect, useState } from "react";
import type { Translation } from "./i18n";

interface ProxyConfig {
  http: string;
  https: string;
  ssl_verify: boolean;
}

interface ProxyConfigModalProps {
  t: Translation;
  proxyConfig: ProxyConfig | null;
  running: string | null;
  onRefresh: () => void;
  onSave: (config: ProxyConfig) => void;
  onClear: () => void;
  onClose: () => void;
}

export function ProxyConfigModal({ t, proxyConfig, running, onRefresh, onSave, onClear, onClose }: ProxyConfigModalProps) {
  const [http, setHttp] = useState("");
  const [https, setHttps] = useState("");
  const [sslVerify, setSslVerify] = useState(true);

  useEffect(() => {
    if (proxyConfig) {
      setHttp(proxyConfig.http);
      setHttps(proxyConfig.https);
      setSslVerify(proxyConfig.ssl_verify);
    }
  }, [proxyConfig]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    onSave({ http: http.trim(), https: https.trim(), ssl_verify: sslVerify });
  };

  return (
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide-card diagnostics-card" onClick={(e) => e.stopPropagation()}>
        <div className="diagnostics-head">
          <h2>{t.proxyConfigTitle}</h2>
          <button className="btn btn-secondary" onClick={onRefresh} disabled={!!running}>
            {t.proxyConfigRefresh}
          </button>
        </div>

        {!proxyConfig ? (
          <p>{t.proxyConfigLoading}</p>
        ) : (
          <div className="proxy-config-form">
            <div className="input-modal-field">
              <label className="input-modal-label">{t.proxyConfigHttp}</label>
              <input
                type="text"
                className="input-modal-input"
                placeholder={t.proxyConfigPlaceholder}
                value={http}
                onChange={(e) => setHttp(e.target.value)}
              />
            </div>

            <div className="input-modal-field">
              <label className="input-modal-label">{t.proxyConfigHttps}</label>
              <input
                type="text"
                className="input-modal-input"
                placeholder={t.proxyConfigPlaceholder}
                value={https}
                onChange={(e) => setHttps(e.target.value)}
              />
            </div>

            <div className="proxy-config-checkbox-row">
              <input
                type="checkbox"
                id="proxy-ssl-verify"
                checked={sslVerify}
                onChange={(e) => setSslVerify(e.target.checked)}
              />
              <label htmlFor="proxy-ssl-verify">{t.proxyConfigSslVerify}</label>
            </div>
          </div>
        )}

        <div className="guide-actions">
          <button className="btn btn-ghost" onClick={onClear} disabled={!!running || !proxyConfig}>
            {t.proxyConfigClear}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            {t.proxyConfigClose}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!!running || !proxyConfig}>
            {t.proxyConfigSave}
          </button>
        </div>
      </div>
    </div>
  );
}
