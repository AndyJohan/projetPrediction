import { useCallback, useEffect, useState } from 'react';
import { fetchHistoriqueDetails, fetchHistoriqueSummary } from '../services/historiqueApi';

export function useHistoriqueData(period, category) {
  const [summary, setSummary] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadHistorique() {
      setLoading(true);
      setError(null);

      try {
        const [summaryData, detailsData] = await Promise.all([
          fetchHistoriqueSummary(period, category),
          fetchHistoriqueDetails(period, category),
        ]);

        if (!active) {
          return;
        }

        setSummary(summaryData);
        setDetails(detailsData);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setSummary(null);
        setDetails([]);
        setError(loadError);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadHistorique();

    return () => {
      active = false;
    };
  }, [category, period, reloadKey]);

  return {
    summary,
    details,
    loading,
    error,
    reload,
  };
}
