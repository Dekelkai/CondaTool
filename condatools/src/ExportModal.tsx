import React, { useState } from 'react';

interface ExportModalProps {
  envName: string;
  isOpen: boolean;
  locale: 'zh' | 'en';
  onClose: () => void;
  onExport: (options: { format: 'yml' | 'txt'; noBuilds: boolean }) => void;
}

const InfoTooltip = ({ text }: { text: string }) => (
  <span title={text} style={{ cursor: 'help', marginLeft: '8px', borderBottom: '1px dotted', color: '#888' }}>
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
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(10, 16, 26, 0.45)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff', color: '#152033', padding: '24px', borderRadius: '14px',
        width: '430px', border: '1px solid #d7e2ef', boxShadow: '0 24px 44px rgba(6, 24, 44, 0.24)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '24px' }}>{text.title}: {envName}</h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>{text.format}</label>
          <div>
            <label style={{ marginRight: '16px' }}>
              <input type="radio" name="format" value="yml" checked={format === 'yml'} onChange={() => setFormat('yml')} />
              {text.yml}
            </label>
            <label>
              <input type="radio" name="format" value="txt" checked={format === 'txt'} onChange={() => setFormat('txt')} />
              {text.txt}
            </label>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px' }}>{text.advanced}</label>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <input type="checkbox" id="noBuilds" checked={noBuilds} onChange={(e) => setNoBuilds(e.target.checked)} />
            <label htmlFor="noBuilds" style={{ marginLeft: '8px' }}>{text.noBuilds}</label>
            <InfoTooltip text={text.noBuildsTip} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} className="btn btn-secondary">{text.cancel}</button>
          <button onClick={handleExportClick} className="btn btn-primary">{text.confirm}</button>
        </div>
      </div>
    </div>
  );
};
