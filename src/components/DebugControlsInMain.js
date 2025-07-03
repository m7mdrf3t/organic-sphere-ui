import React, { useEffect, useState } from 'react';
import DebugControls from './DebugControls';
import Experience from '../Experience/Experience';

export default function DebugControlsInMain() {
  const [ready, setReady] = useState(false);
  const [experience, setExperience] = useState(() => window.experience || Experience.instance);

  useEffect(() => {
    if (experience && experience.world && experience.world.sphere) {
      setReady(true);
      return;
    }
    // Poll for sphere availability
    const interval = setInterval(() => {
      const exp = window.experience || Experience.instance;
      setExperience(exp);
      if (exp && exp.world && exp.world.sphere) {
        setReady(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [experience]);

  if (!experience) {
    return <div style={{color: 'red'}}>Experience not initialized yet.</div>;
  }
  if (!ready) {
    return <div style={{color: 'white', background: '#222', padding: 12, borderRadius: 8}}>Loading sphere controls…</div>;
  }
  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      zIndex: 2000,
      background: 'rgba(20,20,20,0.95)',
      borderRadius: 12,
      boxShadow: '0 2px 16px #000a',
      padding: 16,
      maxWidth: 420,
      minWidth: 320
    }}>
      <DebugControls experience={experience} />
    </div>
  );
}

