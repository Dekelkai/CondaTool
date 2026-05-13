import { useEffect, useRef, useState } from "react";
import type { Translation } from "./i18n";

interface SearchResult {
  name: string;
  version: string;
  build: string;
  channel: string;
}

interface PackageSearchModalProps {
  t: Translation;
  running: string | null;
  onSearch: (query: string) => void;
  onInstall: (pkg: { name: string; version: string }) => void;
  onClose: () => void;
  searchResults: SearchResult[] | null;
  searchLoading: boolean;
}

export function PackageSearchModal({ t, running, onSearch, onInstall, onClose, searchResults, searchLoading }: PackageSearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSearch = () => {
    if (!query.trim()) return;
    onSearch(query.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide-card diagnostics-card" onClick={(e) => e.stopPropagation()}>
        <div className="diagnostics-head">
          <h2>{t.packageSearchTitle}</h2>
        </div>

        <div className="pkg-search-input-row">
          <input
            ref={inputRef}
            type="text"
            className="input-modal-input"
            placeholder={t.packageSearchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn btn-primary" onClick={handleSearch} disabled={!!running || !query.trim()}>
            {t.packageSearch}
          </button>
        </div>

        <div className="pkg-search-results">
          {searchLoading ? (
            <p className="hint">{t.packageSearchSearching}</p>
          ) : searchResults === null ? (
            <p className="hint">{t.packageSearchPlaceholder}</p>
          ) : searchResults.length === 0 ? (
            <p className="hint">{t.packageSearchNoResults}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t.name}</th>
                  <th>{t.version}</th>
                  <th>{t.channel}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((pkg, i) => (
                  <tr key={`${pkg.name}-${pkg.version}-${i}`}>
                    <td>{pkg.name}</td>
                    <td>{pkg.version}</td>
                    <td>{pkg.channel || "-"}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        onClick={() => onInstall({ name: pkg.name, version: pkg.version })}
                        disabled={!!running}
                      >
                        {t.packageSearchInstall}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="guide-actions">
          <button className="btn btn-primary" onClick={onClose}>{t.packageSearchClose}</button>
        </div>
      </div>
    </div>
  );
}
