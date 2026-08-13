import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CATEGORY_OPTIONS,
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  formatCategoryLabel,
} from '../constants/filterOptions';
import { useHistoriqueData } from '../hooks/useHistoriqueData';
import { sendAssistantMessage } from '../services/assistantApi';

const STORAGE_KEY = 'assistant-ia-session-history';
const STORAGE_TTL_MS = 30 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 2000;
const QUICK_PROMPTS = [
  {
    key: 'brief',
    label: 'Brief maintenance',
    description: 'Synthese courte, risques visibles et decisions a prendre.',
    icon: 'checklist',
    instruction:
      "Prepare un brief maintenance exploitable pour l'equipe de supervision. Structure la reponse en 5 parties : tendance generale, equipements critiques, signaux recurrents, risques immediats, decisions recommandees.",
  },
  {
    key: 'critical-equipment',
    label: 'Equipements critiques',
    description: 'Classe les equipements a surveiller en premier.',
    icon: 'target',
    instruction:
      'Classe les equipements les plus critiques du contexte actif. Pour chaque equipement, indique le niveau de priorite, la raison probable, les preuves dans les incidents et la prochaine verification terrain.',
  },
  {
    key: 'root-cause',
    label: 'Causes probables',
    description: 'Cherche les motifs recurrentes dans les commentaires.',
    icon: 'search',
    instruction:
      'Analyse les causes probables a partir des incidents et commentaires disponibles. Regroupe les signaux similaires, distingue cause probable et symptome, puis propose comment confirmer chaque hypothese.',
  },
  {
    key: 'daily-plan',
    label: 'Plan du jour',
    description: 'Transforme le contexte en actions ordonnees.',
    icon: 'calendar',
    instruction:
      "Construis un plan d'action pour aujourd'hui. Donne 3 a 5 actions classees par urgence, avec objectif, responsable suggere, delai, preuve attendue et risque si on reporte.",
  },
];

const RESPONSE_ACTIONS = [
  {
    key: 'plan',
    label: 'Faire un plan',
    icon: 'checklist',
    prompt:
      "Transforme ta derniere reponse en plan d'action operationnel avec priorite, responsable suggere, delai, preuve a verifier et prochaine etape.",
  },
  {
    key: 'priorities',
    label: 'Prioriser',
    icon: 'target',
    prompt:
      'A partir de ta derniere reponse, donne uniquement les 3 actions les plus urgentes, classees par impact et facilite de mise en oeuvre.',
  },
  {
    key: 'copy',
    label: 'Copier',
    icon: 'copy',
  },
  {
    key: 'history',
    label: 'Historique',
    icon: 'history',
    path: '/historique',
  },
  {
    key: 'prediction',
    label: 'Prediction',
    icon: 'chart',
    path: '/prediction',
  },
];

function createMessage(role, content, extra = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function getInitialMessages() {
  const fallback = [
    createMessage(
      'assistant',
      "Bonjour, je suis pret a vous aider sur les pannes, les tendances et les priorites de supervision.",
    ),
  ];

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const rawHistory = window.sessionStorage.getItem(STORAGE_KEY);
    if (!rawHistory) {
      return fallback;
    }

    const parsedHistory = JSON.parse(rawHistory);
    if (
      !parsedHistory ||
      !Array.isArray(parsedHistory.messages) ||
      Date.now() - Number(parsedHistory.savedAt ?? 0) > STORAGE_TTL_MS
    ) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return fallback;
    }

    return parsedHistory.messages.length ? parsedHistory.messages : fallback;
  } catch {
    return fallback;
  }
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPeriodLabel(period) {
  if (!period) {
    return 'Periode automatique';
  }

  return String(period).slice(0, 7);
}

function isChatNearBottom(element) {
  if (!element) {
    return true;
  }

  return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
}

function formatIncidentDate(incident) {
  if (!incident?.date) {
    return 'Aucun incident recent';
  }

  return [incident.date, incident.heure].filter(Boolean).join(' ');
}

function getTotalIncidents(summary) {
  if (!summary?.trend?.length) {
    return 0;
  }

  return summary.trend.reduce((total, point) => total + Number(point.value || 0), 0);
}

