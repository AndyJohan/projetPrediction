export class UpdateParametresDto {
  seuils?: {
    critique?: number;
    eleve?: number;
    moyen?: number;
  };

  notifications?: {
    sms?: string;
    email?: string;
    webhook?: string;
    dailySummary?: boolean;
  };

  assistant?: {
    defaultPeriodMode?: 'latest' | 'manual';
    defaultCategory?: 'ALL' | 'COM' | 'SURV' | 'MET' | 'RESEAU';
    requestTimeoutSeconds?: number;
    includeDatabaseContext?: boolean;
    maxHistoryMessages?: number;
  };

  import?: {
    skipOperationalValues?: boolean;
    ignoreInvalidDates?: boolean;
    normalizeLabels?: boolean;
    duplicatePolicy?: 'skip' | 'update';
  };

  dashboard?: {
    defaultCategory?: 'ALL' | 'COM' | 'SURV' | 'MET' | 'RESEAU';
    autoSelectLatestPeriod?: boolean;
    trendYAxisMax?: number;
    showAssistantContext?: boolean;
  };
}
