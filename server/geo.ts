import { db } from "./db";
import { settings } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult extends LatLng {
  displayName: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "TradieCatch/1.0 (support@tradiecatch.com)";

const cache = new Map<string, GeocodeResult | null>();

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = (query || "").trim();
  if (!trimmed) return null;

  const key = normalizeQuery(trimmed);
  if (cache.has(key)) return cache.get(key)!;

  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=au&q=${encodeURIComponent(trimmed)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`Nominatim ${res.status} for "${trimmed}"`);
      cache.set(key, null);
      return null;
    }
    const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!Array.isArray(arr) || arr.length === 0) {
      cache.set(key, null);
      return null;
    }
    const r = arr[0];
    const result: GeocodeResult = {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      displayName: r.display_name,
    };
    cache.set(key, result);
    return result;
  } catch (err) {
    console.error("Geocode error:", err);
    return null;
  }
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ServiceAreaCheck {
  configured: boolean;
  geocoded: boolean;
  within: boolean;
  distanceKm: number | null;
  radiusKm: number | null;
  customer: GeocodeResult | null;
  base: LatLng | null;
}

export async function checkServiceArea(userId: string, customerAddress: string): Promise<ServiceAreaCheck> {
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId));

  const baseLat = s?.baseLat ?? null;
  const baseLng = s?.baseLng ?? null;
  const radiusKm = s?.serviceRadiusKm ?? null;

  if (baseLat == null || baseLng == null || !radiusKm || radiusKm <= 0) {
    return { configured: false, geocoded: false, within: true, distanceKm: null, radiusKm: null, customer: null, base: null };
  }

  const base: LatLng = { lat: baseLat, lng: baseLng };
  const customer = await geocodeAddress(customerAddress);

  if (!customer) {
    return { configured: true, geocoded: false, within: true, distanceKm: null, radiusKm, customer: null, base };
  }

  const distanceKm = haversineKm(base, customer);
  return {
    configured: true,
    geocoded: true,
    within: distanceKm <= radiusKm,
    distanceKm,
    radiusKm,
    customer,
    base,
  };
}
