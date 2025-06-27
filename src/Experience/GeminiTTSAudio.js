import Experience from './Experience.js'

export default class GeminiTTSAudio
{
    constructor()
    {
        this.experience = new Experience()
        this.debug = this.experience.debug
        
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
        if(!this.ready)
            return

        // Retrieve audio data
        this.analyserNode.getByteFrequencyData(this.byteFrequencyData)
        this.analyserNode.getFloatTimeDomainData(this.floatTimeDomainData)
        
        this.volume = this.getVolume()
        this.levels = this.getLevels()
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
