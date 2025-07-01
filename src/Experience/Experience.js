import * as THREE from 'three'
// import { Pane } from 'tweakpane'

import Time from './Utils/Time.js'
import Sizes from './Utils/Sizes.js'
import Stats from './Utils/Stats.js'

import Resources from './Resources.js'
import Renderer from './Renderer.js'
import Camera from './Camera.js'
import World from './World.js'

import assets from './assets.js'
import Microphone from './Microphone.js'
import GeminiTTSAudio from './GeminiTTSAudio.js'

export default class Experience
{
    static instance

    constructor(_options = {})
    {
        if(Experience.instance)
        {
            // If we already have an instance, update the target element if provided
            if (_options.targetElement) {
                Experience.instance.targetElement = _options.targetElement;
                // Re-append the canvas if it exists
                if (Experience.instance.renderer && Experience.instance.renderer.instance) {
                    const canvas = Experience.instance.renderer.instance.domElement;
                    if (canvas.parentElement) {
                        canvas.parentElement.removeChild(canvas);
                    }
                    _options.targetElement.appendChild(canvas);
                    Experience.instance.renderer.resize();
                }
            }
            return Experience.instance;
        }
        Experience.instance = this;

        // Options
        this.targetElement = _options.targetElement || document.body;

        this.time = new Time()
        this.sizes = new Sizes()
        this.setConfig()
        this.setStats()
        this.setDebug()
        this.setScene()
        this.setCamera()
        this.setRenderer()
        this.setResources()
                this.setMicrohopne()
        this.setGeminiTTSAudio()
        this.setWorld()
        
        this.sizes.on('resize', () =>
        {
            this.resize()
        })

        this.update()
    }

    setConfig()
    {
        this.config = {}
    
        // Debug
        this.config.debug = window.location.hash === '#debug'

        // Pixel ratio
        this.config.pixelRatio = Math.min(Math.max(window.devicePixelRatio, 1), 2)

        // Width and height
        const boundings = this.targetElement.getBoundingClientRect()
        this.config.width = boundings.width
        this.config.height = boundings.height || window.innerHeight
    }

    setStats()
    {
        if(this.config.debug)
        {
            this.stats = new Stats(true)
        }
    }

    setDebug()
    {
        if(this.config.debug)
        {
            // this.debug = new Pane()
            // this.debug.containerElem_.style.width = '320px'
        }
    }
    
    setScene()
    {
        this.scene = new THREE.Scene()
    }

    setCamera()
    {
        this.camera = new Camera()
    }

    setRenderer()
    {
        this.renderer = new Renderer()
        if (this.targetElement) {
            this.targetElement.appendChild(this.renderer.instance.domElement)
        } else {
            document.body.appendChild(this.renderer.instance.domElement)
        }
    }

    setResources()
    {
        this.resources = new Resources(assets)
    }

    setMicrohopne()
    {
        this.microphone = new Microphone()
    }

    setGeminiTTSAudio()
    {
        this.geminiTTSAudio = new GeminiTTSAudio()
    }

    setWorld()
    {
        this.world = new World()
    }

    update()
    {
        if(this.stats)
            this.stats.update()
        
        this.camera.update()

        // Update both analyzers
        if(this.microphone) this.microphone.update()
        if(this.geminiTTSAudio) this.geminiTTSAudio.update()

        // Debug: log microphone, TTS, and blended audio levels/volume
        // if (this.microphone && this.microphone.ready) {
        //     console.log('[DEBUG] Microphone:', {
        //         volume: this.microphone.volume,
        //         levels: this.microphone.levels
        //     });
        // }
        // if (this.geminiTTSAudio && this.geminiTTSAudio.ready) {
        //     console.log('[DEBUG] GeminiTTS:', {
        //         volume: this.geminiTTSAudio.volume,
        //         levels: this.geminiTTSAudio.levels
        //     });
        // }

        // Audio source blending: use the louder of mic or TTS at any moment
        let blendedAudioSource = null;
        const isListening = typeof window !== 'undefined' && window.convaiIsListening;
        if (isListening && this.microphone && this.microphone.ready && this.geminiTTSAudio && this.geminiTTSAudio.ready) {
            // Both available: blend
            const micLevels = this.microphone.levels || [];
            const ttsLevels = this.geminiTTSAudio.levels || [];
            const maxLen = Math.max(micLevels.length, ttsLevels.length);
            const blendedLevels = [];
            for (let i = 0; i < maxLen; i++) {
                blendedLevels[i] = Math.max(micLevels[i] || 0, ttsLevels[i] || 0);
            }
            blendedAudioSource = {
                ready: true,
                volume: Math.max(this.microphone.volume || 0, this.geminiTTSAudio.volume || 0),
                levels: blendedLevels
            };
        } else if (isListening && this.microphone && this.microphone.ready) {
            blendedAudioSource = this.microphone;
        } else if (this.geminiTTSAudio && this.geminiTTSAudio.ready) {
            blendedAudioSource = this.geminiTTSAudio;
        } else {
            blendedAudioSource = null;
        }

        // Pass the blended audio source to the sphere
        if(this.world && this.world.sphere) {
            this.world.sphere.audioSource = blendedAudioSource;
        }

        if(this.world)
            this.world.update()
        
        if(this.renderer)
            this.renderer.update()

        window.requestAnimationFrame(() =>
        {
            this.update()
        })
    }

    resize()
    {
        // Config
        const boundings = this.targetElement.getBoundingClientRect()
        this.config.width = boundings.width
        this.config.height = boundings.height

        this.config.pixelRatio = Math.min(Math.max(window.devicePixelRatio, 1), 2)

        if(this.camera)
            this.camera.resize()

        if(this.renderer)
            this.renderer.resize()

        if(this.world)
            this.world.resize()

        if(this.world)
            this.world.resize()
    }

    destroy()
    {
        
    }
}
