export const normalizeLocation = (lat: any, lng: any): { lat: number, lng: number } | null => {
  const nLat = Number(lat);
  const nLng = Number(lng);

  if (isNaN(nLat) || isNaN(nLng)) return null;
  if (nLat < -90 || nLat > 90) return null;
  if (nLng < -180 || nLng > 180) return null;

  return { lat: nLat, lng: nLng };
};
