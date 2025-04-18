interface MediaRecorderOptions {
    mimeType?: string
    audioBitsPerSecond?: number
    videoBitsPerSecond?: number
    bitsPerSecond?: number
}

interface MediaRecorderDataAvailableEvent extends Event {
    data: Blob
}

interface MediaRecorderEventMap {
    'dataavailable': MediaRecorderDataAvailableEvent
    'error': Event
    'pause': Event
    'resume': Event
    'start': Event
    'stop': Event
}

interface MediaRecorder extends EventTarget {
    readonly state: 'inactive' | 'recording' | 'paused'
    readonly stream: MediaStream
    readonly mimeType: string
    audioBitsPerSecond: number
    videoBitsPerSecond: number
    ondataavailable: ((event: MediaRecorderDataAvailableEvent) => void) | null
    onerror: ((event: Event) => void) | null
    onpause: ((event: Event) => void) | null
    onresume: ((event: Event) => void) | null
    onstart: ((event: Event) => void) | null
    onstop: ((event: Event) => void) | null
    start(timeslice?: number): void
    stop(): void
    pause(): void
    resume(): void
    requestData(): void
    addEventListener<K extends keyof MediaRecorderEventMap>(type: K, listener: (event: MediaRecorderEventMap[K]) => void): void
    removeEventListener<K extends keyof MediaRecorderEventMap>(type: K, listener: (event: MediaRecorderEventMap[K]) => void): void
}

declare const MediaRecorder: {
    prototype: MediaRecorder
    new(stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder
    isTypeSupported(mimeType: string): boolean
}

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVoiceRecordingReturn {
    isRecording: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
    error: string | null;
    audioLevel: number;
}

export const useVoiceRecording = (): UseVoiceRecordingReturn => {
    const [isRecording, setIsRecording] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [audioLevel, setAudioLevel] = useState(0)
    
    const mediaRecorder = useRef<MediaRecorder | null>(null)
    const audioChunks = useRef<Blob[]>([])
    const audioContext = useRef<AudioContext | null>(null)
    const analyser = useRef<AnalyserNode | null>(null)

    useEffect(() => {
        let animationFrameId: number;

        const analyzeAudio = () => {
            if (!analyser.current || !isRecording) return;
            
            const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
            analyser.current.getByteTimeDomainData(dataArray);
            
            // Calculate RMS (Root Mean Square) for better volume detection
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const value = (dataArray[i] - 128) / 128;
                sum += value * value;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            
            // Convert to logarithmic scale for better visual representation
            const logVolume = Math.log1p(rms * 100) / Math.log1p(1);
            setAudioLevel(Math.min(logVolume, 1));

            animationFrameId = requestAnimationFrame(analyzeAudio);
        };

        if (isRecording) {
            analyzeAudio();
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isRecording]);

    const startRecording = useCallback(async () => {
        try {
            setError(null)
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            
            // Set up audio analysis
            audioContext.current = new AudioContext()
            const source = audioContext.current.createMediaStreamSource(stream)
            analyser.current = audioContext.current.createAnalyser()
            source.connect(analyser.current)
            
            // Configure media recorder
            mediaRecorder.current = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            })

            mediaRecorder.current.ondataavailable = (event) => {
                audioChunks.current.push(event.data)
            }

            mediaRecorder.current.onstop = () => {
                stream.getTracks().forEach(track => track.stop())
                if (audioContext.current) {
                    audioContext.current.close()
                }
            }

            mediaRecorder.current.start()
            setIsRecording(true)
            
        } catch (err) {
            setError('Microphone access denied. Please enable permissions in your browser settings.')
            setIsRecording(false)
            console.error('Recording error:', err)
        }
    }, [])

    const stopRecording = useCallback(async (): Promise<Blob | null> => {
        if (!mediaRecorder.current) return null
        
        return new Promise((resolve) => {
            mediaRecorder.current!.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' })
                audioChunks.current = []
                setIsRecording(false)
                setAudioLevel(0)
                resolve(audioBlob)
            }
            
            mediaRecorder.current!.stop()
            mediaRecorder.current = null
        })
    }, [])

    return {
        isRecording,
        startRecording,
        stopRecording,
        error,
        audioLevel
    }
}
