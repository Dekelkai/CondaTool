import type { Translation } from "./i18n";

interface SourceConfigInfo {
  channels: string[];
  default_channels: string[];
  custom_channels: Record<string, string>;
  channel_priority: string;
  config_file: string;
  available_presets: string[];
}

interface SourceConfigModalProps {
  t: Translation;
  sourceConfigInfo: SourceConfigInfo | null;
  selectedSourcePreset: string;
  running: string | null;
  onPresetChange: (preset: string) => void;
  onRefresh: () => void;
  onApply: () => void;
  onClose: () => void;
}

export function SourceConfigModal({
  t,
  sourceConfigInfo,
  selectedSourcePreset,
  running,
  onPresetChange,
  onRefresh,
  onApply,
  onClose,
}: SourceConfigModalProps) {
  return (
    <div className="guide-overlay">
      <div className="guide-card diagnostics-card">
        <div className="diagnostics-head">
          <h2>{t.sourceConfigTitle}</h2>
          <button className="btn btn-secondary" onClick={onRefresh} disabled={!!running}>
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
                <select value={selectedSourcePreset} onChange={(e) => onPresetChange(e.target.value)} disabled={!!running}>
                  <option value="defaults">{t.sourceConfigDefaultsLabel}</option>
                  <option value="tuna">{t.sourceConfigTunaLabel}</option>
                </select>
                <button className="btn btn-primary" onClick={onApply} disabled={!!running}>
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
          <button className="btn btn-primary" onClick={onClose}>{t.sourceConfigClose}</button>
        </div>
      </div>
    </div>
  );
}
