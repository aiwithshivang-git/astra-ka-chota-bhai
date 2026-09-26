import type { TrainSearchResult } from '../types.js';

export interface StationRequest { raw: string; canonical: string; aliases: string[]; }
export interface JourneyRequest { origin: StationRequest; destination: StationRequest; journeyDate: string; }
export interface ResolvedStation { name: string; code?: string; selectedValue: string; }
export class TrainSearchStore {
  request?: JourneyRequest;
  from?: ResolvedStation;
  to?: ResolvedStation;
  date?: string;
  result?: TrainSearchResult;
  clear(): void { this.from = undefined; this.to = undefined; this.date = undefined; this.result = undefined; }
}
