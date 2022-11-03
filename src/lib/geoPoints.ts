const degreesInRadian = 57.29577951308232;
const meanEarthRadius = 6_371_008.7714;

export type GeoJSONPoint = { type: 'Point', coordinates: [number, number] };
export function makeGeoJsonPoint(lat: number, lon: number): GeoJSONPoint {
  return { type: 'Point', coordinates: [lat, lon] };
}

export type GeoPoint = { lat: number, lon: number };
export function makeGeoPoint(lat: number, lon: number): GeoPoint {
  if(lat < -90.0 || lat > 90.0)
  {
    throw new Error('Invalid latitude');
  }

  if(lon < -180.0 || lon > 180.0)
  {
    throw new Error('Invalid longitude');
  }

  return {
    lat: lat / degreesInRadian,
    lon: lon / degreesInRadian,
  };
}

export function calculateDistance(from: GeoPoint, to: GeoPoint)
{
  let longitudes_abs_diff = Math.abs(from.lon - to.lon);

  const central_angle_radians = Math.acos(
    Math.sin(from.lat)
    * Math.sin(to.lat)
    + Math.cos(from.lat)
    * Math.cos(to.lat)
    * Math.cos(longitudes_abs_diff)
  );

  return meanEarthRadius * central_angle_radians;
}
