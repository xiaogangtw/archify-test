type AndroidStatus = {
  connected?: boolean;
  devices: { serial: string; booted: boolean; canControl: boolean }[];
  appium: { ready: boolean };
};

// Keep the viewer mounted during a failed poll, but never retain permission
// to operate a device whose current status could not be confirmed.
export function unavailableAndroidStatus<T extends AndroidStatus>(previous: T | null): T | null {
  if (!previous) return null;
  return {
    ...previous,
    connected: false,
    appium: { ...previous.appium, ready: false },
    devices: previous.devices.map(device => ({
      ...device, state: 'offline', booted: false, canControl: false,
      error: '裝置狀態尚未確認，等待重新連線。',
    })),
  };
}

export function updateAndroidStatus<T extends AndroidStatus>(previous: T | null, next: T): T {
  if (next.connected !== false || !previous) return next;
  return { ...next, devices: unavailableAndroidStatus(previous)!.devices };
}
