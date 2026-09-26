import { useEffect, useRef, useState } from 'react';
import type { Activity, AgentRadarStatus, AgentStatus, Cursor, DisplayMode, Frame, Plan, TelemetryData, TrainSearchResult } from '../types/agent';

export function useBrowserSocket() {
  const [frame, setFrame] = useState<Frame>();
  const [cursor, setCursor] = useState<Cursor>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [url, setUrl] = useState('about:blank');
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [radarStatus, setRadarStatus] = useState<AgentRadarStatus>('IDLE');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('desktop');
  const [plan, setPlan] = useState<Plan>();
  const [error, setError] = useState<string>();
  const [trainResults, setTrainResults] = useState<TrainSearchResult>();
  const [telemetry, setTelemetry] = useState<TelemetryData>({ cpu: 12, memoryMB: 85, timestamp: Date.now() });

  const [fps, setFps] = useState<number>(0);
  const [streamSpeed, setStreamSpeed] = useState<string>('0.0 KB/s');

  const frameTimestampsRef = useRef<number[]>([]);
  const byteSamplesRef = useRef<{ timestamp: number; bytes: number }[]>([]);

  useEffect(() => {
    let retry: number | undefined;
    let socket: WebSocket;
    let disposed = false;

    // Periodic calculator for FPS and Stream bandwidth metrics
    const statsInterval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - 1000;

      // Calculate FPS from received frames in last 1000ms
      frameTimestampsRef.current = frameTimestampsRef.current.filter((t) => t > cutoff);
      const frameCount = frameTimestampsRef.current.length;
      if (frameCount > 0) {
        // Compute precise frequency
        setFps(Number((frameCount).toFixed(1)));
      } else {
        setFps(0);
      }

      // Calculate stream network traffic in last 1000ms
      byteSamplesRef.current = byteSamplesRef.current.filter((s) => s.timestamp > cutoff);
      const totalBytes = byteSamplesRef.current.reduce((acc, sample) => acc + sample.bytes, 0);

      if (totalBytes >= 1024 * 1024) {
        setStreamSpeed(`${(totalBytes / (1024 * 1024)).toFixed(1)} MB/s`);
      } else if (totalBytes > 0) {
        setStreamSpeed(`${(totalBytes / 1024).toFixed(0)} KB/s`);
      } else {
        setStreamSpeed('0.0 KB/s');
      }
    }, 500);

    const connect = () => {
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/browser`);

      socket.onmessage = ({ data }) => {
        const now = Date.now();
        const byteLen = typeof data === 'string' ? data.length : (data as ArrayBuffer).byteLength || 100;
        byteSamplesRef.current.push({ timestamp: now, bytes: byteLen });

        const message = JSON.parse(data as string) as { type: string } & Record<string, unknown>;

        if (message.type === 'browser_frame') {
          frameTimestampsRef.current.push(now);
          setFrame({
            image: String(message.image),
            width: Number(message.width),
            height: Number(message.height)
          });
        }

        if (message.type === 'cursor') {
          setCursor(message as unknown as Cursor);
        }

        if (message.type === 'activity') {
          const act = message as unknown as Activity;
          setActivities((items) => (items.some((item) => item.id === String(message.id)) ? items : [...items.slice(-39), act]));

          // Map activity kind to high-fidelity agent status
          if (act.kind === 'PLAN') setRadarStatus('PLANNING');
          else if (act.kind === 'OBSERVE') setRadarStatus('OBSERVING');
          else if (act.kind === 'ACT') setRadarStatus('ACTING');
          else if (act.kind === 'VERIFY') setRadarStatus('VERIFYING');
          else if (act.kind === 'RECOVER') setRadarStatus('RECOVERING');
          else if (act.kind === 'COMPLETE') setRadarStatus('COMPLETED');
          else if (act.kind === 'ERROR') setRadarStatus('ERROR');
        }

        if (message.type === 'mode') {
          if (message.mode === 'desktop' || message.mode === 'mobile') {
            setDisplayMode(message.mode);
          }
        }

        if (message.type === 'state') {
          setUrl(String(message.url));
          const newStatus = message.status as AgentStatus;
          setStatus(newStatus);
          if (newStatus === 'idle') setRadarStatus('IDLE');
          else if (newStatus === 'completed') setRadarStatus('COMPLETED');
          else if (newStatus === 'failed') setRadarStatus('ERROR');
          else if (newStatus === 'planning') setRadarStatus('PLANNING');
          if (message.plan) setPlan(message.plan as unknown as Plan);
          if (message.mode === 'desktop' || message.mode === 'mobile') {
            setDisplayMode(message.mode);
          }
        }

        if (message.type === 'telemetry') {
          setTelemetry({
            cpu: Number(message.cpu ?? 15),
            memoryMB: Number(message.memoryMB ?? 85),
            timestamp: Number(message.timestamp ?? Date.now())
          });
        }

        if (message.type === 'train_results') {
          setTrainResults(message.result as unknown as TrainSearchResult);
        }

        if (message.type === 'error') {
          setError(String(message.message));
          setRadarStatus('ERROR');
        }
      };

      socket.onclose = () => {
        if (!disposed) retry = window.setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearInterval(statsInterval);
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return {
    frame,
    cursor,
    activities,
    url,
    status,
    radarStatus,
    displayMode,
    setDisplayMode,
    fps,
    streamSpeed,
    telemetry,
    plan,
    error,
    trainResults,
    setError,
    setPlan,
    setStatus,
    setRadarStatus,
    setActivities,
    setTrainResults
  };
}
