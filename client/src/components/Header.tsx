import { useState, useCallback, useEffect, useRef } from "react";
import { RTVIEvent } from "@pipecat-ai/client-js";
import { usePipecatClientTransportState, useRTVIClientEvent } from "@pipecat-ai/client-react";
import { ThemeToggle } from "./ThemeToggle";

interface CompanionHeaderProps {
  title?: string;
  error?: boolean;
  onThemeChange?: (isDark: boolean) => void;
}

export function CompanionHeader({ title = "Samantha", error, onThemeChange }: CompanionHeaderProps) {
  const transportState = usePipecatClientTransportState();
  const [isSamanthaSpeaking, setIsSamanthaSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useRTVIClientEvent(
    RTVIEvent.BotStartedSpeaking,
    useCallback(() => {
      setIsSamanthaSpeaking(true);
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.BotStoppedSpeaking,
    useCallback(() => {
      setIsSamanthaSpeaking(false);
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.UserStartedSpeaking,
    useCallback(() => {
      setIsUserSpeaking(true);
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.UserStoppedSpeaking,
    useCallback(() => {
      setIsUserSpeaking(false);
    }, [])
  );

  const getVoiceStatus = () => {
    if (isUserSpeaking) {
      return (
        <div className="flex items-center gap-2 text-cyan">
          <span className="status-indicator active" style={{ background: '#00ffff' }}></span>
          <span className="companion-text">USER TRANSMITTING</span>
        </div>
      );
    } else if (isSamanthaSpeaking) {
      return (
        <div className="flex items-center gap-2 text-primary">
          <span className="status-indicator active"></span>
          <span className="companion-text">SAMANTHA RESPONDING</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2">
          <span className="status-indicator" style={{ background: '#ff8a6533' }}></span>
          <span className="companion-text opacity-50">AUDIO IDLE</span>
        </div>
      );
    }
  };

  const getConnectionStatus = () => {
    const isConnected = transportState === "ready";
    const isConnecting = transportState === "connecting" || transportState === "initializing";
    
    let statusText = "";
    let statusClass = "";
    
    if (isConnected) {
      statusText = "Connected";
      statusClass = "text-primary";
    } else if (isConnecting) {
      statusText = "Connecting...";
      statusClass = "text-amber-500";
    } else if (error) {
      statusText = "Connection failed";
      statusClass = "text-red-500";
    } else {
      statusText = "Not connected";
      statusClass = "text-muted-foreground";
    }
    
    return { statusText, statusClass };
  };

  // Start/stop timer based on connection state
  useEffect(() => {
    const isConnected = transportState === "ready";
    
    if (isConnected && !startTimeRef.current) {
      // Start the timer
      startTimeRef.current = Date.now();
      setSessionDuration(0);
      
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setSessionDuration(elapsed);
        }
      }, 1000);
    } else if (!isConnected && startTimeRef.current) {
      // Stop the timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      startTimeRef.current = null;
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [transportState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const connectionStatus = getConnectionStatus();

  return (
    <header className="border-b border-border bg-card relative overflow-hidden transition-all duration-500">
      {/* Main header content */}
      <div className="relative z-10 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Top row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-foreground tracking-wider">
                {title} <span className="text-primary opacity-70"></span>
              </h1>
              <div className="text-xs text-muted-foreground">
                Project Human
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xs text-foreground">
                <span className="opacity-50">TIME:</span> <span className="text-primary">{formatDuration(sessionDuration)}</span>
              </div>
              <ThemeToggle onThemeChange={onThemeChange || (() => {})} />
            </div>
          </div>
          
          {/* Status row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-8">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <span className="text-foreground opacity-50">STATUS:</span>
                <span className={`text-foreground font-bold ${connectionStatus.statusClass}`}>
                  [{connectionStatus.statusText.toUpperCase()}]
                </span>
              </div>
              
              {/* Voice Status */}
              {transportState === "ready" && getVoiceStatus()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}