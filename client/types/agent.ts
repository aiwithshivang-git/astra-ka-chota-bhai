export type StageStatus = 'pending' | 'running' | 'verifying' | 'completed' | 'failed';
export type AgentStatus = 'idle' | 'planning' | 'running' | 'completed' | 'failed';
export type AgentRadarStatus = 'IDLE' | 'PLANNING' | 'OBSERVING' | 'ACTING' | 'VERIFYING' | 'RECOVERING' | 'COMPLETED' | 'ERROR';
export type DisplayMode = 'desktop' | 'mobile';

export interface Stage { id: number; description: string; status: StageStatus; attempts: number; action: { action: string }; }
export interface Plan { goal: string; source: 'openrouter' | 'fallback'; stages: Stage[]; }
export interface Activity { id: string; kind: 'PLAN' | 'OBSERVE' | 'ACT' | 'VERIFY' | 'RECOVER' | 'COMPLETE' | 'ERROR'; stage?: number; status?: StageStatus; message: string; timestamp: number; }
export interface Frame { image: string; width: number; height: number; }
export interface Cursor { x: number; y: number; target?: { x: number; y: number; width: number; height: number; label: string }; }
export interface TelemetryData { cpu: number; memoryMB: number; timestamp: number; }
export type AvailabilityStatus = 'available' | 'rac' | 'waitlist' | 'unavailable' | 'unknown';
export interface TrainClassAvailability { className: string; availability: string; status: AvailabilityStatus; }
export interface TrainResult { number: string; name: string; departure: string; arrival: string; duration: string; runningDays: string; classes: TrainClassAvailability[]; }
export interface TrainSearchResult { route: { from: { name: string; code?: string }; to: { name: string; code?: string } }; journeyDate: string; trains: TrainResult[]; sourceUrl: string; observedAt: number; }
