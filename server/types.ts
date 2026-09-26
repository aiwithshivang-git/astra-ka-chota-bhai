export type StageStatus = 'pending' | 'running' | 'verifying' | 'completed' | 'failed';
export type EventKind = 'PLAN' | 'OBSERVE' | 'ACT' | 'VERIFY' | 'RECOVER' | 'COMPLETE' | 'ERROR';
export type ActionName = 'click' | 'type' | 'select' | 'select_station' | 'select_date' | 'extract_trains' | 'scroll' | 'navigate' | 'back' | 'forward' | 'reload' | 'wait' | 'read' | 'download' | 'finish';

export interface Target {
  description: string;
  text?: string;
  role?: 'button' | 'link' | 'textbox' | 'checkbox' | 'radio' | 'combobox';
  ariaLabel?: string;
  selector?: string;
  position?: number;
}

export interface SemanticAction {
  action: ActionName;
  target?: Target;
  value?: string;
  url?: string;
  deltaY?: number;
  verify?: 'url' | 'input' | 'checked' | 'video-playing' | 'download' | 'visible' | 'none';
}

export interface Stage {
  id: number;
  description: string;
  action: SemanticAction;
  status: StageStatus;
  attempts: number;
}

export interface Plan {
  goal: string;
  entities: Record<string, string | number | boolean>;
  stages: Stage[];
  source: string; // AIProviderId or 'fallback'
}

export interface ActivityEvent {
  type: 'activity';
  id: string;
  kind: EventKind;
  stage?: number;
  status?: StageStatus;
  message: string;
  timestamp: number;
}

export interface Observation {
  url: string;
  title: string;
  visibleText: string;
  interactiveElements: Array<{ role: string; name: string; value?: string; href?: string }>;
  hasVideo: boolean;
}

export type AvailabilityStatus = 'available' | 'rac' | 'waitlist' | 'unavailable' | 'unknown';
export interface TrainClassAvailability { className: string; availability: string; status: AvailabilityStatus; }
export interface TrainResult { number: string; name: string; departure: string; arrival: string; duration: string; runningDays: string; classes: TrainClassAvailability[]; }
export interface TrainSearchResult {
  route: { from: { name: string; code?: string }; to: { name: string; code?: string } };
  journeyDate: string;
  trains: TrainResult[];
  sourceUrl: string;
  observedAt: number;
}

export type DisplayMode = 'desktop' | 'mobile';

export type SocketMessage =
  | { type: 'browser_frame'; timestamp: number; image: string; width: number; height: number }
  | { type: 'cursor'; x: number; y: number; target?: { x: number; y: number; width: number; height: number; label: string } }
  | ActivityEvent
  | { type: 'train_results'; result: TrainSearchResult }
  | { type: 'state'; url: string; status: 'idle' | 'planning' | 'running' | 'completed' | 'failed'; plan?: Plan; mode?: DisplayMode }
  | { type: 'mode'; mode: DisplayMode; width: number; height: number }
  | { type: 'telemetry'; cpu: number; memoryMB: number; timestamp: number }
  | { type: 'error'; message: string };
