import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ConvaiClient } from 'convai-web-sdk';
import Experience from '../Experience/Experience';

// --- Push-to-talk ConvaiChat ---
import './ConvaiChat.css';

const ConvaiChat = () => {
  const [messages, setMessages] = useState(['Welcome to Convai Chat!']);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [keyPressed, setKeyPressed] = useState(false);
  const [userText, setUserText] = useState('');
  const [npcText, setNpcText] = useState('');
  const [audioPlay, setAudioPlay] = useState(false);
  const [userEndOfResponse, setUserEndOfResponse] = useState(false); // This state isn't used in the provided JSX, consider if it's needed
  const [npcName, setNpcName] = useState('Npc');
  const [userName] = useState('User');
  const [avatar, setAvatar] = useState('');
  const [gender, setGender] = useState('MALE'); // This state isn't used in the provided JSX, consider if it's needed
  const [facialData, setFacialData] = useState([]); // This state isn't used in the provided JSX, consider if it's needed
  const [emotionData, setEmotionData] = useState([]); // This state isn't used in the provided JSX, consider if it's needed
  const chatEndRef = useRef(null);
  const convaiClient = useRef(null);
  const npcTextRef = useRef('');
  const finalizedUserText = useRef('');
  const facialRef = useRef([]);
  const keyPressTime = 100; // Moved to a constant, as it doesn't change
  const [keyPressTimeStamp, setKeyPressTimeStamp] = useState();

  const API_KEY = process.env.REACT_APP_CONVAI_API_KEY || 'ad6bffa834d46e0e70bb0bb9fae812fa';
  const CHARACTER_ID = process.env.REACT_APP_CONVAI_CHARACTER_ID || 'aebf2e02-016f-11ef-9a5d-42010a7be00e';

  // Initialize Convai client and push-to-talk handlers
  useEffect(() => {
    convaiClient.current = new ConvaiClient({
      apiKey: API_KEY,
      characterId: CHARACTER_ID,
      enableAudio: true, // Enable audio input
      faceModel: 3,
      enableFacialData: true,
      voiceResponse: 'audio',
      audioConfig: {
        sampleRateHertz: 24000,
        voiceId: 'default',
      },
    });

    convaiClient.current.setErrorCallback((type, message) => {
      setMessages(prev => [...prev, `Error: ${message}`]);
      console.error(type, message); // Use console.error for errors
    });

    convaiClient.current.setResponseCallback(response => {
      // Real-time transcript from user
      if (response.hasUserQuery && response.hasUserQuery()) {
        let transcript = response.getUserQuery();
        if (transcript.getIsFinal()) {
          finalizedUserText.current += ' ' + transcript.getTextData();
          transcript = ''; // Reset transcript after final part is added
        }
        if (transcript) {
          setUserText(finalizedUserText.current + transcript.getTextData());
        } else {
          setUserText(finalizedUserText.current);
        }
      }
      // AI audio/text response
      if (response.hasAudioResponse && response.hasAudioResponse()) {
        if (!response.getAudioResponse()?.getEndOfResponse()) {
          let audioResponse = response.getAudioResponse();
          if (audioResponse?.getVisemesData()?.array[0]) {
            let faceData = audioResponse.getVisemesData().array[0];
            if (faceData[0] !== -2) {
              facialRef.current.push(faceData);
              setFacialData([...facialRef.current]);
            }
          }
          npcTextRef.current += ' ' + audioResponse.getTextData();
          setNpcText(npcTextRef.current);
          if (audioResponse) setIsTalking(true);
        }
        if (response.getAudioResponse()?.getEndOfResponse()) {
          setUserEndOfResponse(true); // This state isn't used
        }
      }
    });

    // Fetch avatar and character info
    const fetchData = async () => {
      try {
        const url = 'https://api.convai.com/character/get';
        const payload = { charID: CHARACTER_ID };
        const headers = {
          'CONVAI-API-KEY': API_KEY,
          'Content-Type': 'application/json',
        };
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (avatar !== data.model_details.modelLink) {
          setAvatar(data.model_details.modelLink);
          setNpcName(data.character_name);
          setGender(data.voice_type);
        }
      } catch (error) {
        console.error('Error fetching character:', error);
      }
    };
    fetchData();

    // Audio play/stop events
    convaiClient.current.onAudioPlay(() => setAudioPlay(true));
    convaiClient.current.onAudioStop(() => {
      setAudioPlay(false);
      facialRef.current = [];
      setFacialData([]);
    });

    // Cleanup for convaiClient
    return () => {
      if (convaiClient.current && typeof convaiClient.current.endSession === 'function') {
        convaiClient.current.endSession();
      }
    };
  }, [API_KEY, CHARACTER_ID, avatar]); // Add dependencies for useEffect

  // Keep isTalking in sync with audioPlay
  useEffect(() => {
    if (!audioPlay) setIsTalking(false);
  }, [audioPlay]);

  // Push-to-talk handlers
  const handleKeyPress = useCallback(
    e => {
      if (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      )
        return;
      if (convaiClient.current && e.keyCode === 84 && !keyPressed) {
        // 'T' key
        e.stopPropagation();
        e.preventDefault();
        setKeyPressed(true);
        finalizedUserText.current = '';
        npcTextRef.current = '';
        setUserText('');
        setNpcText('');
        convaiClient.current.startAudioChunk();
        setKeyPressTimeStamp(Date.now());
      }
    },
    [keyPressed]
  ); // Dependency on keyPressed

  const handleKeyRelease = useCallback(
    e => {
      if (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      )
        return;
      if (convaiClient.current && e.keyCode === 84 && keyPressed) {
        e.preventDefault();
        const elapsedTime = Date.now() - keyPressTimeStamp;
        if (elapsedTime < keyPressTime) {
          setTimeout(() => {
            if (convaiClient.current && keyPressed) {
              setKeyPressed(false);
              convaiClient.current.endAudioChunk();
            }
          }, keyPressTime);
        } else {
          setKeyPressed(false);
          convaiClient.current.endAudioChunk();
        }
      }
    },
    [keyPressed, keyPressTimeStamp, keyPressTime]
  ); // Dependencies for useCallback

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyRelease);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyRelease);
    };
  }, [handleKeyPress, handleKeyRelease]); // Dependencies for useEffect with useCallback functions

  // Function to send message to Convai (text fallback)
  const sendMessageToConvai = useCallback(
    async message => {
      if (!message.trim() || !convaiClient.current) return;
      try {
        setIsLoading(true);
        setMessages(prev => [...prev, `You: ${message}`]);
        finalizedUserText.current = '';
        npcTextRef.current = '';
        setUserText('');
        setNpcText('');
        await convaiClient.current.sendTextChunk(message);
      } catch (error) {
        setMessages(prev => [...prev, `Error: ${error.message}`]);
        console.error('Error sending message to Convai:', error); // Log error
      } finally {
        setIsLoading(false);
      }
    },
    []
  ); // No dependencies if sendMessageToConvai doesn't rely on outside state/props

  // Handle send button click
  const handleSendMessage = () => {
    sendMessageToConvai(inputText);
    setInputText(''); // Clear input after sending
  };

  // Handle Enter key in input field
  const handleInputKeyDown = e => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, userText, npcText]); // Scroll when messages, userText, or npcText change

  // --- RENDER ---
  return (
    <div className="convai-chat-container">
      {/* Listening indicator for push-to-talk */}
      {keyPressed && (
        <div className="convai-chat-listening-indicator">
          Listening... (Release T to stop)
        </div>
      )}
      <div className="convai-chat-area">
        {messages.map((msg, index) => {
          const isUser = msg.startsWith('You:');
          return (
            <div key={index} className={'convai-chat-message' + (isUser ? ' user' : ' ai')}>
              {msg.replace('You:', userName + ':').replace('AI:', npcName + ':')}
            </div>
          );
        })}
        {/* Real-time transcript display */}
        {keyPressed && userText && (
          <div className="convai-chat-message convai-chat-typing-indicator">
            {userName}: {userText}
          </div>
        )}
        {/* NPC real-time response */}
        {isTalking && npcText && (
          <div className="convai-chat-message convai-chat-typing-indicator">
            {npcName}: {npcText}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="convai-chat-input-container">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type your message..."
          className="convai-chat-input"
          disabled={isLoading || keyPressed}
        />
        <button onClick={handleSendMessage} className="convai-chat-send-button" disabled={isLoading || keyPressed}>
          Send
        </button>
      </div>
      <div className="convai-chat-status">
        {keyPressed
          ? 'Listening (hold T)...'
          : isTalking
          ? `${npcName} is speaking...`
          : isLoading
          ? 'AI is thinking...'
          : 'Press and hold T to talk, or type your message.'}
      </div>
    </div>
  );
};

export default ConvaiChat;