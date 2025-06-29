import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import Experience from './Experience/Experience';
import ConvaiChat from './components/ConvaiChat';

function App() {
  const containerRef = useRef(null);
  const experienceRef = useRef(null);
  const [showChat, setShowChat] = useState(false);
  const [chatText, setChatText] = useState('');
  const [isNpcTalking, setIsNpcTalking] = useState(false);
  const [isExperienceReady, setIsExperienceReady] = useState(false);

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

      // Microphone initialization
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          if (window.experience && window.experience.microphone) {
            window.experience.microphone.setStream(stream);
            console.log('[DEBUG] Microphone: setStream called');
          }
        })
        .catch(err => {
          console.error('Microphone access denied:', err);
        });

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
      
      {/* Chat Toggle Button */}
      <button 
        onClick={toggleChat}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
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
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        aria-label="Toggle chat"
      >
        💬
      </button>

      {/* Convai Chat Interface - Only render when experience is ready */}
      {isExperienceReady && (
        <ConvaiChat 
          isVisible={showChat} 
          onClose={() => setShowChat(false)}
          onTextUpdate={handleTextUpdate}
        />
      )}

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