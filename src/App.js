import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import Experience from './Experience/Experience';
import ConvaiChat from './components/ConvaiChat';

// Global Web Audio patch for Convai TTS analysis
(function() {
  if (typeof window !== 'undefined' && window.AudioContext && !window.__AUDIO_PATCHED_FOR_TTS__) {
    window.__AUDIO_PATCHED_FOR_TTS__ = true;
    const OriginalAudioContext = window.AudioContext;
    window.AudioContext = function(...args) {
      const ctx = new OriginalAudioContext(...args);
      const origCreateBufferSource = ctx.createBufferSource;
      ctx.createBufferSource = function(...bsArgs) {
        const source = origCreateBufferSource.apply(ctx, bsArgs);
        // Attach analyser node if not present
        if (!ctx._ttsAnalyser) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          ctx._ttsAnalyser = analyser;
          ctx._ttsAnalyserData = new Uint8Array(analyser.frequencyBinCount);
          // Connect to destination
          analyser.connect(ctx.destination);
          window.latestTTSAnalyser = analyser;
          console.log('[DEBUG] GlobalAudioPatch: Created and exposed TTS analyser node.');
        }
        // Connect source to analyser
        source.connect(ctx._ttsAnalyser);
        return source;
      };
      return ctx;
    };
    window.AudioContext.prototype = OriginalAudioContext.prototype;
  }
})();


