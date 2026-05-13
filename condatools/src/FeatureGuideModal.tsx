import type { Translation } from "./i18n";

interface FeatureGuideModalProps {
  t: Translation;
  onClose: () => void;
}

export function FeatureGuideModal({ t, onClose }: FeatureGuideModalProps) {
  return (
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
          <button className="btn btn-primary" onClick={onClose}>{t.closeGuide}</button>
        </div>
      </div>
    </div>
  );
}
