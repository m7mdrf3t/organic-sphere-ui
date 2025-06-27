import * as THREE from 'three'
import Experience from './Experience'

// Inline shaders
const vertexShader = `
#define M_PI 3.1415926535897932384626433832795

uniform vec3 uLightAColor;
uniform vec3 uLightAPosition;
uniform float uLightAIntensity;
uniform vec3 uLightBColor;
uniform vec3 uLightBPosition;
uniform float uLightBIntensity;
uniform vec2 uSubdivision;
uniform vec3 uOffset;
uniform float uDistortionFrequency;
uniform float uDistortionStrength;
uniform float uDisplacementFrequency;
uniform float uDisplacementStrength;
uniform float uFresnelOffset;
uniform float uFresnelMultiplier;
uniform float uFresnelPower;
uniform float uTime;
uniform float uInnerRadius;

varying vec3 vColor;

// Simplified Perlin noise functions
float random(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(random(i + vec3(0,0,0)), random(i + vec3(1,0,0)), f.x),
            mix(random(i + vec3(0,1,0)), random(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(random(i + vec3(0,0,1)), random(i + vec3(1,0,1)), f.x),
            mix(random(i + vec3(0,1,1)), random(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float perlin3d(vec3 p) {
    return noise(p) * 2.0 - 1.0;
}

float perlin4d(vec4 p) {
    return noise(p.xyz + p.w) * 2.0 - 1.0;
}

vec3 getDisplacedPosition(vec3 _position) {
    vec3 distoredPosition = _position;
    distoredPosition += perlin4d(vec4(distoredPosition * uDistortionFrequency + uOffset, uTime)) * uDistortionStrength;
    float perlinStrength = perlin4d(vec4(distoredPosition * uDisplacementFrequency + uOffset, uTime));
    vec3 displacedPosition = _position;
    displacedPosition += normalize(_position) * perlinStrength * uDisplacementStrength;
    return displacedPosition;
}

void main() {
    // Position
    vec3 displacedPosition = getDisplacedPosition(position);
    vec4 viewPosition = viewMatrix * vec4(displacedPosition, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    // Bi tangents
    float distanceA = (M_PI * 2.0) / uSubdivision.x;
    float distanceB = M_PI / uSubdivision.x;

    vec3 biTangent = cross(normal, tangent.xyz);

    vec3 positionA = position + tangent.xyz * distanceA;
    vec3 displacedPositionA = getDisplacedPosition(positionA);

    vec3 positionB = position + biTangent.xyz * distanceB;
    vec3 displacedPositionB = getDisplacedPosition(positionB);

    vec3 computedNormal = cross(displacedPositionA - displacedPosition.xyz, displacedPositionB - displacedPosition.xyz);
    computedNormal = normalize(computedNormal);

    // Fresnel
    vec3 viewDirection = normalize(displacedPosition.xyz - cameraPosition);
    float fresnel = uFresnelOffset + (1.0 + dot(viewDirection, computedNormal)) * uFresnelMultiplier;
    fresnel = pow(max(0.0, fresnel), uFresnelPower);

    // Adjust position based on inner radius
    float radius = mix(uInnerRadius, 1.0, fresnel);
    displacedPosition = normalize(displacedPosition) * length(displacedPosition) * radius;

    // Color
    float lightAIntensity = max(0.0, - dot(computedNormal.xyz, normalize(- uLightAPosition))) * uLightAIntensity;
    float lightBIntensity = max(0.0, - dot(computedNormal.xyz, normalize(- uLightBPosition))) * uLightBIntensity;

    vec3 color = vec3(0.0);
    color = mix(color, uLightAColor, lightAIntensity * fresnel);
    color = mix(color, uLightBColor, lightBIntensity * fresnel);
    color = mix(color, vec3(1.0), clamp(pow(max(0.0, fresnel - 0.8), 3.0), 0.0, 1.0));

    // Varying
    vColor = color;
}
`

const fragmentShader = `
varying vec3 vColor;

void main() {
    gl_FragColor = vec4(vColor, 1.0);
}
`

