import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Pane } from 'tweakpane';

export default function DebugControls({ experience }) {
  const paneRef = useRef(null);
  const sphereRef = useRef(null);
  const lightsRef = useRef({
    a: { color: '#f76f00', intensity: 1.85 },
    b: { color: '#00f799', intensity: 1.4 }
  });

  useEffect(() => {
    if (!experience || !experience.world || !experience.world.sphere) {
      console.log('DebugControls: Waiting for experience to be ready...');
      
      // Set up a timeout to check again if the experience becomes available
      const checkInterval = setInterval(() => {
        if (experience && experience.world && experience.world.sphere) {
          clearInterval(checkInterval);
          // Force re-render when sphere becomes available
          paneRef.current.innerHTML = '';
          const event = new Event('sphereReady');
          window.dispatchEvent(event);
        }
      }, 500);
      
      return () => clearInterval(checkInterval);
    }

    // Get reference to the sphere
    sphereRef.current = experience.world.sphere;
    
    // Create pane
    const pane = new Pane({
      title: 'Sphere Controls',
      container: paneRef.current,
    });

    // Add distortion controls
    const distortionFolder = pane.addFolder({
      title: 'Distortion',
      expanded: true,
    });

    distortionFolder.addInput(
      sphereRef.current.material.uniforms.uDistortionFrequency,
      'value',
      { label: 'Frequency', min: 0, max: 10, step: 0.1 }
    );

    distortionFolder.addInput(
      sphereRef.current.material.uniforms.uDistortionStrength,
      'value',
      { label: 'Strength', min: 0, max: 2, step: 0.01 }
    );

    // Add displacement controls
    const displacementFolder = pane.addFolder({
      title: 'Displacement',
      expanded: true,
    });

    displacementFolder.addInput(
      sphereRef.current.material.uniforms.uDisplacementFrequency,
      'value',
      { label: 'Frequency', min: 0, max: 5, step: 0.1 }
    );

    displacementFolder.addInput(
      sphereRef.current.material.uniforms.uDisplacementStrength,
      'value',
      { label: 'Strength', min: 0, max: 1, step: 0.01 }
    );

    // Add fresnel controls
    const fresnelFolder = pane.addFolder({
      title: 'Fresnel',
      expanded: true,
    });

    fresnelFolder.addInput(
      sphereRef.current.material.uniforms.uFresnelOffset,
      'value',
      { label: 'Offset', min: -2, max: 2, step: 0.01 }
    );

    fresnelFolder.addInput(
      sphereRef.current.material.uniforms.uFresnelMultiplier,
      'value',
      { label: 'Multiplier', min: 0, max: 5, step: 0.01 }
    );

    fresnelFolder.addInput(
      sphereRef.current.material.uniforms.uFresnelPower,
      'value',
      { label: 'Power', min: 0, max: 5, step: 0.01 }
    );

    // Add light controls
    const lightsFolder = pane.addFolder({
      title: 'Lights',
      expanded: true,
    });

    // Light A
    const lightAFolder = lightsFolder.addFolder({
      title: 'Light A',
      expanded: true,
    });

    lightAFolder.addInput(lightsRef.current.a, 'color', {
      view: 'color',
      label: 'Color',
    }).on('change', (ev) => {
      sphereRef.current.lights.a.color.instance.set(ev.value);
      sphereRef.current.material.uniforms.uLightAColor.value.set(ev.value);
    });

    lightAFolder.addInput(lightsRef.current.a, 'intensity', {
      min: 0,
      max: 5,
      step: 0.1,
      label: 'Intensity',
    }).on('change', (ev) => {
      sphereRef.current.material.uniforms.uLightAIntensity.value = ev.value;
    });

    // Light B
    const lightBFolder = lightsFolder.addFolder({
      title: 'Light B',
      expanded: true,
    });

    lightBFolder.addInput(lightsRef.current.b, 'color', {
      view: 'color',
      label: 'Color',
    }).on('change', (ev) => {
      sphereRef.current.lights.b.color.instance.set(ev.value);
      sphereRef.current.material.uniforms.uLightBColor.value.set(ev.value);
    });

    lightBFolder.addInput(lightsRef.current.b, 'intensity', {
      min: 0,
      max: 5,
      step: 0.1,
      label: 'Intensity',
    }).on('change', (ev) => {
      sphereRef.current.material.uniforms.uLightBIntensity.value = ev.value;
    });

    // Add geometry controls
    const geometryFolder = pane.addFolder({
      title: 'Geometry',
      expanded: false,
    });
    geometryFolder.addInput(
      sphereRef.current.geometry.parameters,
      'widthSegments',
      { label: 'Width Segments', min: 4, max: 512, step: 1 }
    ).on('change', (ev) => {
      sphereRef.current.geometry = new THREE.SphereGeometry(1.3, ev.value, sphereRef.current.geometry.parameters.heightSegments);
      sphereRef.current.material.uniforms.uSubdivision.value.x = ev.value;
    });
    geometryFolder.addInput(
      sphereRef.current.geometry.parameters,
      'heightSegments',
      { label: 'Height Segments', min: 4, max: 512, step: 1 }
    ).on('change', (ev) => {
      sphereRef.current.geometry = new THREE.SphereGeometry(1.3, sphereRef.current.geometry.parameters.widthSegments, ev.value);
      sphereRef.current.material.uniforms.uSubdivision.value.y = ev.value;
    });

    // Add animation/time controls
    const animationFolder = pane.addFolder({
      title: 'Animation',
      expanded: false,
    });
    animationFolder.addInput(
      sphereRef.current,
      'timeFrequency',
      { label: 'Time Frequency', min: 0, max: 0.01, step: 0.0001 }
    );

    // Add shader/uniforms controls
    const uniformsFolder = pane.addFolder({
      title: 'Shader Uniforms',
      expanded: false,
    });
    uniformsFolder.addInput(
      sphereRef.current.material.uniforms.uOffset.value,
      'x', { label: 'Offset X', min: -10, max: 10, step: 0.01 }
    );
    uniformsFolder.addInput(
      sphereRef.current.material.uniforms.uOffset.value,
      'y', { label: 'Offset Y', min: -10, max: 10, step: 0.01 }
    );
    uniformsFolder.addInput(
      sphereRef.current.material.uniforms.uOffset.value,
      'z', { label: 'Offset Z', min: -10, max: 10, step: 0.01 }
    );
    uniformsFolder.addInput(
      sphereRef.current.material.uniforms.uTime,
      'value', { label: 'Shader Time', min: 0, max: 10000, step: 1 }
    );

    // Add sphere controls (material)
    const sphereFolder = pane.addFolder({
      title: 'Sphere',
      expanded: true,
    });
    sphereFolder.addInput(
      sphereRef.current.material.uniforms.uInnerRadius,
      'value',
      { label: 'Inner Radius', min: 0, max: 1, step: 0.01 }
    );

    // Add volume/variation controls
    const variationsFolder = pane.addFolder({
      title: 'Audio Variations',
      expanded: false,
    });
    if (sphereRef.current.variations) {
      Object.keys(sphereRef.current.variations).forEach((key) => {
        const variation = sphereRef.current.variations[key];
        variationsFolder.addInput(
          variation,
          'current',
          { label: `${key} (current)`, min: 0, max: 10, step: 0.001, readonly: true }
        );
        variationsFolder.addInput(
          variation,
          'target',
          { label: `${key} (target)`, min: 0, max: 10, step: 0.001, readonly: true }
        );
      });
    }

    // Cleanup
    return () => {
      if (pane) {
        pane.dispose();
      }
    };

  }, [experience]);

  return (
    <div 
      ref={paneRef}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '300px',
        maxHeight: '90vh',
        overflowY: 'auto',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        zIndex: 1000,
      }}
    >
      {(!experience || !experience.world || !experience.world.sphere) && (
        <div style={{ padding: '10px', color: '#fff' }}>
          Loading sphere controls...
        </div>
      )}
    </div>
  );
}
