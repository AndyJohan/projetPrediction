import { httpClient } from './httpClient';

export async function sendAssistantMessage(message, options = {}) {
  const { data } = await httpClient.post(
    '/assistant/chat',
    {
      message,
      period: options.period,
      category: options.category,
    },
    {
      timeout: 60000,
    },
  );
  return data;
}
