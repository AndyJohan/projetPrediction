import { httpClient } from './httpClient';

export async function fetchParametres() {
  const { data } = await httpClient.get('/parametre');
  return data;
}

export async function saveParametres(payload) {
  const { data } = await httpClient.put('/parametre', payload);
  return data;
}