function App() {
  const containerRef = useRef(null);
  const experienceRef = useRef(null);
  const [showChat, setShowChat] = useState(false);
  const [chatText, setChatText] = useState('');
  const [isNpcTalking, setIsNpcTalking] = useState(false);
  const [isExperienceReady, setIsExperienceReady] = useState(false);
  const [isListening, setIsListening] = useState(false);



  // PTT logic at app level - using same methods as 'T' key
  const startListening = useCallback(() => {
    console.log('[DEBUG] [App] startListening called');
    if (!isListening) {
      setIsListening(true);
      // Update global listening state for sphere visualization
      window.convaiIsListening = true;
      
      // Get the convaiClient from the window object (set by ConvaiChat component)
      const convaiClient = window.convaiClient || (window.experience && window.experience.convaiClient);
      
      if (convaiClient && typeof convaiClient.startAudioChunk === 'function') {
        console.log('[DEBUG] [App] Starting audio chunk with convaiClient');
        // Reset any previous state
        if (window.finalizedUserText) window.finalizedUserText.current = '';
        if (window.npcTextRef) window.npcTextRef.current = '';
        // Start audio capture
        convaiClient.startAudioChunk();
      } else {
        console.log('[DEBUG] [App] No convaiClient.startAudioChunk found');
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    console.log('[DEBUG] [App] stopListening called');
    if (isListening) {
      setIsListening(false);
      // Update global listening state for sphere visualization
      window.convaiIsListening = false;
      
      // Get the convaiClient from the window object
      const convaiClient = window.convaiClient || (window.experience && window.experience.convaiClient);
      
      if (convaiClient && typeof convaiClient.endAudioChunk === 'function') {
        console.log('[DEBUG] [App] Ending audio chunk with convaiClient');
        // End audio capture and send for processing
        convaiClient.endAudioChunk();
      } else {
        console.log('[DEBUG] [App] No convaiClient.endAudioChunk found');
      }
    }
  }, [isListening]);

  useEffect(() => {
    console.log('Environment Variables:', {
      hasApiKey: !!process.env.REACT_APP_CONVAI_API_KEY,
      hasCharacterId: !!process.env.REACT_APP_CONVAI_CHARACTER_ID
    });
  }, []);
  
  useEffect(() => {
    if (!experienceRef.current && containerRef.current) {
      console.log('Initializing Experience...');
      // Create experience
      const experience = new Experience({
        targetElement: containerRef.current
      });
      
      // Store the experience instance in both ref and window for debugging
      experienceRef.current = experience;
      window.experience = experience;

      // Microphone stream is NOT set here; Convai SDK owns the microphone.
      // If you want to visualize the mic, you must request access separately and only if available.

      // Helper for TTS audio element registration
      window.setGeminiTTSAudioElement = (audioElement) => {
        if (window.experience && window.experience.geminiTTSAudio) {
          window.experience.geminiTTSAudio.setAudioElement(audioElement);
          console.log('[DEBUG] GeminiTTSAudio: setAudioElement called from App');
        }
      };
      
      console.log('Experience initialized:', experience);
      setIsExperienceReady(true);
    }

    return () => {
      console.log('Cleaning up Experience...');
      // Cleanup
      if (experienceRef.current) {
        experienceRef.current.destroy();
        experienceRef.current = null;
      }
    };
  }, []);

  const handleTextUpdate = (text, source = 'user') => {
    setChatText(text);
    if (source === 'npc') {
      setIsNpcTalking(true);
      // You can add visual feedback or trigger animations here
      setTimeout(() => setIsNpcTalking(false), 2000); // Reset after 2 seconds
    }
  };

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Three.js Canvas */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      />
      
      {/* Chat Toggle Button hidden as requested */}

      {/* Floating push-to-talk mic button, always visible */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{
          width: '100px',
          height: '100px',
          position: 'relative',
          transform: 'translateZ(0)' // Creates a new stacking context
        }}>
          <button
            className={`convai-chat-ptt-btn-fixed${isListening ? ' listening' : ''}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: isListening 
                ? 'rgba(34, 197, 94, 0.85)' // greenish when pressed
                : 'rgba(124, 58, 237, 0.2)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              margin: 0,
              boxShadow: isListening
                ? '0 8px 32px rgba(34, 197, 94, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.1)',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease, box-shadow 0.3s ease',
              outline: 'none',
              transform: isListening ? 'scale(1.18)' : 'scale(1)',
              transformOrigin: 'center center',
              willChange: 'transform',
              overflow: 'hidden',
              zIndex: 1
            }}
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onMouseLeave={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          aria-label="Push to talk"
        >
          {/* Glass overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
            borderRadius: '50%',
            zIndex: 1
          }} />
          
          {/* Button text */}
          <span style={{
            fontSize: '1.1rem',
            fontWeight: '700',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            userSelect: 'none',
            lineHeight: '1.2',
            textAlign: 'center',
            padding: '4px 0',
            textShadow: '0 1px 4px rgba(0,0,0,0.2)',
            position: 'relative',
            zIndex: 2,
            transition: 'transform 0.2s ease',
            transform: isListening ? 'scale(0.95)' : 'scale(1)',
            pointerEvents: 'none' // Prevents text from interfering with button clicks
          }}>
            TALK
          </span>
          
          {/* Active state glow */}
          {isListening && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: '50%',
              boxShadow: 'inset 0 0 20px 5px rgba(124, 58, 237, 0.4)',
              zIndex: 3,
              pointerEvents: 'none'
            }} />
          )}
        </button>
        </div>
        
        {/* Subtle hint text */}
        <p style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '0.75rem',
          marginTop: '8px',
          textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          textAlign: 'center',
          opacity: 0.8,
          transition: 'opacity 0.3s ease'
        }}>
          Hold to talk
        </p>
      </div>

      {/* Convai Chat Interface - Only render when experience is ready */}
      {/* Convai Chat Interface - Only render when experience is ready and showChat is true */}
      {isExperienceReady && (
        <div style={{position: 'fixed', top: '-2000px', left: '-2000px', zIndex: -1}}>
          <ConvaiChat 
            isVisible={showChat} 
            onClose={() => setShowChat(false)}
            onTextUpdate={handleTextUpdate}
          />
        </div>
      )}

      {/* Chat Toggle Button moved out of visible screen as requested */}
      <button 
        onClick={toggleChat}
        style={{
          position: 'fixed',
          top: '-1000px', // Move far above the visible area
          left: '-1000px', // Move far left of the visible area
          background: 'rgba(124, 58, 237, 0.9)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          fontSize: '24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          transition: 'transform 0.2s, background 0.2s',
        }}
        tabIndex={-1} // Remove from tab order
        aria-label="Toggle chat"
      >
        💬
      </button>

      {/* Visual feedback when NPC is talking */}
      {isNpcTalking && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '20px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          zIndex: 100,
        }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4ade80',
            marginRight: '8px',
            animation: 'pulse 1.5s infinite'
          }}></span>
          AI is speaking...
        </div>
      )}
      
      {/* Add keyframes for the pulse animation */}
      <style>{
        `@keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }`
      }</style>
    </div>
  );
}

export default App;