function getDistinctRecentEquipments(details) {
  const equipmentNames = new Set();

  details.forEach((item) => {
    if (item?.equipement) {
      equipmentNames.add(item.equipement);
    }
  });

  return equipmentNames.size;
}

function getLatestAssistantMeta(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (entry.role === 'assistant' && (entry.model || entry.provider)) {
      return entry;
    }
  }

  return null;
}

function getLatestConfidenceEntry(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (
      entry.role === 'assistant' &&
      (entry.model || entry.provider || entry.context || entry.isFallback)
    ) {
      return entry;
    }
  }

  return null;
}

function getContextStatus(loading, error) {
  if (error) {
    return {
      label: 'Contexte indisponible',
      className: 'error',
    };
  }

  if (loading) {
    return {
      label: 'Lecture des donnees',
      className: 'loading',
    };
  }

  return {
    label: 'Contexte pret',
    className: 'ready',
  };
}

function getConfidenceLevel(score) {
  if (score >= 78) {
    return {
      label: 'Confiance elevee',
      className: 'high',
      guidance: 'Bonne base pour decider, avec verification terrain standard.',
    };
  }

  if (score >= 52) {
    return {
      label: 'Confiance moyenne',
      className: 'medium',
      guidance: 'A utiliser comme aide, puis confirmer avec les donnees terrain.',
    };
  }

  return {
    label: 'A verifier',
    className: 'low',
    guidance: 'Contexte limite : validez les faits avant toute action critique.',
  };
}

function estimateAssistantConfidence(entry, context) {
  if (!entry || entry.role !== 'assistant') {
    return null;
  }

  if (!entry.model && !entry.provider && !entry.context && !entry.isFallback) {
    return null;
  }

  let score = 100;
  const reasons = [];

  if (!entry.model && !entry.provider) {
    score -= 24;
    reasons.push('moteur IA non confirme');
  } else {
    reasons.push('moteur IA confirme');
  }

  if (entry.isFallback) {
    score -= 45;
    reasons.push('reponse de secours apres erreur');
  }

  if (context.hasError) {
    score -= 34;
    reasons.push('contexte historique indisponible');
  }

  if (context.isLoading) {
    score -= 10;
    reasons.push('contexte encore en lecture');
  }

  if (!entry.context?.period && !context.selectedPeriod) {
    score -= 10;
    reasons.push('periode resolue automatiquement');
  } else {
    reasons.push('periode explicite ou comprise');
  }

  if (!context.hasError && !context.isLoading) {
    if (context.totalIncidents < 5) {
      score -= 18;
      reasons.push('peu d incidents dans le contexte');
    } else if (context.totalIncidents < 15) {
      score -= 8;
      reasons.push('volume de donnees modere');
    } else {
      reasons.push('volume de donnees suffisant');
    }

    if (context.recentEquipments === 0) {
      score -= 12;
      reasons.push('aucun equipement recent lu');
    }
  }

  if (context.selectedCategory === 'ALL') {
    score -= 4;
    reasons.push('categorie large');
  } else {
    reasons.push('categorie filtree');
  }

  const safeScore = Math.max(5, Math.min(98, score));
  const level = getConfidenceLevel(safeScore);

  return {
    ...level,
    score: safeScore,
    reasons: reasons.slice(0, 4),
  };
}

function isActionableAssistantResponse(entry) {
  return entry.role === 'assistant' && Boolean(entry.model || entry.provider || entry.context);
}

function buildActionPrompt(action, entry, contextPeriodLabel, contextCategoryLabel) {
  return [
    action.prompt,
    '',
    `Contexte actif : ${contextPeriodLabel} / ${contextCategoryLabel}.`,
    'Derniere reponse a transformer :',
    entry.content,
  ].join('\n');
}

function buildQuickPrompt(prompt, context) {
  const topEquipmentLine = context.topEquipment
    ? `Equipement le plus recurrent : ${context.topEquipment.equipement} (${context.topEquipment.pannes} pannes).`
    : 'Equipement le plus recurrent : non disponible.';

  return [
    prompt.instruction,
    '',
    `Contexte actif : ${context.periodLabel} / ${context.categoryLabel}.`,
    `Volume lu : ${context.totalIncidents} panne(s), ${context.recentEquipments} equipement(s) recent(s).`,
    topEquipmentLine,
    context.hasError
      ? 'Attention : le contexte historique est partiellement indisponible, signale clairement les limites de ton analyse.'
      : 'Utilise uniquement les donnees disponibles dans le contexte metier transmis au service IA.',
    '',
    'Format attendu : titres courts, listes actionnables, aucune generalite non reliee aux incidents.',
  ].join('\n');
}

