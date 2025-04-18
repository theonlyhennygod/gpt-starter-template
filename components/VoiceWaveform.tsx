import { motion } from "framer-motion"

interface VoiceWaveformProps {
    isRecording: boolean
    level: number  // 0-1 normalized audio level
}

export function VoiceWaveform({ isRecording, level }: VoiceWaveformProps) {
    const bars = Array.from({ length: 4 }, (_, i) => i)
    const normalizedLevel = Math.min(Math.max(level, 0), 1)  // Ensure 0-1 range
    
    // Calculate bar heights based on audio level with variation
    const getBarHeight = (index: number) => {
        const multipliers = [0.8, 1.2, 0.6, 1.0]  // Variation pattern
        const baseHeight = Math.max(normalizedLevel * 100, 15)  // Minimum 15% height for visibility
        const dynamicHeight = baseHeight * multipliers[index]
        
        // Add random variation to simulate natural speech
        return Math.min(dynamicHeight + (Math.random() * 15), 100)
    }
    
    return (
        <div className="flex items-center gap-1 h-4 w-16">
            {bars.map((bar) => (
                <motion.div
                    key={bar}
                    className="w-1.5 bg-red-500 rounded-full"
                    initial={{ height: "10%" }}
                    animate={isRecording ? {
                        height: `${getBarHeight(bar)}%`,
                        transition: {
                            duration: 0.15,
                            ease: "easeOut"
                        }
                    } : {
                        height: "10%",
                        transition: {
                            duration: 0.3,
                        }
                    }}
                />
            ))}
        </div>
    )
} 