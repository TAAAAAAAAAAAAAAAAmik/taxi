export type MessageServerState = {
  mode: 'local' | 'server';
  label: string;
  description: string;
};

export function getMessageServerState(): MessageServerState {
  const url = getPublicEnv('EXPO_PUBLIC_MESSAGE_SERVER_URL');

  if (!url) {
    return {
      description:
        'Сообщения сохраняются локально в прототипе. После настройки URL экран будет готов отправлять переписку в сервер сообщений.',
      label: 'Локальный канал',
      mode: 'local',
    };
  }

  return {
    description: `Сервер сообщений: ${url}. Для продакшена сюда подключается WebSocket, статусы доставки и история обращений.`,
    label: 'Сервер сообщений',
    mode: 'server',
  };
}

function getPublicEnv(key: string) {
  const env = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return env.process?.env?.[key];
}
