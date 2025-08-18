import { useState, useEffect } from "react";
import { AudioClientHelper } from "@pipecat-ai/voice-ui-kit";
import { usePipecatClient, usePipecatClientTransportState } from "@pipecat-ai/client-react";
import { RTVIEvent } from "@pipecat-ai/client-js";
import { CompanionHeader, ConversationPanel, InsightsPanel, ConnectionArea, ResizablePanels } from "./components";

interface CompanionUIProps {
  handleConnect?: () => void;
  handleDisconnect?: () => void;
  error?: Error | null;
}

function CompanionUI({ handleConnect, handleDisconnect, error }: CompanionUIProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [previousTransportState, setPreviousTransportState] = useState<string>('disconnected');
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const saved = localStorage.getItem("samantha-theme");
    return saved === "dark";
  });
  const transportState = usePipecatClientTransportState();
  const client = usePipecatClient();

  const handleThemeChange = (isDark: boolean) => {
    setIsDarkTheme(isDark);
  };
  
  // Listen for error events
  useEffect(() => {
    if (!client) return;
    
    const handleError = (data: any) => {
      console.log('Connection error:', data);
      setConnectionError(data?.message || 'Unable to connect to Samantha');
    };
    
    client.on(RTVIEvent.Error as any, handleError);
    
    return () => {
      client.off(RTVIEvent.Error as any, handleError);
    };
  }, [client]);
  
  // Clear error when reconnecting or connected
  useEffect(() => {
    if (transportState === 'initializing' || transportState === 'ready') {
      setConnectionError(null);
    }
  }, [transportState]);
  
  // Set error when connection fails after all retries
  useEffect(() => {
    // If we go from connecting to disconnected, it's a failure
    if (previousTransportState === 'connecting' && transportState === 'disconnected') {
      setConnectionError('Connection lost. Please try connecting again.');
    }
    setPreviousTransportState(transportState);
  }, [transportState, previousTransportState]);
  
  return (
    <div 
      className={`min-h-screen text-foreground flex flex-col samantha companion-interface ${isDarkTheme ? 'dark' : ''}`}
      style={{
        background: isDarkTheme 
          ? 'linear-gradient(135deg, #0f1419 0%, #141920 50%, #0f1419 100%)'
          : 'linear-gradient(135deg, #fdf6f0 0%, #fef2ee 50%, #fefaf7 100%)',
        transition: 'background 0.5s ease'
      }}
    >
      <CompanionHeader error={!!connectionError} onThemeChange={handleThemeChange} />
      
      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <ResizablePanels
            topPanel={<ConversationPanel />}
            bottomPanel={<InsightsPanel />}
            defaultTopHeight={90}
            minTopHeight={10}
            minBottomHeight={10}
          />
        </div>
        
        {/* Error Display */}
        {(error || connectionError) && (
          <div className="companion-panel border-l-4 border-l-red-400 mt-4">
            <div className="flex items-center gap-3 p-4">
              <span className="text-red-400 text-lg animate-pulse">⚠</span>
              <p className="text-red-400 text-sm companion-text uppercase">
                ERROR: {connectionError || error?.message || 'Connection failure detected'}
              </p>
            </div>
          </div>
        )}
        
        <div className="mt-4">
          <ConnectionArea 
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      </main>
    </div>
  );
}

export default function SamanthaCompanionUI() {
  return (
    <AudioClientHelper
      transportType="smallwebrtc"
      connectParams={{
        connectionUrl: "/api/offer",
      }}
    >
      {({ handleConnect, handleDisconnect, error }) => (
        <CompanionUI
          handleConnect={handleConnect}
          handleDisconnect={handleDisconnect}
          error={error}
        />
      )}
    </AudioClientHelper>
  );
}