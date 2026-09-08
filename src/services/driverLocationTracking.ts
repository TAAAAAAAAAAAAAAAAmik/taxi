import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { updateDriverLocation } from './apiClient';

const TASK_NAME = 'kinetix-driver-location';
// Достаточно для села: чаще — лишний расход батареи, реже — машина на карте
// у клиента начинает «прыгать».
const INTERVAL_MS = 25000;
const DISTANCE_M = 40;

// Задача выполняется вне дерева React, поэтому идентификатор водителя
// держим в модуле — хуки отсюда недоступны.
let trackedDriverId: string | null = null;

export type TrackingStart =
  | { status: 'started'; background: boolean }
  | { status: 'denied'; message: string }
  | { status: 'unsupported' };

if (Platform.OS !== 'web') {
  TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    if (error || !trackedDriverId) {
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    const last = locations[locations.length - 1];

    if (!last) {
      return;
    }

    try {
      await updateDriverLocation(trackedDriverId, {
        accuracy: last.coords.accuracy ?? undefined,
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
      });
    } catch {
      // Связь в районе рвётся постоянно: пропущенный пинг не повод
      // останавливать смену, следующий уйдёт через INTERVAL_MS.
    }
  });
}

export async function startDriverLocationTracking(driverId: string): Promise<TrackingStart> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported' };
  }

  const foreground = await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== 'granted') {
    return {
      message: 'Без доступа к геолокации клиент не увидит, что вы едете.',
      status: 'denied',
    };
  }

  trackedDriverId = driverId;

  // Фоновое разрешение спрашиваем отдельно и не считаем отказ фатальным:
  // без него трекинг работает, пока приложение на экране.
  const background = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: 'denied' as const }));
  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);

  if (alreadyRunning) {
    return { background: background.status === 'granted', status: 'started' };
  }

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: DISTANCE_M,
    // Android: без постоянного уведомления система усыпит обновления.
    foregroundService: {
      notificationBody: 'Клиент видит, где вы едете',
      notificationColor: '#008D49',
      notificationTitle: 'Kinetix — вы на линии',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    timeInterval: INTERVAL_MS,
  });

  return { background: background.status === 'granted', status: 'started' };
}

export async function stopDriverLocationTracking() {
  trackedDriverId = null;

  if (Platform.OS === 'web') {
    return;
  }

  const running = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);

  if (running) {
    await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => undefined);
  }
}
