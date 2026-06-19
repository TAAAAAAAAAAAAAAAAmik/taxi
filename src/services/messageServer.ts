import { getApiBaseUrl } from './apiClient';
import {
  getPublicEnv,
  isExamplePublicValue,
  isLocalPublicValue,
  isProductionApp,
} from '../utils/runtimeFlags';

export type MessageServerState = {
  mode: 'local' | 'server';
  label: string;
  description: string;
};

export function getMessageServerState(): MessageServerState {
  const url = getPublicEnv('EXPO_PUBLIC_MESSAGE_SERVER_URL');
  const hasConfiguredServerUrl =
    Boolean(url) && !isExamplePublicValue(url) && (!isProductionApp() || !isLocalPublicValue(url));

  if (!hasConfiguredServerUrl) {
    const apiUrl = getApiBaseUrl();

    return {
      description:
        `Сообщения отправляются в MVP backend: ${apiUrl}/support/messages. Поток событий доступен через SSE ${apiUrl}/realtime/stream.`,
      label: 'MVP сервер сообщений',
      mode: 'server',
    };
  }

  return {
    description: `Сервер сообщений: ${url}. Для продакшена сюда подключается WebSocket, статусы доставки и история обращений.`,
    label: 'Сервер сообщений',
    mode: 'server',
  };
}
