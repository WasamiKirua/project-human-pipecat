import { useState, useCallback, useRef, useEffect } from "react";
import { RTVIEvent } from "@pipecat-ai/client-js";
import { useRTVIClientEvent, usePipecatClientTransportState } from "@pipecat-ai/client-react";

interface TranscriptChunk {
  id: string;
  text: string;
  final: boolean;
}

interface ConversationMessage {
  id: string;
  role: "user" | "companion";
  chunks: TranscriptChunk[];
  timestamp: Date;
}

export function ConversationPanel() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transportState = usePipecatClientTransportState();
  const previousTransportState = useRef(transportState);

  // Clear messages when connection is established
  useEffect(() => {
    if (previousTransportState.current !== "ready" && transportState === "ready") {
      setMessages([]);
    }
    previousTransportState.current = transportState;
  }, [transportState]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle user transcripts
  useRTVIClientEvent(
    RTVIEvent.UserTranscript,
    useCallback((data: any) => {
      if (data?.text) {
        setMessages(prev => {
          const chunkId = Date.now().toString() + Math.random();
          const newChunk: TranscriptChunk = {
            id: chunkId,
            text: data.text,
            final: data.final || false,
          };

          if (prev.length === 0 || prev[prev.length - 1].role !== 'user') {
            // Create new user message
            return [...prev, {
              id: Date.now().toString() + Math.random(),
              role: 'user',
              chunks: [newChunk],
              timestamp: new Date(),
            }];
          }
          
          // Update existing user message
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          const updatedChunks = [...lastMessage.chunks];
          
          // Find if there's a non-final chunk to replace
          const nonFinalIndex = updatedChunks.findIndex(chunk => !chunk.final);
          
          if (nonFinalIndex !== -1) {
            // Replace the non-final chunk
            updatedChunks[nonFinalIndex] = newChunk;
          } else {
            // All chunks are final, add new chunk
            updatedChunks.push(newChunk);
          }
          
          updated[updated.length - 1] = {
            ...lastMessage,
            chunks: updatedChunks,
          };
          
          return updated;
        });
      }
    }, [])
  );

  // Handle companion TTS text
  useRTVIClientEvent(
    RTVIEvent.BotTtsText,
    useCallback((data: any) => {
      if (data?.text) {
        setMessages(prev => {
          const chunkId = Date.now().toString() + Math.random();
          const newChunk: TranscriptChunk = {
            id: chunkId,
            text: data.text,
            final: false,
          };

          if (prev.length === 0 || prev[prev.length - 1].role !== 'companion') {
            // Create new companion message
            return [...prev, {
              id: Date.now().toString() + Math.random(),
              role: 'companion',
              chunks: [newChunk],
              timestamp: new Date(),
            }];
          }
          
          // Update existing companion message
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          
          // For companion messages, always append (don't replace)
          updated[updated.length - 1] = {
            ...lastMessage,
            chunks: [...lastMessage.chunks, newChunk],
          };
          
          return updated;
        });
      }
    }, [])
  );

  // Mark companion chunks as final when TTS stops
  useRTVIClientEvent(
    RTVIEvent.BotTtsStopped,
    useCallback(() => {
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'companion') {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          
          // Mark all chunks as final
          updated[updated.length - 1] = {
            ...lastMessage,
            chunks: lastMessage.chunks.map(chunk => ({ ...chunk, final: true })),
          };
          
          return updated;
        }
        return prev;
      });
    }, [])
  );

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: true,
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full companion-panel p-4 flex flex-col relative">
      {/* Terminal header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-primary">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold companion-text tracking-wider">
            CONVERSATION LOG
          </h3>
          <span className="text-xs companion-text">// LLM</span>
        </div>
        <div className="text-xs companion-text opacity-50">
          MSGS: {messages.length}
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ fontSize: '13px', lineHeight: '1.4' }}>
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="companion-text opacity-50 text-sm mb-2">
              ═══ AWAITING TRANSMISSION ═══
            </div>
            <div className="text-xs opacity-30">
              Initialize voice link to begin communication
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {messages.map((message) => (
              <div
                key={message.id}
                className="font-mono text-sm"
              >
                <div className={`flex ${
                  message.role === 'user' ? 'text-cyan' : 'text-primary'
                }`}>
                  <span className="opacity-70">[{formatTimestamp(message.timestamp)}]</span>
                  <span className="mx-2">
                    {message.role === 'user' ? ' USR >' : ' SAM <'}
                  </span>
                  <span className="flex-1">
                    {message.chunks.map((chunk, index) => (
                      <span key={chunk.id} className={
                        message.role === 'user' && !chunk.final ? 'opacity-60' : ''
                      }>
                        {chunk.text}
                        {index < message.chunks.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                    {message.role === 'user' && !message.chunks[message.chunks.length - 1]?.final && (
                      <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse"></span>
                    )}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Status line */}
      <div className="mt-3 pt-2 border-t border-primary/30 text-xs flex justify-between">
        <span className="companion-text">MODE: VOICE/TEXT</span>
        <span className="companion-text">BUFFER: OK</span>
      </div>
    </div>
  );
}