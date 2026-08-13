import { httpClient } from './httpClient';

export async function fetchCarteOverview() {
  const { data } = await httpClient.get('/carte');
  return data;
}
