import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'uta-sound-alerts-enabled'

export function useAudioAlert() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored !== null ? JSON.parse(stored) : true
  })

  useEffect(() => {
    audioRef.current = new Audio('/alarm.mp3')
    audioRef.current.preload = 'auto'

    return () => {
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(soundEnabled))
  }, [soundEnabled])

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev: boolean) => !prev)
  }, [])

  const playAlert = useCallback(async () => {
    if (!soundEnabled || !audioRef.current) return

    try {
      audioRef.current.currentTime = 0
      await audioRef.current.play()
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        console.warn('[AudioAlert] Autoplay blocked - user interaction required')
      } else {
        console.error('[AudioAlert] Playback failed:', error)
      }
    }
  }, [soundEnabled])

  return { soundEnabled, toggleSound, playAlert }
}
