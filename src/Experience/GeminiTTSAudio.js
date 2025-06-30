import Experience from './Experience.js'

export default class GeminiTTSAudio
{
    constructor()
    {
        this.experience = new Experience()
        this.debug = true // Force debug logging for troubleshooting
        // this.debug = this.experience.debug
        
        this.audioElement = null
        this.ready = false
        this.volume = 0
        this.levels = []
        this.isPlaying = false
        this.floatTimeDomainData = null
        this.byteFrequencyData = null

        this.audioContext = null
        this.mediaElementSourceNode = null
        this.analyserNode = null

    }

    setAudioElement(_element)
    {
        if (this.audioContext) {
            this.destroy();
        }
        
        this.audioElement = _element

        if(this.audioElement)
        {
            this.init()
        }
    }

    init()
    {
        this.audioContext = new AudioContext()
        
        this.mediaElementSourceNode = this.audioContext.createMediaElementSource(this.audioElement)
        
        this.analyserNode = this.audioContext.createAnalyser()
        this.analyserNode.fftSize = 256
        
        this.mediaElementSourceNode.connect(this.analyserNode)
        this.analyserNode.connect(this.audioContext.destination)
        
        this.floatTimeDomainData = new Float32Array(this.analyserNode.fftSize)
        this.byteFrequencyData = new Uint8Array(this.analyserNode.fftSize)
        
        this.ready = true

    }

    getLevels()
    {
        if(!this.ready) return []

        const levelsCount = 16
        const levels = []
        const levelStep = Math.floor(this.byteFrequencyData.length / levelsCount)

        for(let i = 0; i < levelsCount; i++)
        {
            let sum = 0
            for(let j = 0; j < levelStep; j++)
            {
                sum += this.byteFrequencyData[i * levelStep + j]
            }
            levels.push(sum / levelStep / 255)
        }

        return levels
    }

    getVolume()
    {
        if(!this.ready) return 0

        let sumSquares = 0.0
        for(const amplitude of this.floatTimeDomainData)
        {
            sumSquares += amplitude * amplitude
        }

        return Math.sqrt(sumSquares / this.floatTimeDomainData.length)
    }

    update()
    {

        // If global analyser exists but not ready, set ready
        if (!this.ready && typeof window !== 'undefined' && window.latestTTSAnalyser) {
            this.ready = true;
        }
        if(!this.ready) {
            return
        }

        // Use global analyser if present
        let analyser = null;
        if (typeof window !== 'undefined' && window.latestTTSAnalyser) {
            analyser = window.latestTTSAnalyser;
            if (!this.byteFrequencyData || this.byteFrequencyData.length !== analyser.frequencyBinCount) {
                this.byteFrequencyData = new Uint8Array(analyser.frequencyBinCount);
            }
            if (!this.floatTimeDomainData || this.floatTimeDomainData.length !== analyser.fftSize) {
                this.floatTimeDomainData = new Float32Array(analyser.fftSize);
            }
            analyser.getByteFrequencyData(this.byteFrequencyData);
            analyser.getFloatTimeDomainData(this.floatTimeDomainData);
            this.volume = this.byteFrequencyData.reduce((a, b) => a + b, 0) / this.byteFrequencyData.length / 256;
            this.levels = Array.from(this.byteFrequencyData).map(v => v / 256);

        } else if(this.analyserNode) {
            this.analyserNode.getByteFrequencyData(this.byteFrequencyData)
            this.analyserNode.getFloatTimeDomainData(this.floatTimeDomainData)
            this.volume = this.byteFrequencyData.reduce((a, b) => a + b, 0) / this.byteFrequencyData.length / 256
            this.levels = Array.from(this.byteFrequencyData).map(v => v / 256)
        }
        else
        {
            console.log('[DEBUG] GeminiTTSAudio: no analyserNode or global analyser, skipping update')
        }
    }

    destroy()
    {
        if(this.mediaElementSourceNode) {
            this.mediaElementSourceNode.disconnect();
        }
        if(this.analyserNode) {
            this.analyserNode.disconnect();
        }
        if(this.audioContext) {
            this.audioContext.close()
        }

        this.audioContext = null
        this.mediaElementSourceNode = null
        this.analyserNode = null
        this.ready = false
    }
}