function AssistantActionIcon({ type }) {
  if (type === 'copy') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M5 15V6.8C5 5.8 5.8 5 6.8 5H15" />
      </svg>
    );
  }

  if (type === 'history') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M4 12a8 8 0 1 0 2.35-5.65" />
        <path d="M4 5.5v5h5" />
        <path d="M12 8v4.4l3 1.6" />
      </svg>
    );
  }

  if (type === 'chart') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M4 19h16" />
        <path d="M7 16V9" />
        <path d="M12 16V5" />
        <path d="M17 16v-4" />
      </svg>
    );
  }

  if (type === 'target') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4" />
      </svg>
    );
  }

  if (type === 'search') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <circle cx="10.5" cy="10.5" r="5.8" />
        <path d="m15 15 4.2 4.2" />
        <path d="M8.3 10.5h4.4" />
      </svg>
    );
  }

  if (type === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
        <path d="M8 3.8v3.4M16 3.8v3.4M4.5 9.5h15" />
        <path d="M8 13h2.2M13.8 13H16M8 16.2h2.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M8 6h10" />
      <path d="M8 12h10" />
      <path d="M8 18h10" />
      <path d="m4.5 6 .7.7L6.8 5" />
      <path d="m4.5 12 .7.7 1.6-1.7" />
      <path d="m4.5 18 .7.7 1.6-1.7" />
    </svg>
  );
}

