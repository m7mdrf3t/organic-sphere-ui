import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { ConvaiClient } from 'convai-web-sdk';
import { ConvaiContext } from '../App'; 
import { endLoadBalancerSession } from '../utils/apiService'; 

// --- Push-to-talk ConvaiChat ---
import './ConvaiChat.css';

const ConvaiChat = () => {
  const { apiKey, characterId, userId } = useContext(ConvaiContext);

  // All hooks called unconditionally at the top
  const [messages, setMessages] = useState(['Welcome to Convai Chat!']);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [keyPressed, setKeyPressed] = useState(false);
  const [userText, setUserText] = useState('');
  const [npcText, setNpcText] = useState('');
  const [audioPlay, setAudioPlay] = useState(false);
  const [npcName, setNpcName] = useState('Npc');
  const [userName] = useState('User');
  const [avatar, setAvatar] = useState('');
  const chatEndRef = useRef(null);
  const convaiClient = useRef(null);
  const npcTextRef = useRef('');
  const finalizedUserText = useRef('');
  const facialRef = useRef([]);
  const keyPressTime = 100; 
  const [keyPressTimeStamp, setKeyPressTimeStamp] = useState();

  // Add cleanup for end-session on component unmount
  useEffect(() => {
    return () => {
      if (convaiClient.current && typeof convaiClient.current.endSession === 'function') {
        endLoadBalancerSession(userId).catch(err => console.error('Error ending session on unmount:', err));
      }
    };
  }, [userId]);

  // Check microphone and audio context status
  useEffect(() => {
    const checkMicrophoneAccess = async () => {
      try {
        console.log('[DEBUG] Checking microphone permissions...');
        const permissionResult = await navigator.permissions.query({ name: 'microphone' });
        console.log('[DEBUG] Microphone permission state:', permissionResult.state);
        
        // Try to get audio stream to check if we can access the microphone
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('[DEBUG] Successfully accessed microphone stream');
          // Check audio tracks
          const audioTracks = stream.getAudioTracks();
          console.log(`[DEBUG] Found ${audioTracks.length} audio tracks`);
          audioTracks.forEach((track, i) => {
            console.log(`[DEBUG] Audio Track ${i + 1}:`, {
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
              settings: track.getSettings()
            });
          });
          // Stop all tracks to release the microphone
          stream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.error('[DEBUG] Failed to access microphone:', err);
        }
      } catch (err) {
        console.error('[DEBUG] Error checking microphone permissions:', err);
      }
    };

    const checkAudioContext = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const context = new AudioContext();
          console.log('[DEBUG] AudioContext state:', context.state);
          console.log('[DEBUG] AudioContext sample rate:', context.sampleRate, 'Hz');
          
          // Log when the audio context state changes
          context.onstatechange = () => {
            console.log('[DEBUG] AudioContext state changed to:', context.state);
          };
          
          // Try to resume the audio context if it's suspended
          if (context.state === 'suspended') {
            console.log('[DEBUG] AudioContext is suspended, attempting to resume...');
            context.resume().then(() => {
              console.log('[DEBUG] AudioContext resumed successfully');
            }).catch(err => {
              console.error('[DEBUG] Failed to resume AudioContext:', err);
            });
          }
        } else {
          console.error('[DEBUG] Web Audio API not supported in this browser');
        }
      } catch (err) {
        console.error('[DEBUG] Error checking AudioContext:', err);
      }
    };

    checkMicrophoneAccess();
    checkAudioContext();
  }, []);

  // Initialize Convai client and push-to-talk handlers
  useEffect(() => {
    if (!apiKey || !characterId) {
      console.log('[DEBUG] ConvaiClient init skipped: missing API Key or Character ID.');
      return;
    }

    if (convaiClient.current) {
      console.log('[DEBUG] ConvaiClient already initialized. Skipping re-initialization.');
      return; // Prevent re-initialization if already initialized
    }

    console.log('[DEBUG] Initializing ConvaiClient with API_KEY:', apiKey, 'CHARACTER_ID:', characterId);
    
    // Log all network requests made by the Convai SDK
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      console.log('[DEBUG] Network Request:', {
        url: args[0],
        method: args[1]?.method || 'GET',
        headers: args[1]?.headers,
        body: args[1]?.body ? JSON.parse(args[1].body) : null
      });
      const response = await originalFetch(...args);
      const responseClone = response.clone();
      responseClone.json().then(data => {
        console.log('[DEBUG] Network Response:', {
          url: args[0],
          status: response.status,
          data: data
        });
      }).catch(() => {
        responseClone.text().then(text => {
          console.log('[DEBUG] Network Response (text):', {
            url: args[0],
            status: response.status,
            data: text
          });
        });
      });
      return response;
    };

    console.log('[DEBUG] Creating new ConvaiClient instance');
    convaiClient.current = new ConvaiClient({
      apiKey: apiKey,
      characterId: characterId,
      enableAudio: true, 
      faceModel: 3,
      enableFacialData: true,
      voiceResponse: 'audio',
      audioConfig: {
        sampleRateHertz: 24000,
        voiceId: 'default',
      },
    });
    
    console.log('[DEBUG] ConvaiClient instance created:', convaiClient.current);
    
    // Debug wrapper for ConvaiClient methods
    const wrapMethod = (obj, methodName) => {
      const originalMethod = obj[methodName];
      if (typeof originalMethod === 'function') {
        obj[methodName] = (...args) => {
          console.log(`[DEBUG] ConvaiClient.${methodName} called with args:`, args);
          try {
            const result = originalMethod.apply(obj, args);
            console.log(`[DEBUG] ConvaiClient.${methodName} returned:`, result);
            return result;
          } catch (error) {
            console.error(`[DEBUG] Error in ConvaiClient.${methodName}:`, error);
            throw error;
          }
        };
      }
    };

    // Wrap all ConvaiClient methods for debugging
    if (convaiClient.current) {
      Object.getOwnPropertyNames(Object.getPrototypeOf(convaiClient.current))
        .filter(prop => typeof convaiClient.current[prop] === 'function')
        .forEach(method => {
          if (method !== 'constructor') {
            wrapMethod(convaiClient.current, method);
          }
        });
    }

    // Expose convaiClient and refs to window for global access
    window.convaiClient = convaiClient.current;
    window.finalizedUserText = finalizedUserText;
    window.npcTextRef = npcTextRef;
    window.facialRef = facialRef;
    
    console.log('[DEBUG] ConvaiClient methods:', 
      Object.getOwnPropertyNames(Object.getPrototypeOf(convaiClient.current))
        .filter(prop => typeof convaiClient.current[prop] === 'function')
    );

    convaiClient.current.setErrorCallback((type, message) => {
      setMessages(prev => [...prev, `Error: ${type}: ${message}`]);
      console.error('[CONVAI ERROR]', type, message); 
      if (type === 'audio' || type === 'permission') {
        alert('Microphone error: ' + message + '\nCheck browser permissions and ensure no other app is using the mic.');
      }
    });

    convaiClient.current.setResponseCallback((response) => {
      console.log('[DEBUG] === Convai Response Received ===');
      console.log('[DEBUG] Response object:', JSON.parse(JSON.stringify(response, (key, value) => {
        // Handle circular references and large binary data
        if (value && typeof value === 'object' && 'byteLength' in value) {
          return `[BinaryData: ${value.byteLength} bytes]`;
        }
        return value;
      })));
      
      // Log all available methods on the response object
      const responseMethods = [];
      for (const prop in response) {
        if (typeof response[prop] === 'function') {
          responseMethods.push(prop);
        }
      }
      console.log('[DEBUG] Available response methods:', responseMethods);
      
      // Detailed user query logging
      if (response.hasUserQuery && response.hasUserQuery()) {
        console.log('[DEBUG] --- User Query ---');
        const transcript = response.getUserQuery();
        
        // Log available methods on transcript object
        const transcriptMethods = [];
        for (const prop in transcript) {
          if (typeof transcript[prop] === 'function') {
            transcriptMethods.push(prop);
          }
        }
        console.log('[DEBUG] Available transcript methods:', transcriptMethods);
        
        // Safely build transcript data
        const transcriptData = {
          text: typeof transcript.getTextData === 'function' ? transcript.getTextData() : 'N/A',
          isFinal: typeof transcript.getIsFinal === 'function' ? transcript.getIsFinal() : 'N/A',
          // Only call methods that exist on the transcript object
          ...(typeof transcript.getConfidence === 'function' && { 
            confidence: transcript.getConfidence() 
          }),
          audioData: (typeof transcript.getAudioData === 'function' && transcript.getAudioData()) ? 
            `[Audio: ${transcript.getAudioData().byteLength} bytes]` : 'No audio data'
        };
        
        console.log('[DEBUG] Transcript Data:', transcriptData);
        
        if (typeof transcript.getIsFinal === 'function' && transcript.getIsFinal()) {
          console.log('[DEBUG] Final transcript received');
          if (finalizedUserText.current !== undefined && typeof transcript.getTextData === 'function') {
            const finalText = transcript.getTextData();
            console.log('[DEBUG] Updating finalized text:', finalText);
            finalizedUserText.current = finalText;
            setUserText(finalText);
          }
        }
      }
      
      // Detailed audio response logging
      if (response.hasAudioResponse && response.hasAudioResponse()) {
        console.log('[DEBUG] --- Audio Response ---');
        const audioResponse = response.getAudioResponse();
        
        // Log audio metadata
        console.log('[DEBUG] Audio Response Metadata:', {
          textData: audioResponse.getTextData(),
          audioData: audioResponse.getAudioData() ? `[Audio: ${audioResponse.getAudioData().byteLength} bytes]` : null,
          endOfResponse: audioResponse.getEndOfResponse(),
          timeReceived: new Date().toISOString()
        });
        
        // Log visemes if available
        if (audioResponse.getVisemesData) {
          const visemes = audioResponse.getVisemesData();
          console.log('[DEBUG] Visemes Data:', {
            visemesCount: visemes ? visemes.length : 0,
            sampleViseme: visemes && visemes.length > 0 ? visemes[0] : null
          });
        }
        
        // Update UI state
        const textData = audioResponse.getTextData();
        if (textData) {
          console.log('[DEBUG] Updating UI with response text:', textData);
          if (npcTextRef.current !== undefined) {
            npcTextRef.current = textData;
          }
        }
        
        if (audioResponse.getAudioData()) {
          console.log('[DEBUG] Audio data length:', audioResponse.getAudioData().length);
        }
        
        if (audioResponse.getEndOfResponse()) {
          console.log('[DEBUG] --- End of Audio Response ---');
        }
      }
      
      console.log('[DEBUG] ===============================');
    });

    // Fetch avatar and character info
    const fetchData = async () => {
      try {
        const url = 'https://api.convai.com/character/get';
        const payload = { charID: characterId };
        const headers = {
          'CONVAI-API-KEY': apiKey,
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
    });

  }, [apiKey, characterId]);

  // Keep isTalking in sync with audioPlay
  useEffect(() => {
    if (!audioPlay) setIsTalking(false);
  }, [audioPlay, avatar]);

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
  ); 

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
  ); 

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyRelease);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyRelease);
    };
  }, [handleKeyPress, handleKeyRelease]); 

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
        console.error('Error sending message to Convai:', error); 
      } finally {
        setIsLoading(false);
      }
    },
    []
  ); 

  // Handle send button click
  const handleSendMessage = () => {
    sendMessageToConvai(inputText);
    setInputText(''); 
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
  }, [messages, userText, npcText]); 

  // --- Register TTS audio element for sphere ripples when NPC starts talking ---
  useEffect(() => {
    if (!isTalking) return;
    console.log('[DEBUG] ConvaiChat: isTalking true, searching for <audio> elements for TTS');
    // Search main document
    let audioEls = Array.from(document.querySelectorAll('audio'));
    // Search all iframes
    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        const iframeAudios = Array.from(iframe.contentDocument.querySelectorAll('audio'));
        audioEls = audioEls.concat(iframeAudios);
      } catch (e) {
        // cross-origin iframe, ignore
      }
    });
    if (audioEls.length === 0) {
      console.warn('[DEBUG] ConvaiChat: No <audio> elements found in DOM for TTS');
    } else {
      audioEls.forEach((audioEl, idx) => {
        console.log(`[DEBUG] ConvaiChat: Found <audio> element #${idx}:`, audioEl, {
          src: audioEl.src,
          currentTime: audioEl.currentTime,
          paused: audioEl.paused,
          ended: audioEl.ended,
          readyState: audioEl.readyState,
          networkState: audioEl.networkState,
          volume: audioEl.volume,
          muted: audioEl.muted
        });
        audioEl.onplay = () => console.log(`[DEBUG] <audio> #${idx} play`);
        audioEl.onpause = () => console.log(`[DEBUG] <audio> #${idx} pause`);
        audioEl.onended = () => console.log(`[DEBUG] <audio> #${idx} ended`);
        audioEl.ontimeupdate = () => console.log(`[DEBUG] <audio> #${idx} timeupdate:`, audioEl.currentTime);
      });
      // Register the first audio element for analysis
      if (window.setGeminiTTSAudioElement) {
        window.setGeminiTTSAudioElement(audioEls[0]);
        console.log('[DEBUG] ConvaiChat: Registered TTS audio element for sphere ripples');
      }
    }
  }, [isTalking]);

  // --- Unified push-to-talk logic ---
  // Keyboard: hold/release 'T' for push-to-talk using Convai's official pattern
  useEffect(() => {
    const handleKeyDown = (e) => {
      console.log('[DEBUG] Key pressed:', e.key);
      
      // Only handle T key when not in an input field
      if ((e.key === 't' || e.key === 'T') &&
          !(document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' || 
            document.activeElement.isContentEditable)) {
            
        console.log('[DEBUG] T key detected - starting push-to-talk');
        
        // Only proceed if we're not already processing a key press
        if (!keyPressed) {
          e.preventDefault();
          e.stopPropagation();
          setKeyPressed(true);
          setKeyPressTimeStamp(Date.now());
          
          if (convaiClient.current) {
            console.log('[DEBUG] Starting audio capture');
            
            // Clear previous state
            finalizedUserText.current = '';
            npcTextRef.current = '';
            setUserText('');
            setNpcText('');
            
            // Get fresh microphone access
            navigator.mediaDevices.getUserMedia({ audio: true })
              .then(stream => {
                console.log('[DEBUG] Successfully accessed microphone stream');
                
                // Stop any existing tracks to release the microphone
                stream.getTracks().forEach(track => track.stop());
                
                // Start audio capture with Convai
                try {
                  console.log('[DEBUG] Starting audio chunk...');
                  convaiClient.current.startAudioChunk();
                  console.log('[DEBUG] Audio chunk started successfully');
                } catch (error) {
                  console.error('[DEBUG] Error starting audio chunk:', error);
                }
              })
              .catch(error => {
                console.error('[DEBUG] Error accessing microphone:', error);
              });
          } else {
            console.error('[DEBUG] convaiClient is not available');
          }
        } else {
          console.log('[DEBUG] Key already pressed, ignoring duplicate keydown');
        }
      } else if (e.key === 't' || e.key === 'T') {
        console.log('[DEBUG] T key ignored - focus is on input element');
      }
    };
    const handleKeyUp = (e) => {
      console.log('[DEBUG] Key released:', e.key);
      if (
        (e.key === 't' || e.key === 'T') &&
        !(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)
      ) {
        console.log('[DEBUG] T key released - stopping push-to-talk');
        if (convaiClient.current) {
          if (keyPressed) {
            e.preventDefault();
            const elapsedTime = Date.now() - keyPressTimeStamp;
            console.log(`[DEBUG] Key was pressed for ${elapsedTime}ms`);
            
            const stopAudioCapture = () => {
              setKeyPressed(false);
              if (typeof convaiClient.current.endAudioChunk === 'function') {
                console.log('[DEBUG] Calling convaiClient.current.endAudioChunk()');
                try {
                  convaiClient.current.endAudioChunk();
                  console.log('[DEBUG] endAudioChunk() called successfully');
                } catch (err) {
                  console.error('[DEBUG] Error in endAudioChunk:', err);
                }
              } else {
                console.error('[DEBUG] convaiClient.current.endAudioChunk is not a function');
                console.log('[DEBUG] convaiClient.current:', convaiClient.current);
              }
            };

            if (elapsedTime < keyPressTime) {
              console.log(`[DEBUG] Short press detected (${elapsedTime}ms < ${keyPressTime}ms), delaying endAudioChunk`);
              setTimeout(() => {
                if (convaiClient.current && keyPressed) {
                  stopAudioCapture();
                }
              }, keyPressTime - elapsedTime);
            } else {
              console.log('[DEBUG] Normal press detected, stopping audio capture');
              stopAudioCapture();
            }
          } else {
            console.log('[DEBUG] Key up event received but key was not marked as pressed');
          }
        } else {
          console.error('[DEBUG] convaiClient.current is not available during keyup');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [keyPressed, keyPressTimeStamp]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (convaiClient.current && typeof convaiClient.current.endSession === 'function') {
        convaiClient.current.endSession();  // Call Convai SDK's endSession method
      } 
      endLoadBalancerSession(userId).catch(err => console.error('Error ending load balancer session on beforeunload:', err));
      console.log('[DEBUG] Attempting to end session on beforeunload');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);  // Cleanup listener
    };
  }, [userId]);

  // Now handle conditional logic and rendering
  if (!apiKey || !characterId) {
    return <div>Error: Credentials missing</div>;
  }

  // Rest of the component code, including return statement
  return (
    <div className="convai-chat-container">
      {/* Direct content, removed minimized check and button */}
      {keyPressed && (
        <div className="convai-chat-listening-indicator">
          Listening... (Release T to stop)
        </div>
      )}
      <div className="convai-chat-area">
        {messages.map((msg, index) => (
          <div key={index} className={'convai-chat-message' + (msg.startsWith('You:') ? ' user' : ' ai')}>
            {msg.replace('You:', userName + ':').replace('AI:', npcName + ':')}
          </div>
        ))}
        {keyPressed && userText && (
          <div className="convai-chat-message convai-chat-typing-indicator">
            {userName}: {userText}
          </div>
        )}
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
          disabled={isLoading}
        />
        <button onClick={handleSendMessage} className="convai-chat-send-button" disabled={isLoading}>
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