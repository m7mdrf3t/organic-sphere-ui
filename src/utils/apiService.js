import { useState, useEffect } from 'react';

export const useFetchConvaiCredentials = (userId) => {
  const [apiKey, setApiKey] = useState(null);
  const [characterId, setCharacterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const response = await fetch('https://patient-transformation-production.up.railway.app/api/get-api-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        if (!response.ok) throw new Error('Failed to fetch credentials');
        const data = await response.json();
        setApiKey(data.apiKey); // Updated to use apiKey from response
        setCharacterId(data.characterId);
        console.log('Fetched API Key:', data.apiKey); // Debugging log for apiKey
        console.log('Fetched Character ID:', data.characterId); // Debugging log for characterId
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCredentials();
  }, [userId]);

  return { apiKey, characterId, loading, error };
};

export const endConvaiSession = async (userId) => {
  try {
    const response = await fetch('https://patient-transformation-production.up.railway.app/api/end-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await response.json();
    console.log('Session ended:', data);
  } catch (error) {
    console.error('Failed to end session:', error);
  }
};

export const generateRandomUserId = () => {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
};
