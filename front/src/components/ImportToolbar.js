import { useEffect, useRef, useState } from 'react';
import { CATEGORY_OPTIONS, DEFAULT_IMPORT_YEAR, YEAR_OPTIONS } from '../constants/importOptions';
import { uploadHistoriqueFile } from '../services/historiqueApi';

function formatFileSize(size) {
  if (!size) {
    return 'Taille inconnue';
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} Ko`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 15v4h14v-4" />
    </svg>
  );
}

function ToastIcon({ type }) {
  if (type === 'success') {
    return (
      <svg
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 2.8 18a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

function ImportToolbar({ onSuccess }) {
  const inputRef = useRef(null);
  const [category, setCategory] = useState('');
  const [year, setYear] = useState(DEFAULT_IMPORT_YEAR);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const handlePickFile = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setToast(null);
  };

  const resetFileInput = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!file || !category) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('year', year);

    try {
      setIsUploading(true);
      setProgress(0);

      await uploadHistoriqueFile(formData, {
        onUploadProgress: (event) => {
          if (!event.total) {
            return;
          }
          setProgress(Math.round((event.loaded / event.total) * 100));
        },
      });

      setToast({ type: 'success', message: 'Import termine avec succes.' });
      resetFileInput();
      onSuccess?.();
    } catch (error) {
      const message =
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        "L'import a echoue.";
      setToast({ type: 'error', message });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const canImport = Boolean(file && category && !isUploading);
  const categoryHelpId = !category ? 'import-category-help' : undefined;
  const fileMeta = file
    ? `${formatFileSize(file.size)} pret a importer`
    : 'Classeur .xlsx ou .xls';
  const selectedFileLabel = file ? file.name : 'Aucun fichier selectionne';
  const uploadStatus = isUploading ? `Import en cours, ${progress}%` : 'Pret pour import Excel';

  const handleSubmit = async (event) => {
    event.preventDefault();
    await handleImport();
  };

  return (
    <form className="import-panel" onSubmit={handleSubmit}>
      <div className="import-panel-header">
        <div>
          <span className="import-panel-kicker">Import Excel</span>
          <strong>Ajouter un historique</strong>
        </div>
        <span className="import-panel-format">.xlsx / .xls</span>
      </div>

      <div className="import-panel-grid">
        <label className="import-field import-category-field" htmlFor="import-category">
          <span>Categorie</span>
          <select
            id="import-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={isUploading}
            aria-describedby={categoryHelpId}
          >
            <option value="">Choisir</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {!category ? (
            <small id="import-category-help">Requis pour classer les pannes.</small>
          ) : null}
        </label>

        <label className="import-field import-year-field" htmlFor="import-year">
          <span>Annee</span>
          <select
            id="import-year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            disabled={isUploading}
          >
            {YEAR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="import-file-zone">
          <label className="import-file-label" htmlFor="import-file">
            Fichier
          </label>
          <input
            ref={inputRef}
            id="import-file"
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <button
            type="button"
            className="import-file-button"
            onClick={handlePickFile}
            disabled={isUploading}
            aria-describedby="import-file-meta"
          >
            <span className="import-file-icon">
              <UploadIcon />
            </span>
            <span className="import-file-copy">
              <strong>{file ? file.name : 'Choisir un fichier Excel'}</strong>
              <small id="import-file-meta">{fileMeta}</small>
            </span>
          </button>
          {file ? (
            <button
              type="button"
              className="import-clear-button"
              onClick={resetFileInput}
              disabled={isUploading}
            >
              Retirer
            </button>
          ) : null}
        </div>

        <div className="import-actions">
          <button
            type="submit"
            className="primary-button import-submit-button"
            disabled={!canImport}
          >
            {isUploading ? 'Import en cours...' : 'Importer'}
          </button>
          <span className="import-status" aria-live="polite">
            {uploadStatus}
          </span>
          {(isUploading || progress > 0) && (
            <div
              className="import-progress"
              role="progressbar"
              aria-label="Progression de l'import"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </div>

      {file ? (
        <div className="import-selected-file" title={selectedFileLabel}>
          <span>Selection</span>
          <strong>{selectedFileLabel}</strong>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`import-toast ${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          <span aria-hidden="true" className="import-toast-icon">
            <ToastIcon type={toast.type} />
          </span>
          <span>{toast.message}</span>
        </div>
      ) : null}
    </form>
  );
}

export default ImportToolbar;
