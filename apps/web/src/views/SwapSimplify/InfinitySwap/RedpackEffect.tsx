import { memo, useEffect, useRef } from 'react'
import { styled } from 'styled-components'

const RedpackLayer = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
`

type FireworkConfig = {
  emojiTypes: string[]
  duration: number
  spawnRate: number
  riseSpeed: number
  particleMin: number
  particleMax: number
  sizeMin: number
  sizeMax: number
  decayTime: number
}

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

export const RedpackEffect: React.FC = memo(() => {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const layer = layerRef.current
    if (!layer) {
      return undefined
    }

    const activeEmojis = new Set<HTMLDivElement>()

    const config: FireworkConfig = {
      emojiTypes: ['🧧'],
      duration: 7,
      spawnRate: 300,
      riseSpeed: 5,
      particleMin: 15,
      particleMax: 30,
      sizeMin: 30,
      sizeMax: 50,
      decayTime: 1000,
    }

    const stop = () => {
      activeEmojis.forEach((emoji) => {
        if (emoji.parentNode) {
          emoji.parentNode.removeChild(emoji)
        }
      })
      activeEmojis.clear()
    }

    const spawnFirework = (spawnX: number, spawnY: number) => {
      const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent)
      const selectedEmoji = config.emojiTypes[Math.floor(Math.random() * config.emojiTypes.length)]
      const rect = layer.getBoundingClientRect()
      const width = rect.width || window.innerWidth
      const height = rect.height || window.innerHeight
      const clampX = Math.min(Math.max(spawnX, 0), width)
      const clampY = Math.min(Math.max(spawnY, 0), height)
      const finalY = isMobile ? Math.min(clampY, height * 0.5) : Math.min(Math.max(clampY, 100), height * 0.4)

      createMobileExplosion(clampX, finalY, selectedEmoji)
    }

    const createMobileExplosion = (centerX: number, centerY: number, emojiType: string) => {
      const particleCount = randomBetween(config.particleMin, config.particleMax)

      for (let i = 0; i < particleCount; i += 1) {
        createParticle(centerX, centerY, emojiType)
      }
    }

    const createParticle = (centerX: number, centerY: number, emojiType: string) => {
      const particle = document.createElement('div')
      particle.textContent = emojiType
      particle.style.position = 'absolute'
      particle.style.pointerEvents = 'none'
      particle.style.userSelect = 'none'
      particle.style.willChange = 'transform, opacity'

      const size = randomBetween(config.sizeMin * 0.6, config.sizeMax * 0.8)
      particle.style.fontSize = `${size}px`
      particle.style.left = `${centerX - size / 2}px`
      particle.style.top = `${centerY - size / 2}px`
      particle.style.opacity = '1'

      layer.appendChild(particle)
      activeEmojis.add(particle as HTMLDivElement)

      const angle = Math.random() * Math.PI * 2
      const velocity = randomBetween(80, 250)
      const vx = Math.cos(angle) * velocity
      const vy = Math.sin(angle) * velocity

      animateParticle(particle as HTMLDivElement, vx, vy, size, centerX - size / 2, centerY - size / 2)
    }

    const animateParticle = (
      particle: HTMLDivElement,
      vx: number,
      vy: number,
      size: number,
      startX: number,
      startY: number,
    ) => {
      const node = particle
      const startTime = performance.now()
      const duration = config.decayTime

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = elapsed / duration

        if (progress >= 1 || !activeEmojis.has(node)) {
          activeEmojis.delete(node)
          if (node.parentNode) {
            node.parentNode.removeChild(node)
          }
          return
        }

        const deltaTime = elapsed / 1000
        const newX = startX + vx * deltaTime
        const newY = startY + vy * deltaTime
        const translateX = newX - startX
        const translateY = newY - startY

        const opacity = 1 - progress
        const scale = 1 - progress * 0.3

        node.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`
        node.style.opacity = `${opacity}`

        requestAnimationFrame(animate)
      }

      requestAnimationFrame(animate)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!layer) return
      const festival = document.getElementById('swap-festival-effect')
      if (!festival) return

      const festivalRect = festival.getBoundingClientRect()
      const withinFestival =
        event.clientX >= festivalRect.left &&
        event.clientX <= festivalRect.right &&
        event.clientY >= festivalRect.top &&
        event.clientY <= festivalRect.bottom

      if (!withinFestival) {
        return
      }
      const rect = layer.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        return
      }

      spawnFirework(x, y)
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      stop()
    }
  }, [])

  return <RedpackLayer ref={layerRef} aria-hidden="true" />
})
