import { useState, useEffect, useRef } from "react";
import { RTVIEvent } from "@pipecat-ai/client-js";
import { usePipecatClient, usePipecatClientTransportState } from "@pipecat-ai/client-react";

interface InsightEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  category: 'voice' | 'connection' | 'processing' | 'other';
}

interface InsightMetric {
  label: string;
  value: string | number;
  status: 'good' | 'warning' | 'error';
}

export function InsightsPanel() {
  const [events, setEvents] = useState<InsightEvent[]>([]);
  const [metrics, setMetrics] = useState<InsightMetric[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const client = usePipecatClient();
  const transportState = usePipecatClientTransportState();
  const previousTransportState = useRef(transportState);

  // Debug mounting/unmounting
  useEffect(() => {
    console.log('InsightsPanel mounted');
    return () => console.log('InsightsPanel unmounted');
  }, []);

  // Clear events when starting a new connection
  useEffect(() => {
    console.log('Transport state changed:', previousTransportState.current, '->', transportState);
    if (previousTransportState.current === "disconnected" && transportState === "initializing") {
      console.log('Clearing events because starting new connection');
      setEvents([]);
    }
    previousTransportState.current = transportState;
  }, [transportState]);

  // Auto-scroll to bottom when new events arrive (only if expanded)
  useEffect(() => {
    if (isExpanded) {
      eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, isExpanded]);

  // Categorize events for better user understanding
  const categorizeEvent = (eventType: string): 'voice' | 'connection' | 'processing' | 'other' => {
    if (eventType.includes('Speaking') || eventType.includes('Audio') || eventType.includes('Transcript')) {
      return 'voice';
    }
    if (eventType.includes('Connected') || eventType.includes('Disconnected') || eventType.includes('transport')) {
      return 'connection';
    }
    if (eventType.includes('Tts') || eventType.includes('Processing') || eventType.includes('pipeline')) {
      return 'processing';
    }
    return 'other';
  };

  const getEventEmoji = (category: 'voice' | 'connection' | 'processing' | 'other') => {
    switch (category) {
      case 'voice': return '🎤';
      case 'connection': return '🔗';
      case 'processing': return '⚡';
      default: return '📍';
    }
  };

  const getFriendlyEventName = (eventType: string) => {
    const friendlyNames: Record<string, string> = {
      'BotStartedSpeaking': 'Samantha started speaking',
      'BotStoppedSpeaking': 'Samantha finished speaking',
      'UserStartedSpeaking': 'You started speaking',
      'UserStoppedSpeaking': 'You stopped speaking',
      'UserTranscript': 'Voice transcribed',
      'BotTtsText': 'Samantha responding',
      'Connected': 'Connection established',
      'Disconnected': 'Connection ended',
    };
    return friendlyNames[eventType] || eventType;
  };

  // Update metrics based on current state
  useEffect(() => {
    const newMetrics: InsightMetric[] = [];
    
    // Connection status
    newMetrics.push({
      label: 'Connection',
      value: transportState === 'ready' ? 'Connected' : transportState === 'connecting' ? 'Connecting...' : 'Disconnected',
      status: transportState === 'ready' ? 'good' : transportState === 'connecting' ? 'warning' : 'error'
    });

    // Event count
    newMetrics.push({
      label: 'Session Activity',
      value: `${events.length} events`,
      status: 'good'
    });

    // Voice events count
    const voiceEvents = events.filter(e => e.category === 'voice').length;
    newMetrics.push({
      label: 'Voice Interactions',
      value: voiceEvents,
      status: 'good'
    });

    setMetrics(newMetrics);
  }, [transportState, events]);

  // Subscribe to ALL RTVI events using enum enumeration
  useEffect(() => {
    if (!client) return;

    const handleRTVIEvent = (eventType: string, data: any) => {
      // Filter out frequent/noisy events
      if (eventType === 'localAudioLevel' || eventType === 'remoteAudioLevel') {
        return;
      }
      
      const newEvent: InsightEvent = {
        id: Date.now().toString() + Math.random(),
        type: eventType,
        data: data,
        timestamp: new Date(),
        category: categorizeEvent(eventType),
      };
      setEvents(prev => [...prev.slice(-49), newEvent]); // Keep last 50 events
    };

    // Create handlers for ALL events in the RTVIEvent enum
    const eventHandlers: Record<string, (data: any) => void> = {};
    
    Object.values(RTVIEvent).forEach((eventName) => {
      eventHandlers[eventName] = (data: any) => handleRTVIEvent(eventName, data);
    });

    // Subscribe to all events
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      try {
        client.on(event as any, handler);
      } catch (e) {
        console.debug(`Could not subscribe to event: ${event}`);
      }
    });

    return () => {
      // Unsubscribe from all events
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        try {
          client.off(event as any, handler);
        } catch (e) {
          console.debug(`Could not unsubscribe from event: ${event}`);
        }
      });
    };
  }, [client]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status: 'good' | 'warning' | 'error') => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-amber-600';
      case 'error': return 'text-red-600';
    }
  };

  return (
    <div className="h-full companion-panel p-4 flex flex-col relative">
      {/* Terminal header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-primary">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold companion-text tracking-wider">
            SYSTEM EVENT MONITOR
          </h3>
          <span className="text-xs companion-text">// RTVI PROTOCOL</span>
        </div>
        <div className="text-xs companion-text opacity-50">
          EVENTS: {events.length}
        </div>
      </div>
      
      {/* Metrics area - compact */}
      <div className="mb-4">
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((metric, index) => (
            <div key={index} className="text-center p-2 bg-accent/30 rounded" style={{ fontSize: '10px' }}>
              <div className="companion-label text-xs">{metric.label}</div>
              <div className={`font-bold text-xs ${getStatusColor(metric.status)}`}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Events area */}
      <div className="flex-1 overflow-y-auto min-h-0 font-mono" style={{ fontSize: '11px', lineHeight: '1.4' }}>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <div className="companion-text opacity-50 text-sm mb-2">
              ◄ NO EVENTS RECORDED ►
            </div>
            <div className="text-xs opacity-30">
              System events will appear here
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {events.slice(-15).reverse().map((event) => (
              <div key={event.id} className="flex items-start hover:bg-primary/5 px-1 py-0.5">
                <span className="text-primary mr-2">{getEventEmoji(event.category)}</span>
                <div className="flex-1 flex items-start gap-2">
                  <span className="text-primary/70 opacity-50 text-xs">[{formatTimestamp(event.timestamp)}]</span>
                  <span className="text-primary font-bold text-xs">{getFriendlyEventName(event.type)}:</span>
                  <span className="text-primary/80 opacity-80 break-all text-xs">
                    {event.data ? JSON.stringify(event.data).slice(0, 50) : "null"}
                    {event.data && JSON.stringify(event.data).length > 50 ? "..." : ""}
                  </span>
                </div>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        )}
      </div>
      
      {/* Status line */}
      <div className="mt-3 pt-2 border-t border-primary/30 text-xs flex justify-between">
        <span className="companion-text">MONITOR: ACTIVE</span>
        <span className="companion-text">FILTER: ALL</span>
      </div>
    </div>
  );
}