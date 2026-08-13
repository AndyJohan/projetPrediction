import { httpClient } from './httpClient';

function buildHistoriqueParams(period, category) {
  const params = {};

  if (period) {
    params.period = period;
  }

  if (category && category !== 'ALL') {
    params.category = category;
  }

  return Object.keys(params).length ? params : undefined;
}

export async function fetchHistoriqueSummary(period, category) {
  const { data } = await httpClient.get('/historique/summary', {
    params: buildHistoriqueParams(period, category),
  });
  return data;
}

export async function fetchHistoriqueDetails(period, category) {
  const { data } = await httpClient.get('/historique/details', {
    params: buildHistoriqueParams(period, category),
  });
  return Array.isArray(data) ? data : [];
}

export async function uploadHistoriqueFile(formData, config = {}) {
  const { data } = await httpClient.post('/import/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config,
  });
  return data;
}
