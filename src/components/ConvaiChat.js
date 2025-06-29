import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ConvaiClient } from 'convai-web-sdk';
import Experience from '../Experience/Experience';

const ConvaiChat = () => {
  const [messages, setMessages] = useState(['Welcome to Convai Chat!']);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [, setIsTalking] = useState(false);
  const [, setNpcText] = useState('');
  const [, setUserText] = useState('');
  
  const chatEndRef = useRef(null);
  const convaiClient = useRef(null);
  const npcTextRef = useRef('');
  const finalizedUserText = useRef('');

  const API_KEY = process.env.REACT_APP_CONVAI_API_KEY || "ad6bffa834d46e0e70bb0bb9fae812fa";
  const CHARACTER_ID = process.env.REACT_APP_CONVAI_CHARACTER_ID || "aebf2e02-016f-11ef-9a5d-42010a7be00e";

  // Initialize Convai client
  useEffect(() => {
    // Get the existing experience instance from window
    if (!window.experience) {
      console.error('Experience not found. Make sure Experience is initialized before ConvaiChat.');
      return;
    }
    
    // Initialize the client with audio enabled
    convaiClient.current = new ConvaiClient({
      apiKey: API_KEY,
      characterId: CHARACTER_ID,
      enableAudio: true,  // Enable audio output
      enableFacialData: false,  // Keep facial data disabled
      voiceResponse: 'audio',  // Request audio responses
      audioConfig: {
        sampleRateHertz: 24000,  // Standard sample rate for Convai
        voiceId: 'default'  // You can specify a specific voice ID here if needed
      }
    });
    
    // Get the audio context from the experience
    const audioContext = window.experience.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    
    // Create a media stream destination to capture the audio
    const destination = audioContext.createMediaStreamDestination();
    let sourceNode = null;
    
    // Function to process the audio stream
    const processAudioStream = (stream) => {
      if (sourceNode) {
        sourceNode.disconnect();
      }
      sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNode.connect(destination);
      
      // Connect to the experience's audio processing
      if (window.experience.geminiTTSAudio) {
        const audioElement = new Audio();
        audioElement.srcObject = destination.stream;
        audioElement.autoplay = true;
        window.experience.geminiTTSAudio.setAudioElement(audioElement);
      }
    };
    
    // Reuse the existing audio context for playback
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioQueue = [];
    let isPlaying = false;
    
    // Function to play audio chunks
    const playAudioChunk = async (audioData) => {
      try {
        const audioBuffer = await audioContext.decodeAudioData(audioData);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        
        return new Promise((resolve) => {
          source.onended = resolve;
          source.start();
        });
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    };
    
    // Process audio queue
    const processAudioQueue = async () => {
      if (isPlaying || audioQueue.length === 0) return;
      
      isPlaying = true;
      setIsTalking(true);
      
      while (audioQueue.length > 0) {
        const chunk = audioQueue.shift();
        await playAudioChunk(chunk);
      }
      
      isPlaying = false;
      setIsTalking(false);
    };

    // Set up error callback
    convaiClient.current.setErrorCallback((type, message) => {
      console.error('Convai Error:', type, message);
      setMessages(prev => [...prev, `Error: ${message}`]);
    });

    // Set up response callback
    convaiClient.current.setResponseCallback((response) => {
      if (!response) {
        console.error('Received empty response from Convai');
        return;
      }

      console.log('Raw response from Convai:', response);
      
      // Check if response contains audio stream
      if (response.audioResponse && response.audioResponse.audioChunk) {
        try {
          // Process the audio stream
          const audioBlob = new Blob([response.audioResponse.audioChunk], { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audioElement = new Audio(audioUrl);
          
          // Connect to the experience's audio processing
          if (window.experience?.geminiTTSAudio) {
            console.log('Setting audio element for visualization');
            window.experience.geminiTTSAudio.setAudioElement(audioElement);
          } else {
            console.warn('geminiTTSAudio not available on experience');
          }
          
          // Play the audio
          audioElement.play().catch(e => console.error('Error playing audio:', e));
        } catch (error) {
          console.error('Error processing audio response:', error);
        }
      }

      try {
        // Debug the response structure
        console.log('Response structure:', {
          keys: Object.keys(response),
          arrayContents: response.array || [],
          hasAudioResponse: response.hasAudioResponse && response.hasAudioResponse(),
          hasUserQuery: response.hasUserQuery && response.hasUserQuery()
        });

        // Try to get text from the response array (skip session IDs)
        if (response.array && Array.isArray(response.array)) {
          // Look for actual text responses (not just IDs)
          const textResponse = response.array.find(item => 
            typeof item === 'string' && 
            item.trim().length > 0 && 
            !/^[a-f0-9]{32}$/i.test(item) // Skip MD5-like hashes
          );
          
          if (textResponse) {
            console.log('Found text response:', textResponse);
            setMessages(prev => [...prev, `AI: ${textResponse}`]);
            setIsLoading(false);
            return;
          }
        }

        // Handle audio response
        if (response.hasAudioResponse && response.hasAudioResponse()) {
          try {
            const audioResponse = response.getAudioResponse();
            console.log('Audio response structure:', audioResponse);
            
            // Get the audio data
            if (audioResponse && audioResponse.getAudioData) {
              const audioData = audioResponse.getAudioData();
              if (audioData) {
                // Add audio data to the queue
                audioQueue.push(audioData);
                processAudioQueue();
              }
            }
            
            // Also try to extract and display the text
            if (audioResponse && audioResponse.array) {
              const text = audioResponse.array.find(item => 
                typeof item === 'string' && 
                item.trim().length > 0 && 
                !/^[a-f0-9]{32}$/i.test(item) &&
                item !== 'neutral' &&
                !item.includes('audio/')
              );
              
              if (text) {
                console.log('Extracted text from audio response:', text);
                setMessages(prev => [...prev, `AI: ${text}`]);
                setIsLoading(false);
              }
            }
          } catch (e) {
            console.error('Error processing audio response:', e);
          }
        }

        // Try to get the text data using getTextData() if available
        if (typeof response.getTextData === 'function') {
          const text = response.getTextData();
          if (text) {
            console.log('Got text via getTextData():', text);
            setMessages(prev => [...prev, `AI: ${text}`]);
            setIsLoading(false);
            return;
          }
        }

        // Last resort: log the full response for debugging
        console.log('Full response structure for debugging:', {
          ...response,
          // Convert array buffers to strings if needed
          array: response.array ? response.array.map(item => {
            if (item instanceof ArrayBuffer) {
              return 'ArrayBuffer[' + item.byteLength + ']';
            }
            return item;
          }) : null
        });
        
        // If we get here, we couldn't find a text response
        setMessages(prev => [...prev, 'AI: (Processing response... Please check console for details)']);
        
      } catch (error) {
        console.error('Error processing response:', error);
        setMessages(prev => [...prev, `Error: ${error.message}`]);
      } finally {
        setIsLoading(false);
      }
    });

    // Cleanup function
    return () => {
      if (convaiClient.current) {
        if (typeof convaiClient.current.endSession === 'function') {
          convaiClient.current.endSession();
        }
      }
    };
  }, [API_KEY, CHARACTER_ID]);

  // Function to send message to Convai
  const sendMessageToConvai = async (message) => {
    if (!message.trim() || !convaiClient.current) return;
    
    try {
      setIsLoading(true);
      setMessages(prev => [...prev, `You: ${message}`]);
      
      // Reset text states
      finalizedUserText.current = '';
      npcTextRef.current = '';
      setUserText('');
      setNpcText('');
      
      // Send the message
      await convaiClient.current.sendTextChunk(message);
      
      // Response is handled in the response callback
      
    } catch (error) {
      console.error('Error sending message to Convai:', error);
      setMessages(prev => [...prev, `Error: ${error.message}`]);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);



  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    await sendMessageToConvai(inputText);
    setInputText('');
  };

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const styles = {
    chatContainer: {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      width: '350px',
      height: '500px',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: 'rgba(249, 249, 249, 0.95)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
      zIndex: 1000, // Ensure it's above the sphere
    },
    messagesContainer: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      backgroundColor: 'white',
    },
    message: {
      margin: '8px 0',
      padding: '8px 12px',
      borderRadius: '18px',
      maxWidth: '70%',
      wordBreak: 'break-word',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: '#007bff',
      color: 'white',
      marginLeft: 'auto',
    },
    aiMessage: {
      alignSelf: 'flex-start',
      backgroundColor: '#e9ecef',
      color: '#212529',
      marginRight: 'auto',
    },
    inputContainer: {
      display: 'flex',
      padding: '12px',
      borderTop: '1px solid #eee',
      backgroundColor: 'white',
      position: 'sticky',
      bottom: 0,
    },
    input: {
      flex: 1,
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '20px',
      marginRight: '8px',
      outline: 'none',
      fontSize: '14px',
    },
    sendButton: {
      padding: '10px 20px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '20px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background-color 0.2s',
    },
    sendButtonDisabled: {
      backgroundColor: '#ccc',
      cursor: 'not-allowed',
    },
  };

  return (
    <div style={styles.chatContainer}>
      <div style={styles.messagesContainer}>
        {messages.map((msg, index) => {
          const isUser = msg.startsWith('You:');
          return (
            <div 
              key={index} 
              style={{
                ...styles.message,
                ...(isUser ? styles.userMessage : styles.aiMessage),
              }}
            >
              {msg}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      <div style={styles.inputContainer}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          style={styles.input}
          disabled={isLoading}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputText.trim() || isLoading}
          style={{
            ...styles.sendButton,
            ...(isLoading || !inputText.trim() ? styles.sendButtonDisabled : {}),
          }}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '350px',
    height: '500px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
    zIndex: 1000,
    border: '1px solid #e0e0e0',
  },
  chatArea: {
    flex: 1,
    padding: '15px',
    overflowY: 'auto',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(5px)',
  },
  message: {
    marginBottom: '12px',
    padding: '10px 15px',
    borderRadius: '15px',
    maxWidth: '85%',
    lineHeight: '1.4',
    wordWrap: 'break-word',
    backgroundColor: '#f0f0f0',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  typingIndicator: {
    color: '#666',
    fontStyle: 'italic',
    margin: '10px 0',
  },
  inputContainer: {
    display: 'flex',
    padding: '12px 15px',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTop: '1px solid #e0e0e0',
    backdropFilter: 'blur(5px)',
  },
  input: {
    flex: 1,
    padding: '12px 15px',
    border: '1px solid #ddd',
    borderRadius: '24px',
    outline: 'none',
    fontSize: '14px',
    marginRight: '10px',
  },
  sendButton: {
    padding: '0 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
  },
  status: {
    padding: '6px 15px',
    backgroundColor: 'rgba(248, 249, 250, 0.95)',
    color: '#6c757d',
    fontSize: '11px',
    textAlign: 'center',
    borderTop: '1px solid #e9ecef',
    backdropFilter: 'blur(5px)',
  },
};

export default ConvaiChat;
