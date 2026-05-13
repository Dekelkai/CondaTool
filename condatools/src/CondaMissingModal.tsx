import type { Translation } from "./i18n";

interface CondaMissingModalProps {
  t: Translation;
  onOpenLink: (url: string) => void;
  onClose: () => void;
}

export function CondaMissingModal({ t, onOpenLink, onClose }: CondaMissingModalProps) {
  return (
    <div className="guide-overlay">
      <div className="guide-card">
        <h2>{t.condaMissingTitle}</h2>
        <p>{t.condaMissingDesc1}</p>
        <p>{t.condaMissingDesc2}</p>
        <div className="guide-links">
          <button className="link-button" onClick={() => onOpenLink("https://github.com/Dekelkai/CondaTool#-独立打包目标condatoolexe")}>{t.installConda}</button>
          <button className="link-button" onClick={() => onOpenLink("https://mamba.readthedocs.io/en/latest/installation/micromamba-installation.html")}>{t.installMiniconda}</button>
        </div>
        <div className="guide-actions">
          <button className="btn btn-primary" onClick={onClose}>{t.understood}</button>
        </div>
      </div>
    </div>
  );
}
