import { _throw } from './_throw';

const degreesInRadian = 57.29577951308232;
const meanEarthRadius = 6_371_008.7714;

export type GeoJSONPoint = { type: 'Point', coordinates: [number, number] };
export function makeGeoJsonPoint(lon: number, lat: number): GeoJSONPoint {
  return { type: 'Point', coordinates: [lon, lat] };
}
export function isGeoJsonPoint(value: any): value is GeoJSONPoint {
  return value.type === 'Point'
    && Array.isArray(value.coordinates)
    && typeof value.coordinates[0] === 'number'
    && typeof value.coordinates[1] === 'number';
}

export type WKTPoint = string;
const wktPointRegex = /^POINT ?\((?<lon>\d+(\.\d+)?) (?<lat>\d+(\.\d+)?)\)$/;
export function isWKTPoint(value: string): value is WKTPoint {
  return !!value.match(wktPointRegex);
}

export type GeoPoint = { lon: number, lat: number };
export function makeGeoPoint(lon: number, lat: number): GeoPoint {
  if(lon < -180.0 || lon > 180.0)
  {
    throw new Error('Invalid longitude');
  }

  if(lat < -90.0 || lat > 90.0)
  {
    throw new Error('Invalid latitude');
  }

  return {
    lon: lon / degreesInRadian,
    lat: lat / degreesInRadian,
  };
}
export function makeGeoPointFromWKT(point: WKTPoint): GeoPoint {
  const match = point.match(wktPointRegex) ?? _throw(new Error('Invalid WKT Point.'));
  const lon = parseFloat(match.groups?.lon ?? '');
  const lat = parseFloat(match.groups?.lat ?? '');
  return makeGeoPoint(lon, lat);
}
export function makeGeoPointFromGeoJSON(point: GeoJSONPoint): GeoPoint {
  return makeGeoPoint(point.coordinates[0], point.coordinates[1]);
}
export function makeGeoPointFromPojo(point: { lon: number, lat: number }): GeoPoint {
  return makeGeoPoint(point.lon, point.lat);
}
export function isGeoPoint(value: any): value is GeoPoint {
  return typeof value === 'object' && typeof value.lon === 'number' && typeof value.lat === 'number';
}

export type GeoPolygon = GeoPoint[];
export function makeGeoPolygon(...points: GeoPoint[]): GeoPolygon {
  if (points.length < 4 || points[0]?.lon !== points[points.length-1]?.lon || points[0]?.lat !== points[points.length-1]?.lat) {
    throw new Error(`Invalid polygon. It should have at least 3 sides (4 points with the last point equal to the first) but got ${JSON.stringify(points)}`);
  }

  return points;
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

export function intersects(point: GeoPoint, polygon: GeoPolygon) {
  let inside = false;

  // We only scan till the second to last point as the algorithm doesn't expect the polygon to self-intersect.
  for (let i = 0, j = polygon.length - 2; i < polygon.length - 1; j = i++) {
    const loni = polygon[i].lon, lati = polygon[i].lat;
    const lonj = polygon[j].lon, latj = polygon[j].lat;

    const intersect = ((lati > point.lat) !== (latj > point.lat))
      && (point.lon < (lonj - loni) * (point.lat - lati) / (latj - lati) + loni);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}
