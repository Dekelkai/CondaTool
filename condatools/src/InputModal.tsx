import { useEffect, useRef, useState } from "react";

interface InputField {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  optional?: boolean;
}

interface InputModalProps {
  title: string;
  fields: InputField[];
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (values: string[]) => void;
  onCancel: () => void;
  validate?: (values: string[]) => string | null;
}

export function InputModal({ title, fields, confirmLabel, cancelLabel, onConfirm, onCancel, validate }: InputModalProps) {
  const [values, setValues] = useState<string[]>(() => fields.map((f) => f.defaultValue || ""));
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动聚焦第一个输入框
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleConfirm = () => {
    // 校验必填字段
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].optional && !values[i].trim()) {
        setError(`${fields[i].label} 不能为空`);
        return;
      }
    }

    // 自定义校验
    if (validate) {
      const validationError = validate(values);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    onConfirm(values.map((v) => v.trim()));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    }
  };

  const updateValue = (index: number, value: string) => {
    setValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setError(null);
  };

  return (
    <div className="guide-overlay" onClick={onCancel}>
      <div className="guide-card input-modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>

        <div className="input-modal-fields">
          {fields.map((field, i) => (
            <div key={i} className="input-modal-field">
              <label className="input-modal-label">
                {field.label}
                {field.optional && <span className="input-modal-optional">（可选）</span>}
              </label>
              <input
                ref={i === 0 ? firstInputRef : undefined}
                type="text"
                className="input-modal-input"
                placeholder={field.placeholder}
                value={values[i]}
                onChange={(e) => updateValue(i, e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          ))}
        </div>

        {error && <p className="input-modal-error">{error}</p>}

        <div className="guide-actions">
          <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn btn-primary" onClick={handleConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
