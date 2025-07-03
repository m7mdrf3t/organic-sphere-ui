import React, { useEffect, useRef, useState } from 'react';
import Experience from '../Experience/Experience';
import DebugControls from '../components/DebugControls';
import DebugChatWrapper from './DebugChatWrapper';

function DebugPage() {
  const canvasRef = useRef(null);
  const [experience, setExperience] = useState(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    let expInstance = null;
    if (canvasRef.current && !experience) {
      expInstance = new Experience({ targetElement: canvasRef.current });
      setExperience(expInstance);
    }

    // Cleanup
    return () => {
      if (expInstance) {
        expInstance.destroy();
      } else if (experience) {
        experience.destroy();
      }
      setExperience(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PTT logic (copy from MainApp)
  const startListening = () => {
    if (!isListening) {
      setIsListening(true);
      window.convaiIsListening = true;
      const convaiClient = window.convaiClient || (window.experience && window.experience.convaiClient);
      if (convaiClient && typeof convaiClient.startAudioChunk === 'function') {
        if (window.finalizedUserText) window.finalizedUserText.current = '';
        if (window.npcTextRef) window.npcTextRef.current = '';
        convaiClient.startAudioChunk();
      }
    }
  };
  const stopListening = () => {
    if (isListening) {
      setIsListening(false);
      window.convaiIsListening = false;
      const convaiClient = window.convaiClient || (window.experience && window.experience.convaiClient);
      if (convaiClient && typeof convaiClient.endAudioChunk === 'function') {
        convaiClient.endAudioChunk();
      }
    }
  };

  const fetchData = async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('Network response was not ok');
    const clone = response.clone(); // Clone to allow multiple reads
    return clone.json(); // Or handle as needed
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        }}
      />
      {/* Talk Button */}
      <button
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          width: isListening ? 120 : 80,
          height: isListening ? 120 : 80,
          borderRadius: '50%',
          background: isListening ? 'linear-gradient(135deg, #00ff97, #00d0ff)' : '#222',
          color: '#fff',
          fontSize: 28,
          border: 'none',
          boxShadow: isListening ? '0 0 24px 8px #00ff97aa' : '0 2px 8px #0006',
          transition: 'all 0.2s',
          outline: 'none',
          cursor: 'pointer',
        }}
        aria-label="Push to talk"
      >
        {isListening ? 'Listening…' : 'Talk'}
      </button>

      {/* Chat Widget: always mounted for voice/chat logic to work */}
      <div style={{ position: 'absolute', bottom: 40, right: 40, zIndex: 11, width: 360, maxWidth: '90vw', maxHeight: '60vh' }}>
        <DebugChatWrapper />
      </div>
      {experience && (
        <DebugControls experience={experience} />
      )}
    </div>
  );
};

export default DebugPage;
