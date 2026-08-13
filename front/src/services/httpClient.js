import axios from 'axios';
import { API_BASE_URL, API_KEY } from '../config/env';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: API_KEY
    ? {
        'X-API-Key': API_KEY,
      }
    : undefined,
});
