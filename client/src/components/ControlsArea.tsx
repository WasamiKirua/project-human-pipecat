import { useState, useEffect, useCallback } from "react";
import { RTVIEvent } from "@pipecat-ai/client-js";
import { usePipecatClient, usePipecatClientTransportState, usePipecatClientMicControl, useRTVIClientEvent } from "@pipecat-ai/client-react";
import { TerminalDropdown } from "./TerminalDropdown";

interface ConnectionAreaProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function ConnectionArea({ onConnect, onDisconnect }: ConnectionAreaProps) {
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isSamanthaSpeaking, setIsSamanthaSpeaking] = useState(false);
  
  const client = usePipecatClient();
  const transportState = usePipecatClientTransportState();
  const { enableMic, isMicEnabled } = usePipecatClientMicControl();

  const isConnected = transportState === "ready";
  const isConnecting = transportState === "connecting" || transportState === "initializing";
  
  // Listen for user speaking events
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
  
  // Listen for Samantha speaking events
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

  // Get available microphone devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request microphone permission to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(device => device.kind === 'audioinput');
        console.log('Available microphones:', mics);
        setAvailableMicrophones(mics);
        if (mics.length > 0 && !selectedMicrophone) {
          setSelectedMicrophone(mics[0].deviceId);
        }
      } catch (error) {
        console.error("Error getting devices:", error);
        
        // If permission fails, try without permission (might get limited info)
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const mics = devices.filter(device => device.kind === 'audioinput');
          console.log('Available microphones (limited):', mics);
          setAvailableMicrophones(mics);
          if (mics.length > 0 && !selectedMicrophone) {
            setSelectedMicrophone(mics[0].deviceId);
          }
        } catch (fallbackError) {
          console.error("Fallback device enumeration failed:", fallbackError);
        }
      }
    };

    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, [selectedMicrophone]);

  // Apply selected microphone when Samantha is ready
  useRTVIClientEvent(
    RTVIEvent.BotReady,
    useCallback(() => {
      if (selectedMicrophone && client && client.updateMic) {
        client.updateMic(selectedMicrophone);
      }
    }, [selectedMicrophone, client])
  );

  const handleToggleMute = () => {
    enableMic(!isMicEnabled);
  };

  const handleMicrophoneChange = (value: string) => {
    setSelectedMicrophone(value);
    if (client && client.updateMic && isConnected) {
      client.updateMic(value);
    }
  };

  const handleConnectionToggle = () => {
    if (isConnected || isConnecting) {
      onDisconnect?.();
    } else {
      onConnect?.();
    }
  };

  const handleSendMessage = async () => {
    if (!client || !isConnected || !inputText.trim() || isSending) return;
    
    const message = inputText.trim();
    setInputText("");
    setIsSending(true);
    
    try {
      // Send the message to Samantha
      console.log('Sending message to Samantha:', message);
      client.sendClientMessage('custom-message', { text: message });
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const microphoneOptions = availableMicrophones.map((mic) => ({
    value: mic.deviceId,
    label: mic.label || `MIC-${mic.deviceId.slice(0, 8)}`
  }));

  console.log('Microphone options:', microphoneOptions);

  const getConnectionButtonText = () => {
    if (isConnected) return "End Conversation";
    if (isConnecting) return "Connecting to Samantha...";
    return "Start Conversation";
  };

  const getConnectionButtonStyle = () => {
    if (isConnected) return "bg-red-500 hover:bg-red-600 text-white";
    if (isConnecting) return "bg-amber-500 text-white animate-pulse cursor-not-allowed";
    return "companion-button";
  };

  return (
    <div className="companion-panel p-4 space-y-4">
      {/* Control Panel Header */}
      <div className="flex items-center justify-between pb-2 border-b border-primary">
        <h3 className="text-sm font-bold companion-text tracking-wider">
          CONTROL INTERFACE
        </h3>
        <div className="text-xs companion-text">
          [AUDIO/TEXT INPUT]
        </div>
      </div>

      {/* Audio Controls */}
      <div className="grid grid-cols-2 gap-4">
        {/* Microphone Selection */}
        <div className="space-y-2">
          <label className="text-xs companion-text opacity-70 uppercase tracking-wider">
            ► Audio Input Device
          </label>
          <TerminalDropdown
            value={selectedMicrophone}
            onChange={handleMicrophoneChange}
            options={microphoneOptions}
            disabled={false}
            className="w-full"
          />
        </div>

        {/* Mute Control */}
        <div className="space-y-2">
          <label className="text-xs companion-text opacity-70 uppercase tracking-wider">
            ► Audio Control
          </label>
          <button
            onClick={handleToggleMute}
            disabled={!isConnected}
            className={`w-full companion-button text-xs ${
              !isConnected
                ? ""
                : !isMicEnabled
                ? "border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
                : "border-primary text-primary"
            }`}
          >
            {!isMicEnabled ? "◉ UNMUTE" : "◉ MUTE"}
          </button>
        </div>
      </div>

      {/* Text Input */}
      <div className="space-y-2">
        <label className="text-xs companion-text opacity-70 uppercase tracking-wider">
          ► Text Command Input
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "ENTER TEXT COMMAND..." : "CONNECT TO ENABLE"}
            className="flex-1 px-2 py-1 text-xs uppercase bg-input border border-border rounded"
            disabled={!isConnected || isSending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !inputText.trim() || isSending}
            className="companion-button text-xs px-4"
          >
            {isSending ? "SENDING..." : "TRANSMIT"}
          </button>
        </div>
      </div>

      {/* Connection Control */}
      <div className="pt-2">
        <button
          onClick={handleConnectionToggle}
          disabled={isConnecting}
          className={`w-full py-3 companion-button font-bold tracking-wider ${
            isConnected
              ? "border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
              : isConnecting
              ? "border-yellow-400 text-yellow-400 animate-pulse"
              : "border-primary text-primary hover:bg-primary hover:text-white"
          }`}
        >
          {isConnected ? "◄ DISCONNECT ►" : isConnecting ? "◄ ESTABLISHING LINK... ►" : "◄ INITIALIZE CONNECTION ►"}
        </button>
      </div>

      {/* Status Indicators */}
      <div className="flex justify-between pt-2 border-t border-primary/30">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className={`status-indicator ${isConnected ? 'connected' : ''}`}></span>
            <span className="companion-text">LINK</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`status-indicator ${isUserSpeaking ? 'active' : ''}`} style={{
              animation: isUserSpeaking ? 'blink-fast 0.3s infinite' : 'none'
            }}></span>
            <span className="companion-text">AUDIO</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`status-indicator ${isSamanthaSpeaking ? 'speaking' : ''}`} style={{
              animation: isSamanthaSpeaking ? 'blink-fast 0.3s infinite' : 'none'
            }}></span>
            <span className="companion-text">DATA</span>
          </div>
        </div>
        <div className="text-xs flex justify-between">
          <span className="companion-text">PROTOCOL: RTVI</span>
        </div>
      </div>
    </div>
  );
}