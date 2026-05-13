import React, { useState } from 'react';

interface ExportModalProps {
  envName: string;
  isOpen: boolean;
  locale: 'zh' | 'en';
  onClose: () => void;
  onExport: (options: { format: 'yml' | 'txt'; noBuilds: boolean }) => void;
}

const InfoTooltip = ({ text }: { text: string }) => (
  <span title={text} className="export-modal-info-tip">
    ?
  </span>
);

export const ExportModal: React.FC<ExportModalProps> = ({ envName, isOpen, locale, onClose, onExport }) => {
  const [format, setFormat] = useState<'yml' | 'txt'>('yml');
  const [noBuilds, setNoBuilds] = useState(true);

  if (!isOpen) return null;

  const handleExportClick = () => {
    onExport({ format, noBuilds });
  };

  const text = locale === 'zh'
    ? {
        title: '导出环境',
        format: '导出格式',
        yml: 'YML (推荐)',
        txt: 'TXT (pip 兼容)',
        advanced: '高级选项',
        noBuilds: '移除构建版本号',
        noBuildsTip: '勾选后，导出的文件中将不包含具体的构建版本号 (如 py39h6e24b1b_0)。这会提高跨平台的兼容性，但可能降低环境复现的精确度。',
        cancel: '取消',
        confirm: '继续并选择保存位置',
      }
    : {
        title: 'Export Environment',
        format: 'Export Format',
        yml: 'YML (Recommended)',
        txt: 'TXT (pip compatible)',
        advanced: 'Advanced Options',
        noBuilds: 'Remove build numbers',
        noBuildsTip: 'If enabled, build identifiers (for example py39h6e24b1b_0) are removed for better cross-platform compatibility, with slightly less exact reproducibility.',
        cancel: 'Cancel',
        confirm: 'Continue and choose save path',
      };

  return (
    <div className="guide-overlay">
      <div className="guide-card export-modal-card">
        <h2>{text.title}: {envName}</h2>

        <div className="export-modal-section">
          <label className="export-modal-label">{text.format}</label>
          <div className="export-modal-radio-group">
            <label className="export-modal-radio">
              <input type="radio" name="format" value="yml" checked={format === 'yml'} onChange={() => setFormat('yml')} />
              {text.yml}
            </label>
            <label className="export-modal-radio">
              <input type="radio" name="format" value="txt" checked={format === 'txt'} onChange={() => setFormat('txt')} />
              {text.txt}
            </label>
          </div>
        </div>

        <div className="export-modal-section">
          <label className="export-modal-label">{text.advanced}</label>
          <div className="export-modal-checkbox-row">
            <input type="checkbox" id="noBuilds" checked={noBuilds} onChange={(e) => setNoBuilds(e.target.checked)} />
            <label htmlFor="noBuilds">{text.noBuilds}</label>
            <InfoTooltip text={text.noBuildsTip} />
          </div>
        </div>

        <div className="guide-actions">
          <button onClick={onClose} className="btn btn-secondary">{text.cancel}</button>
          <button onClick={handleExportClick} className="btn btn-primary">{text.confirm}</button>
        </div>
      </div>
    </div>
  );
};
