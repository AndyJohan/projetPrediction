import { useEffect, useState } from 'react';
import { CATEGORY_VALUES, formatCategoryLabel } from '../constants/filterOptions';
import { fetchParametres, saveParametres } from '../services/parametreApi';

const DEFAULT_STATE = {
  seuils: { critique: 80, eleve: 65, moyen: 45 },
  notifications: {
    sms: 'Equipe terrain',
    email: 'Direction operations',
    webhook: 'Portail maintenance',
    dailySummary: true,
  },
  assistant: {
    defaultPeriodMode: 'latest',
    defaultCategory: 'ALL',
    requestTimeoutSeconds: 60,
    includeDatabaseContext: true,
    maxHistoryMessages: 20,
  },
  import: {
    skipOperationalValues: true,
    ignoreInvalidDates: true,
    normalizeLabels: true,
    duplicatePolicy: 'skip',
  },
  dashboard: {
    defaultCategory: 'ALL',
    autoSelectLatestPeriod: true,
    trendYAxisMax: 10,
    showAssistantContext: true,
  },
};

function ParametrePage() {
  const [formState, setFormState] = useState(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    let isMounted = true;

    const loadParametres = async () => {
      try {
        const data = await fetchParametres();
        if (!isMounted) {
          return;
        }

        setFormState({
          seuils: { ...DEFAULT_STATE.seuils, ...(data.seuils ?? {}) },
          notifications: { ...DEFAULT_STATE.notifications, ...(data.notifications ?? {}) },
          assistant: { ...DEFAULT_STATE.assistant, ...(data.assistant ?? {}) },
          import: { ...DEFAULT_STATE.import, ...(data.import ?? {}) },
          dashboard: { ...DEFAULT_STATE.dashboard, ...(data.dashboard ?? {}) },
        });
      } catch (error) {
        if (isMounted) {
          setFeedback({
            type: 'error',
            message: "Impossible de charger les parametres pour le moment.",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadParametres();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateSection = (section, key, value) => {
    setFormState((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const saved = await saveParametres(formState);
      setFormState({
        seuils: { ...DEFAULT_STATE.seuils, ...(saved.seuils ?? {}) },
        notifications: { ...DEFAULT_STATE.notifications, ...(saved.notifications ?? {}) },
        assistant: { ...DEFAULT_STATE.assistant, ...(saved.assistant ?? {}) },
        import: { ...DEFAULT_STATE.import, ...(saved.import ?? {}) },
        dashboard: { ...DEFAULT_STATE.dashboard, ...(saved.dashboard ?? {}) },
      });
      setFeedback({
        type: 'success',
        message: 'Parametres sauvegardes avec succes.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error?.response?.data?.message ||
          "La sauvegarde a echoue. Verifiez les valeurs saisies.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="section page-parametre">
      <header className="topbar">
        <div>
          <p className="eyebrow">Parametre</p>
          <h1>Reglages de la plateforme</h1>
        </div>
        <div className="topbar-actions">
          <button className="primary-button" type="button" onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </header>

      <div className="section-header">
        <div>
          <h2>Configuration projet</h2>
          <p className="muted">
            Reglages metier pour les alertes, l assistant IA, les imports et le dashboard.
          </p>
        </div>
      </div>

      {feedback.message ? (
        <div className={`settings-feedback ${feedback.type === 'error' ? 'error' : 'success'}`}>
          {feedback.message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="card">
          <p className="muted">Chargement des parametres...</p>
        </div>
      ) : (
        <div className="settings-grid">
          <div className="card settings-card">
            <div className="card-header">
              <div>
                <h3>Seuils d'alerte</h3>
                <span className="muted">Pilotage des niveaux de criticite</span>
              </div>
            </div>
            <div className="settings-form-grid">
              <label className="settings-field">
                <span>Critique (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formState.seuils.critique}
                  onChange={(event) =>
                    updateSection('seuils', 'critique', Number(event.target.value))
                  }
                />
              </label>
              <label className="settings-field">
                <span>Eleve (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formState.seuils.eleve}
                  onChange={(event) =>
                    updateSection('seuils', 'eleve', Number(event.target.value))
                  }
                />
              </label>
              <label className="settings-field">
                <span>Moyen (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formState.seuils.moyen}
                  onChange={(event) =>
                    updateSection('seuils', 'moyen', Number(event.target.value))
                  }
                />
              </label>
            </div>
          </div>

          <div className="card settings-card">
            <div className="card-header">
              <div>
                <h3>Notifications</h3>
                <span className="muted">Qui recoit les alertes et les syntheses</span>
              </div>
            </div>
            <div className="settings-form-grid">
              <label className="settings-field">
                <span>Canal SMS</span>
                <input
                  type="text"
                  value={formState.notifications.sms}
                  onChange={(event) => updateSection('notifications', 'sms', event.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Canal Email</span>
                <input
                  type="text"
                  value={formState.notifications.email}
                  onChange={(event) => updateSection('notifications', 'email', event.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Webhook</span>
                <input
                  type="text"
                  value={formState.notifications.webhook}
                  onChange={(event) =>
                    updateSection('notifications', 'webhook', event.target.value)
                  }
                />
              </label>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={formState.notifications.dailySummary}
                  onChange={(event) =>
                    updateSection('notifications', 'dailySummary', event.target.checked)
                  }
                />
                <span>Envoyer une synthese quotidienne</span>
              </label>
            </div>
          </div>

          <div className="card settings-card">
            <div className="card-header">
              <div>
                <h3>Assistant IA</h3>
                <span className="muted">Comportement par defaut de l assistant</span>
              </div>
            </div>
            <div className="settings-form-grid">
              <label className="settings-field">
                <span>Mode de periode</span>
                <select
                  value={formState.assistant.defaultPeriodMode}
                  onChange={(event) =>
                    updateSection('assistant', 'defaultPeriodMode', event.target.value)
                  }
                >
                  <option value="latest">Derniere periode disponible</option>
                  <option value="manual">Periode exigee</option>
                </select>
              </label>
              <label className="settings-field">
                <span>Categorie par defaut</span>
                <select
                  value={formState.assistant.defaultCategory}
                  onChange={(event) =>
                    updateSection('assistant', 'defaultCategory', event.target.value)
                  }
                >
                    {CATEGORY_VALUES.map((option) => (
                      <option key={option} value={option}>
                        {formatCategoryLabel(option)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Timeout assistant (s)</span>
                <input
                  type="number"
                  min="5"
                  value={formState.assistant.requestTimeoutSeconds}
                  onChange={(event) =>
                    updateSection(
                      'assistant',
                      'requestTimeoutSeconds',
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label className="settings-field">
                <span>Historique local max</span>
                <input
                  type="number"
                  min="1"
                  value={formState.assistant.maxHistoryMessages}
                  onChange={(event) =>
                    updateSection('assistant', 'maxHistoryMessages', Number(event.target.value))
                  }
                />
              </label>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={formState.assistant.includeDatabaseContext}
                  onChange={(event) =>
                    updateSection('assistant', 'includeDatabaseContext', event.target.checked)
                  }
                />
                <span>Injecter le contexte BD dans les prompts</span>
              </label>
            </div>
          </div>

          <div className="card settings-card">
            <div className="card-header">
              <div>
                <h3>Import des fichiers</h3>
                <span className="muted">Regles appliquees lors du chargement Excel</span>
              </div>
            </div>
            <div className="settings-form-grid">
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={formState.import.skipOperationalValues}
                  onChange={(event) =>
                    updateSection('import', 'skipOperationalValues', event.target.checked)
                  }
                />
                <span>Ignorer les valeurs 0 operationnelles</span>
              </label>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={formState.import.ignoreInvalidDates}
                  onChange={(event) =>
                    updateSection('import', 'ignoreInvalidDates', event.target.checked)
                  }
                />
                <span>Ignorer les dates invalides</span>
              </label>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={formState.import.normalizeLabels}
                  onChange={(event) =>
                    updateSection('import', 'normalizeLabels', event.target.checked)
                  }
                />
                <span>Normaliser les libelles importes</span>
              </label>
              <label className="settings-field">
                <span>Gestion des doublons</span>
                <select
                  value={formState.import.duplicatePolicy}
                  onChange={(event) =>
                    updateSection('import', 'duplicatePolicy', event.target.value)
                  }
                >
                  <option value="skip">Ignorer</option>
                  <option value="update">Mettre a jour</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card settings-card settings-card-wide">
            <div className="card-header">
              <div>
                <h3>Dashboard & lecture</h3>
                <span className="muted">Parametres qui influencent les pages historiques et assistant</span>
              </div>
            </div>
            <div className="settings-form-grid">
              <label className="settings-field">
                <span>Categorie dashboard par defaut</span>
                <select
                  value={formState.dashboard.defaultCategory}
                  onChange={(event) =>
                    updateSection('dashboard', 'defaultCategory', event.target.value)
                  }
                >
                    {CATEGORY_VALUES.map((option) => (
                      <option key={option} value={option}>
                        {formatCategoryLabel(option)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Echelle max graphe pannes</span>
                <input
                  type="number"
                  min="1"
                  value={formState.dashboard.trendYAxisMax}
                  onChange={(event) =>
                    updateSection('dashboard', 'trendYAxisMax', Number(event.target.value))
                  }
                />
              </label>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={formState.dashboard.autoSelectLatestPeriod}
                  onChange={(event) =>
                    updateSection('dashboard', 'autoSelectLatestPeriod', event.target.checked)
                  }
                />
                <span>Selectionner automatiquement la derniere periode</span>
              </label>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={formState.dashboard.showAssistantContext}
                  onChange={(event) =>
                    updateSection('dashboard', 'showAssistantContext', event.target.checked)
                  }
                />
                <span>Afficher le contexte compris par l assistant</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ParametrePage;