export default class Sphere
{
    constructor()
    {
        this.experience = new Experience()
        this.debug = this.experience.debug
        this.scene = this.experience.scene
        this.time = this.experience.time
                this.microphone = this.experience.microphone // Keep for potential fallback
        this.audioSource = this.experience.geminiTTSAudio

        this.timeFrequency = 0.0003
        this.elapsedTime = 0

        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder({
                title: 'sphere',
                expanded: true
            })

            this.debugFolder.addInput(
                this,
                'timeFrequency',
                { min: 0, max: 0.001, step: 0.000001 }
            )
        }
        
        this.setVariations()
        this.setGeometry()
        this.setLights()
        this.setOffset()
        this.setMaterial()
        this.setMesh()
    }

    setVariations()
    {
        this.variations = {}

        this.variations.volume = {}
        this.variations.volume.target = 0
        this.variations.volume.current = 0
        this.variations.volume.upEasing = 0.03
        this.variations.volume.downEasing = 0.002
        this.variations.volume.getValue = () =>
        {
            const level = this.audioSource.levels[0] || 0
            const level1 = this.audioSource.levels[1] || 0
            const level2 = this.audioSource.levels[2] || 0

            return Math.max(level, level1, level2) * 0.3
        }
        this.variations.volume.getDefault = () =>
        {
            return 0.152
        }

        this.variations.lowLevel = {}
        this.variations.lowLevel.target = 0
        this.variations.lowLevel.current = 0
        this.variations.lowLevel.upEasing = 0.005
        this.variations.lowLevel.downEasing = 0.002
        this.variations.lowLevel.getValue = () =>
        {
            let value = this.audioSource.levels[0] || 0
            value *= 0.003
            value += 0.0001
            value = Math.max(0, value)

            return value
        }
        this.variations.lowLevel.getDefault = () =>
        {
            return 0.0003
        }
        
        this.variations.mediumLevel = {}
        this.variations.mediumLevel.target = 0
        this.variations.mediumLevel.current = 0
        this.variations.mediumLevel.upEasing = 0.008
        this.variations.mediumLevel.downEasing = 0.004
        this.variations.mediumLevel.getValue = () =>
        {
            let value = this.audioSource.levels[1] || 0
            value *= 2
            value += 3.587
            value = Math.max(3.587, value)

            return value
        }
        this.variations.mediumLevel.getDefault = () =>
        {
            return 3.587
        }
        
        this.variations.highLevel = {}
        this.variations.highLevel.target = 0
        this.variations.highLevel.current = 0
        this.variations.highLevel.upEasing = 0.02
        this.variations.highLevel.downEasing = 0.001
        this.variations.highLevel.getValue = () =>
        {
            let value = this.audioSource.levels[2] || 0
            value *= 5
            value += 0.5
            value = Math.max(0.5, value)

            return value
        }
        this.variations.highLevel.getDefault = () =>
        {
            return 0.65
        }
    }

    setLights()
    {
        this.lights = {}

        // Light A
        this.lights.a = {}
        this.lights.a.intensity = 1.85
        this.lights.a.color = {}
        this.lights.a.color.value = '#f76f00'
        this.lights.a.color.instance = new THREE.Color(this.lights.a.color.value)
        this.lights.a.spherical = new THREE.Spherical(1, 0.615, 2.049)

        // Light B
        this.lights.b = {}
        this.lights.b.intensity = 1.4
        this.lights.b.color = {}
        this.lights.b.color.value = '#00f799'
        this.lights.b.color.instance = new THREE.Color(this.lights.b.color.value)
        this.lights.b.spherical = new THREE.Spherical(1, 2.561, - 1.844)

        // Add UI controls if debug is enabled
        if(this.debug)
        {
            const lightsFolder = this.debugFolder.addFolder({
                title: 'Lights',
                expanded: false
            });

            // Light A Controls
            const lightAFolder = lightsFolder.addFolder({
                title: 'Light A',
                expanded: true
            });

            lightAFolder.addInput(
                this.lights.a.color,
                'value',
                { label: 'Color', view: 'color' }
            ).on('change', () => {
                this.lights.a.color.instance.set(this.lights.a.color.value);
            });

            lightAFolder.addInput(
                this.lights.a,
                'intensity',
                { min: 0, max: 5, step: 0.01, label: 'Intensity' }
            ).on('change', () => {
                this.material.uniforms.uLightAIntensity.value = this.lights.a.intensity;
            });

            // Light B Controls
            const lightBFolder = lightsFolder.addFolder({
                title: 'Light B',
                expanded: true
            });

            lightBFolder.addInput(
                this.lights.b.color,
                'value',
                { label: 'Color', view: 'color' }
            ).on('change', () => {
                this.lights.b.color.instance.set(this.lights.b.color.value);
            });

            lightBFolder.addInput(
                this.lights.b,
                'intensity',
                { min: 0, max: 5, step: 0.01, label: 'Intensity' }
            ).on('change', () => {
                this.material.uniforms.uLightBIntensity.value = this.lights.b.intensity;
            });

            // Light A position controls
            const lightAPositionFolder = lightsFolder.addFolder({
                title: 'Light A Position',
                expanded: false
            });
            
            lightAPositionFolder.addInput(
                this.lights.a.spherical,
                'phi',
                { label: 'phi', min: 0, max: Math.PI, step: 0.001 }
            ).on('change', () => {
                this.material.uniforms.uLightAPosition.value.setFromSpherical(this.lights.a.spherical);
            });
            
            lightAPositionFolder.addInput(
                this.lights.a.spherical,
                'theta',
                { label: 'theta', min: -Math.PI, max: Math.PI, step: 0.001 }
            ).on('change', () => {
                this.material.uniforms.uLightAPosition.value.setFromSpherical(this.lights.a.spherical);
            });

            // Light B position controls
            const lightBPositionFolder = lightsFolder.addFolder({
                title: 'Light B Position',
                expanded: false
            });
            
            lightBPositionFolder.addInput(
                this.lights.b.spherical,
                'phi',
                { label: 'phi', min: 0, max: Math.PI, step: 0.001 }
            ).on('change', () => {
                this.material.uniforms.uLightBPosition.value.setFromSpherical(this.lights.b.spherical);
            });
            
            lightBPositionFolder.addInput(
                this.lights.b.spherical,
                'theta',
                { label: 'theta', min: -Math.PI, max: Math.PI, step: 0.001 }
            ).on('change', () => {
                this.material.uniforms.uLightBPosition.value.setFromSpherical(this.lights.b.spherical);
            });
        }
    }

    setOffset()
    {
        this.offset = {}
        this.offset.spherical = new THREE.Spherical(1, Math.random() * Math.PI, Math.random() * Math.PI * 2)
        this.offset.direction = new THREE.Vector3()
        this.offset.direction.setFromSpherical(this.offset.spherical)
    }

    setGeometry()
    {
        this.geometry = new THREE.SphereGeometry(1.3, 512, 512)
        this.geometry.computeTangents()
    }

    setMaterial()
    {
        this.material = new THREE.ShaderMaterial({
            uniforms:
            {
                uLightAColor: { value: this.lights.a.color.instance },
                uLightAPosition: { value: new THREE.Vector3(1, 1, 0) },
                uLightAIntensity: { value: this.lights.a.intensity },

                uLightBColor: { value: this.lights.b.color.instance },
                uLightBPosition: { value: new THREE.Vector3(- 1, - 1, 0) },
                uLightBIntensity: { value: this.lights.b.intensity },

                uSubdivision: { value: new THREE.Vector2(this.geometry.parameters.widthSegments, this.geometry.parameters.heightSegments) },

                uOffset: { value: new THREE.Vector3() },

                uDistortionFrequency: { value: 0.9 },
                uDistortionStrength: { value: 0.65 },
                uDisplacementFrequency: { value: 0.820 },
                uDisplacementStrength: { value: 0.452 },

                uFresnelOffset: { value: -1.609 },
                uFresnelMultiplier: { value: 3.587 },
                uFresnelPower: { value: 1.793 },

                uTime: { value: 0 },
                uInnerRadius: { value: 0.0 }  // 0.0 = fully hollow, 1.0 = full sphere
            },
            defines:
            {
                USE_TANGENT: ''
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        })

        this.material.uniforms.uLightAPosition.value.setFromSpherical(this.lights.a.spherical)
        this.material.uniforms.uLightBPosition.value.setFromSpherical(this.lights.b.spherical)
        
        if(this.debug)
        {
            this.debugFolder.addInput(
                this.material.uniforms.uDistortionFrequency,
                'value',
                { label: 'uDistortionFrequency', min: 0, max: 10, step: 0.001 }
            )
            
            this.debugFolder.addInput(
                this.material.uniforms.uDistortionStrength,
                'value',
                { label: 'uDistortionStrength', min: 0, max: 10, step: 0.001 }
            )
            
            this.debugFolder.addInput(
                this.material.uniforms.uDisplacementFrequency,
                'value',
                { label: 'uDisplacementFrequency', min: 0, max: 5, step: 0.001 }
            )
            
            this.debugFolder.addInput(
                this.material.uniforms.uDisplacementStrength,
                'value',
                { label: 'uDisplacementStrength', min: 0, max: 1, step: 0.001 }
            )
            
            this.debugFolder.addInput(
                this.material.uniforms.uFresnelOffset,
                'value',
                { label: 'uFresnelOffset', min: - 2, max: 2, step: 0.001 }
            )
            
            this.debugFolder.addInput(
                this.material.uniforms.uFresnelMultiplier,
                'value',
                { label: 'uFresnelMultiplier', min: 0, max: 5, step: 0.001 }
            )
            
            this.debugFolder.addInput(
                this.material.uniforms.uFresnelPower,
                'value',
                { label: 'uFresnelPower', min: 0, max: 5, step: 0.001 }
            )
            
            this.debugFolder.addInput(
                this.material.uniforms.uInnerRadius,
                'value',
                { label: 'Inner Radius', min: 0, max: 1, step: 0.01 }
            )
            
            // Ripple Controls
            const rippleFolder = this.debugFolder.addFolder({
                title: 'Ripple Effect',
                expanded: true
            });
            
            // Distortion Controls
            rippleFolder.addInput(
                this.material.uniforms.uDistortionFrequency,
                'value',
                { label: 'Distortion Freq', min: 0, max: 10, step: 0.1 }
            );
            
            rippleFolder.addInput(
                this.material.uniforms.uDistortionStrength,
                'value',
                { label: 'Distortion Strength', min: 0, max: 2, step: 0.01 }
            );
            
            // Displacement Controls
            rippleFolder.addInput(
                this.material.uniforms.uDisplacementFrequency,
                'value',
                { label: 'Ripple Freq', min: 0, max: 5, step: 0.1 }
            );
            
            rippleFolder.addInput(
                this.material.uniforms.uDisplacementStrength,
                'value',
                { label: 'Ripple Height', min: 0, max: 1, step: 0.01 }
            );
        }
    }

    setMesh()
    {
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.scene.add(this.mesh)
    }

    update()
    {
        // Update variations
        for(let _variationName in this.variations)
        {
            const variation = this.variations[_variationName]
            variation.target = this.audioSource && this.audioSource.ready ? variation.getValue() : variation.getDefault()
            
            const easing = variation.target > variation.current ? variation.upEasing : variation.downEasing
            variation.current += (variation.target - variation.current) * easing * this.time.delta
        }

        // Time
        this.timeFrequency = this.variations.lowLevel.current
        this.elapsedTime = this.time.delta * this.timeFrequency

        // Update material
        if(this.audioSource && this.audioSource.isPlaying)
        {
            this.material.uniforms.uDisplacementStrength.value = this.audioSource.volume * 2;
        }
        // else
        // {
        //     const idleStrength = 0.2 + Math.sin(this.time.elapsed/2 * 0.0005) * 0.3;
        //     this.material.uniforms.uDisplacementStrength.value = idleStrength;
        // }
        this.material.uniforms.uDistortionStrength.value = this.variations.highLevel.current
        this.material.uniforms.uFresnelMultiplier.value = this.variations.mediumLevel.current

        // Offset
        const offsetTime = this.elapsedTime * 0.3
        this.offset.spherical.phi = ((Math.sin(offsetTime * 0.001) * Math.sin(offsetTime * 0.00321)) * 0.5 + 0.5) * Math.PI
        this.offset.spherical.theta = ((Math.sin(offsetTime * 0.0001) * Math.sin(offsetTime * 0.000321)) * 0.5 + 0.5) * Math.PI * 2
        this.offset.direction.setFromSpherical(this.offset.spherical)
        this.offset.direction.multiplyScalar(this.timeFrequency * 2)

        this.material.uniforms.uOffset.value.add(this.offset.direction)

        // Time
        this.material.uniforms.uTime.value += this.elapsedTime
    }
}