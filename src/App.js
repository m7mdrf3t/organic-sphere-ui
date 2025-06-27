import React, { useEffect, useRef } from "react";
import Experience from "./Experience/Experience";

function App() {
  const containerRef = useRef();

  useEffect(() => {
    let experience;
    if (containerRef.current) {
      experience = new Experience({
        targetElement: containerRef.current,
      });
    }
    return () => {
      if (experience && experience.destroy) experience.destroy();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div
        ref={containerRef}
        style={{
          width: "100vw",
          height: "100vh",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      />
      <div style={{ position: "absolute", zIndex: 2, color: "white", padding: "20px" }}>
        Hello World
      </div>
    </div>
  );
}

export default App;