import { useState, useEffect, useRef } from 'react';

export const useFetchConvaiCredentials = (userId) => {
  const [apiKey, setApiKey] = useState(null);
  const [characterId, setCharacterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use a ref to track if the fetch for the current userId has already been initiated
  const fetchInitiatedRef = useRef(false);

  useEffect(() => {
    // Reset fetchInitiatedRef if userId changes, allowing a new fetch for a new user
    // This is important if you ever allow changing userId without a full page reload.
    // For persistent userId, this will effectively be false only on first mount.
    if (fetchInitiatedRef.current && userId !== fetchInitiatedRef.current.userId) {
      fetchInitiatedRef.current = false;
    }

    const fetchCredentials = async () => {
      // Prevent duplicate fetches if already initiated for this userId
      if (fetchInitiatedRef.current && fetchInitiatedRef.current.userId === userId) {
        console.log('[DEBUG] useFetchConvaiCredentials: Fetch already initiated for this userId. Skipping.');
        return;
      }

      fetchInitiatedRef.current = { userId: userId, initiated: true }; // Mark as initiated

      setLoading(true);
      setError(null); // Clear previous errors

      try {
        console.log(`[DEBUG] useFetchConvaiCredentials: Requesting API session for userId: ${userId}`);
        const response = await fetch('https://patient-transformation-production.up.railway.app/api/get-api-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ERROR] useFetchConvaiCredentials: Server responded with status ${response.status}: ${errorText}`);
          throw new Error(`Failed to fetch credentials: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        setApiKey(data.apiKey);
        setCharacterId(data.characterId);
        console.log('[DEBUG] useFetchConvaiCredentials: Fetched API Key:', data.apiKey);
        console.log('[DEBUG] useFetchConvaiCredentials: Fetched Character ID:', data.characterId);
      } catch (err) {
        console.error('[ERROR] useFetchConvaiCredentials:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Only call fetchCredentials if userId is available and fetch not initiated for it
    if (userId && !fetchInitiatedRef.current) {
      fetchCredentials();
    } else if (userId && fetchInitiatedRef.current && fetchInitiatedRef.current.userId !== userId) {
      // This case handles if userId somehow changes after initial load (e.g., if you added a user switch feature)
      // For a persistent userId, this block might not be hit often.
      fetchCredentials();
    }

  }, [userId]); // Dependency: re-run if userId changes

  return { apiKey, characterId, loading, error };
};

export const endLoadBalancerSession = async (userId) => {
  if (!userId) {
    console.warn('[WARN] endLoadBalancerSession: userId is null or undefined. Cannot end session.');
    return;
  }
  try {
    console.log(`[DEBUG] endLoadBalancerSession: Attempting to end session for userId: ${userId}`);
    const response = await fetch('https://patient-transformation-production.up.railway.app/api/end-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await response.json();
    if (response.ok) {
      console.log('Session ended successfully:', data);
    } else {
      console.error(`Failed to end session: Server responded with status ${response.status}:`, data);
    }
  } catch (error) {
    console.error('Failed to end session (network error or unhandled exception):', error);
  }
};

export const generateRandomUserId = () => {
  // Use crypto.randomUUID for better uniqueness if available
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
};
