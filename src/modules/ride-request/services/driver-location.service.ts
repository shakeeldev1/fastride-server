import { Injectable } from '@nestjs/common';

interface LiveLocation {
  lat: number;
  lng: number;
  updatedAt: number;
}

// In-memory only: a single server instance is assumed (no Redis/multi-node
// fan-out), matching the rest of the Socket.IO gateway's current design.
const LOCATION_STALE_MS = 2 * 60 * 1000;

@Injectable()
export class DriverLocationService {
  private readonly locations = new Map<string, LiveLocation>();

  update(driverId: string, lat: number, lng: number): void {
    this.locations.set(driverId, { lat, lng, updatedAt: Date.now() });
  }

  clear(driverId: string): void {
    this.locations.delete(driverId);
  }

  /** Returns the driver's last known location, or null if unknown/stale. */
  getFresh(driverId: string): LiveLocation | null {
    const entry = this.locations.get(driverId);
    if (!entry) return null;
    if (Date.now() - entry.updatedAt > LOCATION_STALE_MS) return null;
    return { lat: entry.lat, lng: entry.lng, updatedAt: entry.updatedAt };
  }
}