function AssistantConfidenceBadge({ confidence }) {
  if (!confidence) {
    return null;
  }

  return (
    <div className={`assistant-confidence-card ${confidence.className}`}>
      <div className="assistant-confidence-header">
        <div>
          <span>Confiance estimee</span>
          <strong>{confidence.label}</strong>
        </div>
        <b>{confidence.score}%</b>
      </div>
      <div
        className="assistant-confidence-meter"
        aria-label={`Confiance estimee ${confidence.score} pour cent`}
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow={confidence.score}
        role="progressbar"
      >
        <span style={{ width: `${confidence.score}%` }} />
      </div>
      <p>{confidence.guidance}</p>
      <small className="assistant-confidence-disclaimer">
        Estimation interface, pas une garantie : confirmez les decisions critiques avec les
        donnees terrain.
      </small>
      <div className="assistant-confidence-reasons">
        {confidence.reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
    </div>
  );
}

function renderAssistantContent(content) {
  const lines = String(content || '')
    .split('\n')
    .map((line) => line.trimEnd());
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }

    blocks.push({
      type: 'paragraph',
      lines: [...paragraphLines],
    });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length || !listType) {
      return;
    }

    blocks.push({
      type: listType,
      items: [...listItems],
    });
    listItems = [];
    listType = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const orderedMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType !== 'ordered') {
        flushList();
        listType = 'ordered';
      }
      listItems.push(orderedMatch[2].trim());
      return;
    }

    const unorderedMatch = trimmed.match(/^[-\u2022]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType !== 'unordered') {
        flushList();
        listType = 'unordered';
      }
      listItems.push(unorderedMatch[1].trim());
      return;
    }

    if (listType) {
      flushList();
    }

    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();

  return blocks.map((block, index) => {
    if (block.type === 'ordered') {
      return (
        <ol key={`block-${index}`} className="assistant-message-list ordered">
          {block.items.map((item, itemIndex) => (
            <li key={`ordered-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ol>
      );
    }

    if (block.type === 'unordered') {
      return (
        <ul key={`block-${index}`} className="assistant-message-list unordered">
          {block.items.map((item, itemIndex) => (
            <li key={`unordered-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`block-${index}`} className="assistant-message-text">
        {block.lines.join('\n')}
      </p>
    );
  });
}

function AssistantPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState(getInitialMessages);
  const [message, setMessage] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedActionId, setCopiedActionId] = useState('');
  const [showLatestButton, setShowLatestButton] = useState(false);
  const chatWindowRef = useRef(null);
  const messagesEndRef = useRef(null);
  const shouldFollowChatRef = useRef(true);
  const inputRef = useRef(null);
  const selectedPeriod =
    selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth}` : undefined;
  const {
    summary: contextSummary,
    details: contextDetails,
    loading: contextLoading,
    error: contextError,
    reload: reloadAssistantContext,
  } = useHistoriqueData(selectedPeriod, selectedCategory);
  const [contextSyncedAt, setContextSyncedAt] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          messages: messages.slice(-12),
        }),
      );
    }
  }, [messages]);

  useEffect(() => {
    const chatWindow = chatWindowRef.current;
    if (!chatWindow) {
      return;
    }

    if (shouldFollowChatRef.current) {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
      setShowLatestButton(false);
      return;
    }

    setShowLatestButton(!isChatNearBottom(chatWindow));
  }, [messages, isLoading]);

  useEffect(() => {
    if (!contextLoading && !contextError) {
      setContextSyncedAt(new Date().toISOString());
    }
  }, [contextError, contextLoading, contextDetails.length, contextSummary?.period]);

  const contextPeriodLabel = formatPeriodLabel(selectedPeriod || contextSummary?.period);
  const contextCategoryLabel = formatCategoryLabel(selectedCategory);
  const contextTotalIncidents = getTotalIncidents(contextSummary);
  const contextRecentEquipments = getDistinctRecentEquipments(contextDetails);
  const topEquipment = contextSummary?.pannesParEquipement?.[0];
  const latestAssistantMeta = getLatestAssistantMeta(messages);
  const latestConfidenceEntry = getLatestConfidenceEntry(messages);
  const modelLabel = [latestAssistantMeta?.provider, latestAssistantMeta?.model]
    .filter(Boolean)
    .join(' · ');
  const contextStatus = getContextStatus(contextLoading, contextError);
  const quickPromptContext = useMemo(
    () => ({
      periodLabel: contextPeriodLabel,
      categoryLabel: contextCategoryLabel,
      totalIncidents: contextLoading ? '...' : contextTotalIncidents.toLocaleString('fr-FR'),
      recentEquipments: contextLoading ? '...' : contextRecentEquipments.toLocaleString('fr-FR'),
      topEquipment,
      hasError: Boolean(contextError),
    }),
    [
      contextCategoryLabel,
      contextError,
      contextLoading,
      contextPeriodLabel,
      contextRecentEquipments,
      contextTotalIncidents,
      topEquipment,
    ],
  );
  const confidenceContext = useMemo(
    () => ({
      hasError: Boolean(contextError),
      isLoading: contextLoading,
      recentEquipments: contextRecentEquipments,
      selectedCategory,
      selectedPeriod,
      totalIncidents: contextTotalIncidents,
    }),
    [
      contextError,
      contextLoading,
      contextRecentEquipments,
      contextTotalIncidents,
      selectedCategory,
      selectedPeriod,
    ],
  );
  const currentConfidence = estimateAssistantConfidence(latestConfidenceEntry, confidenceContext);
  const knowledgeItems = [
    {
      label: 'Periode analysee',
      value: contextPeriodLabel,
      detail: selectedPeriod ? 'selection manuelle' : 'dernier mois disponible',
    },
    {
      label: 'Categorie active',
      value: contextCategoryLabel,
      detail: selectedCategory === 'ALL' ? 'filtre ouvert' : 'filtre applique',
    },
    {
      label: 'Pannes du contexte',
      value: contextLoading ? '...' : contextTotalIncidents.toLocaleString('fr-FR'),
      detail: 'total sur la periode',
    },
    {
      label: 'Equipements recents',
      value: contextLoading ? '...' : contextRecentEquipments.toLocaleString('fr-FR'),
      detail: 'dans les 50 derniers incidents',
    },
    {
      label: 'Equipement recurrent',
      value: topEquipment?.equipement || 'Aucune donnee',
      detail: topEquipment ? `${topEquipment.pannes} pannes` : 'top 5 indisponible',
    },
    {
      label: 'Dernier incident lu',
      value: formatIncidentDate(contextSummary?.dernierIncident),
      detail: contextSummary?.dernierIncident?.equipement || 'base vide pour ce filtre',
    },
    {
      label: 'Source de contexte',
      value: contextError ? 'API historique' : 'Base historique',
      detail: contextError ? 'a verifier' : 'resume + details',
    },
    {
      label: 'Derniere lecture',
      value: contextSyncedAt ? formatTimestamp(contextSyncedAt) : 'En attente',
      detail: contextLoading ? 'actualisation' : 'donnees synchronisees',
    },
    {
      label: 'Moteur confirme',
      value: modelLabel || 'Pas encore confirme',
      detail: modelLabel ? 'derniere reponse IA' : 'apres le premier message',
    },
    {
      label: 'Confiance estimee',
      value: currentConfidence ? `${currentConfidence.score}%` : 'En attente',
      detail: currentConfidence?.label || 'apres une reponse IA',
    },
  ];

  const quickActions = useMemo(
    () =>
      QUICK_PROMPTS.map((prompt) => (
        <button
          key={prompt.key}
          className="assistant-chip assistant-prompt-card"
          type="button"
          onClick={() => {
            setMessage(buildQuickPrompt(prompt, quickPromptContext));
            inputRef.current?.focus();
          }}
          disabled={isLoading}
          aria-label={`Preparer le prompt ${prompt.label}`}
        >
          <span className="assistant-prompt-icon" aria-hidden="true">
            <AssistantActionIcon type={prompt.icon} />
          </span>
          <span className="assistant-prompt-copy">
            <strong>{prompt.label}</strong>
            <small>{prompt.description}</small>
          </span>
        </button>
      )),
    [isLoading, quickPromptContext],
  );

  const sendMessageContent = async (content) => {
    const trimmedMessage = String(content || '').trim();
    if (!trimmedMessage || isLoading) {
      return;
    }

    shouldFollowChatRef.current = true;
    const userMessage = createMessage('user', trimmedMessage);
    setMessages((current) => [...current, userMessage]);
    setMessage('');
    setError('');
    setIsLoading(true);

    try {
      const response = await sendAssistantMessage(trimmedMessage, {
        period: selectedPeriod,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      });
      setMessages((current) => [
        ...current,
        createMessage('assistant', response.reply, {
          model: response.model,
          provider: response.provider,
          context: response.context,
          createdAt: response.createdAt,
        }),
      ]);
    } catch (requestError) {
      const isTimeout =
        requestError?.code === 'ECONNABORTED' ||
        String(requestError?.message || '').toLowerCase().includes('timeout');
      const nextError = isTimeout
        ? "L'assistant met trop de temps a repondre. OpenRouter est peut-etre lent pour le moment, reessayez dans quelques secondes."
        : requestError?.response?.data?.message ||
          requestError?.message ||
          "Une erreur s'est produite pendant la reponse de l'assistant.";

      setError(nextError);
      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          isTimeout
            ? "Je prends plus de temps que prevu pour repondre. Reessayez dans quelques secondes."
            : "Je n'ai pas pu repondre pour le moment. Verifiez la configuration OpenRouter et reessayez.",
          {
            isFallback: true,
          },
        ),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessageContent(message);
  };

  const handleComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
      return;
    }

    event.preventDefault();
    sendMessageContent(message);
  };

  const handleChatScroll = (event) => {
    const nearBottom = isChatNearBottom(event.currentTarget);
    shouldFollowChatRef.current = nearBottom;
    setShowLatestButton(!nearBottom);
  };

  const handleScrollToLatest = () => {
    shouldFollowChatRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setShowLatestButton(false);
  };

  const handleReset = () => {
    const initialMessages = [
      createMessage(
        'assistant',
        "Bonjour, je suis pret a vous aider sur les pannes, les tendances et les priorites de supervision.",
      ),
    ];
    setMessages(initialMessages);
    setError('');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleResetContext = () => {
    setSelectedMonth('');
    setSelectedYear('');
    setSelectedCategory('ALL');
  };

  const handleCopyResponse = async (entry) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setError("La copie automatique n'est pas disponible dans ce navigateur.");
      return;
    }

    try {
      await navigator.clipboard.writeText(entry.content);
      setCopiedActionId(entry.id);
      setError('');
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setCopiedActionId(''), 1800);
      }
    } catch {
      setError("Impossible de copier la reponse. Selectionnez le texte manuellement.");
    }
  };

  const handleResponseAction = (action, entry) => {
    if (action.path) {
      navigate(action.path);
      return;
    }

    if (action.key === 'copy') {
      handleCopyResponse(entry);
      return;
    }

    sendMessageContent(buildActionPrompt(action, entry, contextPeriodLabel, contextCategoryLabel));
  };

  return (
    <section className="section page-assistant">
      <header className="topbar">
        <div>
          <p className="eyebrow">Assistant IA</p>
          <h1>Assistant intelligent</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" type="button" onClick={handleReset} disabled={isLoading}>
            Effacer l'historique
          </button>
        </div>
      </header>

      <div className="section-header">
        <div>
          <h2>Conversation en direct</h2>
          <p className="muted">
            Assistant branche a OpenRouter avec historique local et suivi des erreurs.
          </p>
        </div>
        <div className="assistant-header-actions">
          <div className="period-filter assistant-filter-bar">
            <div className="period-filter-group">
              <label className="muted" htmlFor="assistant-mois-select">
                Mois
              </label>
              <select
                id="assistant-mois-select"
                className="period-select"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                disabled={isLoading}
              >
                <option value="">Auto</option>
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="period-filter-group">
              <label className="muted" htmlFor="assistant-annee-select">
                Annee
              </label>
              <select
                id="assistant-annee-select"
                className="period-select"
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                disabled={isLoading}
              >
                <option value="">Auto</option>
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="period-filter-group">
              <label className="muted" htmlFor="assistant-categorie-select">
                Categorie
              </label>
              <select
                id="assistant-categorie-select"
                className="period-select"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                disabled={isLoading}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="ghost-button" type="button" onClick={handleResetContext} disabled={isLoading}>
            Reinitialiser le contexte
          </button>
        </div>
      </div>

      <div className="assistant-layout">
        <div className="card chat-card assistant-chat-card">
          <div className="assistant-prompt-panel">
            <div className="assistant-prompt-header">
              <div>
                <h3>Prompts rapides</h3>
                <p className="muted">
                  Choisissez une mission, ajustez si besoin, puis envoyez.
                </p>
              </div>
              <span>{contextPeriodLabel}</span>
            </div>
            <div className="assistant-chip-list">{quickActions}</div>
          </div>

          <div className="assistant-chat-stage">
            <div
              ref={chatWindowRef}
              className="chat-window assistant-chat-window"
              onScroll={handleChatScroll}
              role="log"
              aria-label="Conversation avec l'assistant IA"
              aria-live="polite"
            >
            {messages.map((entry) => (
              <article
                key={entry.id}
                className={`chat-bubble ${entry.role === 'assistant' ? 'ai' : 'user'}`}
              >
                <div className="assistant-message-meta">
                  <strong>{entry.role === 'assistant' ? 'Assistant IA' : 'Vous'}</strong>
                  <span>{formatTimestamp(entry.createdAt)}</span>
                </div>
                {entry.role === 'assistant' ? (
                  <div className="assistant-message-body">{renderAssistantContent(entry.content)}</div>
                ) : (
                  <p className="assistant-message-text">{entry.content}</p>
                )}
                {entry.role === 'assistant' ? (
                  <AssistantConfidenceBadge
                    confidence={estimateAssistantConfidence(entry, confidenceContext)}
                  />
                ) : null}
                {entry.role === 'assistant' && (entry.model || entry.provider) ? (
                  <>
                    <small className="assistant-message-foot">
                      {entry.provider ? `${entry.provider}` : ''}
                      {entry.provider && entry.model ? ' · ' : ''}
                      {entry.model || ''}
                    </small>
                    {entry.context?.period || entry.context?.category ? (
                      <div className="assistant-context-pill">
                        <span>
                          Periode comprise : <strong>{entry.context?.period || 'auto'}</strong>
                        </span>
                        <span>
                          Categorie comprise : <strong>{entry.context?.category || 'toutes'}</strong>
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {isActionableAssistantResponse(entry) ? (
                  <div className="assistant-response-actions" aria-label="Actions sur la reponse">
                    {RESPONSE_ACTIONS.map((action) => {
                      const isCopyAction = action.key === 'copy';
                      const isCopied = isCopyAction && copiedActionId === entry.id;
                      const isDisabled = isLoading && !action.path && !isCopyAction;

                      return (
                        <button
                          key={action.key}
                          className={`assistant-response-action ${isCopied ? 'is-success' : ''}`}
                          type="button"
                          onClick={() => handleResponseAction(action, entry)}
                          disabled={isDisabled}
                          aria-label={`${action.label} depuis cette reponse`}
                        >
                          <AssistantActionIcon type={action.icon} />
                          <span>{isCopied ? 'Copiee' : action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            ))}

            {isLoading ? (
              <div className="chat-bubble ai assistant-loading">
                <div className="assistant-message-meta">
                  <strong>Assistant IA</strong>
                  <span>En cours</span>
                </div>
                <p className="assistant-loading-copy">Analyse du contexte et preparation de la reponse</p>
                <div className="assistant-dots" aria-label="Chargement">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
              <div ref={messagesEndRef} className="assistant-chat-end" aria-hidden="true" />
            </div>

            {showLatestButton ? (
              <button
                className="assistant-latest-button"
                type="button"
                onClick={handleScrollToLatest}
              >
                Dernier message
              </button>
            ) : null}
          </div>

          {error ? <div className="assistant-error-banner">{error}</div> : null}

          <form className="chat-input assistant-chat-input" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Posez une question a l'assistant..."
              disabled={isLoading}
              maxLength={MAX_MESSAGE_LENGTH}
              aria-label="Message a envoyer a l'assistant IA"
              rows={3}
            />
            <button className="primary-button" type="submit" disabled={isLoading || !message.trim()}>
              {isLoading ? 'Envoi...' : 'Envoyer'}
            </button>
          </form>
          <div className="assistant-composer-help">
            <span>Entree pour envoyer, Maj + Entree pour une nouvelle ligne.</span>
            <span>{message.length.toLocaleString('fr-FR')} / {MAX_MESSAGE_LENGTH.toLocaleString('fr-FR')}</span>
          </div>
          <p className="muted">
            Contexte actif :{' '}
            <strong>{selectedPeriod || 'periode automatique'}</strong>
            {' · '}
            <strong>{selectedCategory === 'ALL' ? 'toutes les categories' : selectedCategory}</strong>
          </p>
        </div>

        <aside className="card assistant-side-card">
          <div className="assistant-knowledge-card">
            <div className="assistant-knowledge-header">
              <span className="assistant-knowledge-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M12 3.75 5.75 6.2v4.72c0 4.1 2.63 7.75 6.25 9.02 3.62-1.27 6.25-4.92 6.25-9.02V6.2L12 3.75Z" />
                  <path d="M8.75 11.8h6.5M8.75 9.15h6.5M8.75 14.45h3.75" />
                </svg>
              </span>
              <div>
                <h3>Ce que l'assistant sait</h3>
                <p className="muted">Contexte actuellement transmis au service IA.</p>
              </div>
            </div>

            <div className={`assistant-knowledge-state ${contextStatus.className}`}>
              <span />
              {contextStatus.label}
            </div>

            <div className="assistant-knowledge-grid">
              {knowledgeItems.map((item) => (
                <div className="assistant-knowledge-item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>

            {currentConfidence ? (
              <div className={`assistant-confidence-note ${currentConfidence.className}`}>
                <strong>{currentConfidence.label}</strong>
                <span>
                  Score estime a {currentConfidence.score}% selon le contexte disponible, le volume
                  de donnees et les metadonnees de la reponse.
                </span>
              </div>
            ) : null}

            {contextError ? (
              <div className="assistant-knowledge-warning" role="alert">
                Impossible de lire les donnees historiques pour ce filtre. L'assistant peut encore
                repondre, mais son contexte metier doit etre verifie.
              </div>
            ) : null}

            <button
              className="ghost-button assistant-context-refresh"
              type="button"
              onClick={reloadAssistantContext}
              disabled={contextLoading || isLoading}
            >
              Actualiser le contexte
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default AssistantPage;
