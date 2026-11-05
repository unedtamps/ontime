export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function requestLocation(
  timeoutMs = 12000,
): Promise<GeoCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: GeoCoords | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        finish({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export function formatCoords(
  latitude: number | null,
  longitude: number | null,
  accuracy: number | null,
): string {
  if (latitude === null || longitude === null) return "Location not available";
  const base = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return accuracy === null ? base : `${base} (±${Math.round(accuracy)} m)`;
}

export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
