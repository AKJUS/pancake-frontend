import { memo, useEffect, useRef } from 'react'
import { styled } from 'styled-components'

const FireworkLayer = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
`

const FireworkCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  decay: number
  size: number
  hue: number
  brightness: number
  alpha: number
  friction: number
}

interface Firework {
  x: number
  y: number
  targetY: number
  vy: number
  speed: number
  accel: number
  exploded: boolean
  hue: number
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min

export const FireworkEffect: React.FC = memo(() => {
  const layerRef = useRef<HTMLDivElement>(null)
  const fireworkCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const layer = layerRef.current
    const canvas = fireworkCanvasRef.current

    if (!layer || !canvas) {
      return undefined
    }

    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return undefined
    }

    const viewport = { width: 0, height: 0 }
    let animationFrameId = 0
    let resizeFrameId = 0
    const fireworks: Firework[] = []
    const particles: Particle[] = []

    // Firework configuration
    const config = {
      hueMin: 0,
      hueMax: 360,
      hueVariance: 60,
      fworkSpeed: 2,
      fworkAccel: 4,
      partCount: 30,
      partSpeed: 5,
      partSpeedVariance: 10,
      partFriction: 5,
      partGravity: 1,
      flickerDensity: 20,
      clearAlpha: 0,
      lineWidth: 1,
    }

    const resizeViewport = () => {
      const width = Math.max(layer.offsetWidth || window.innerWidth, 1)
      const layerHeight = layer.offsetHeight || document.body?.offsetHeight || window.innerHeight
      viewport.width = width
      viewport.height = Math.max(layerHeight, 400)

      canvas.width = viewport.width
      canvas.height = viewport.height
    }

    const createFirework = (): Firework => {
      const x = rand(viewport.width * 0.2, viewport.width * 0.8)
      const targetY = rand(viewport.height * 0.2, viewport.height * 0.5)
      const hue = rand(config.hueMin, config.hueMax)

      return {
        x,
        y: viewport.height,
        targetY,
        vy: 0,
        speed: config.fworkSpeed,
        accel: config.fworkAccel / 100,
        exploded: false,
        hue,
      }
    }

    const explodeFirework = (firework: Firework) => {
      const { partCount } = config
      for (let i = 0; i < partCount; i += 1) {
        const angle = (Math.PI * 2 * i) / partCount
        const speed = rand(config.partSpeed / 2, config.partSpeed)
        const speedVariance = rand(-config.partSpeedVariance, config.partSpeedVariance) / 10
        const finalSpeed = speed + speedVariance

        const particle: Particle = {
          x: firework.x,
          y: firework.y,
          vx: Math.cos(angle) * finalSpeed,
          vy: Math.sin(angle) * finalSpeed,
          life: 1,
          decay: rand(0.015, 0.03),
          size: rand(1, 3),
          hue: rand(firework.hue - config.hueVariance, firework.hue + config.hueVariance),
          brightness: rand(50, 80),
          alpha: 1,
          friction: 1 - config.partFriction / 100,
        }
        particles.push(particle)
      }
    }

    const updateFirework = (firework: Firework) => {
      if (!firework.exploded) {
        // eslint-disable-next-line no-param-reassign
        firework.vy += firework.accel
        // eslint-disable-next-line no-param-reassign
        firework.y -= firework.speed + firework.vy

        if (firework.y <= firework.targetY) {
          // eslint-disable-next-line no-param-reassign
          firework.exploded = true
          explodeFirework(firework)
        }
      }
    }

    const updateParticle = (particle: Particle) => {
      // eslint-disable-next-line no-param-reassign
      particle.vx *= particle.friction
      // eslint-disable-next-line no-param-reassign
      particle.vy *= particle.friction
      // eslint-disable-next-line no-param-reassign
      particle.vy += config.partGravity / 100

      // eslint-disable-next-line no-param-reassign
      particle.x += particle.vx
      // eslint-disable-next-line no-param-reassign
      particle.y += particle.vy
      // eslint-disable-next-line no-param-reassign
      particle.life -= particle.decay
      // eslint-disable-next-line no-param-reassign
      particle.alpha = particle.life

      return particle.life > 0 && particle.y < viewport.height + 50
    }

    const drawFirework = (firework: Firework) => {
      if (!firework.exploded) {
        ctx.lineWidth = config.lineWidth
        // ctx.strokeStyle = `hsla(${firework.hue}, 100%, 70%, 0.8)`
        ctx.strokeStyle = `white`
        ctx.beginPath()
        ctx.moveTo(firework.x, firework.y)
        ctx.lineTo(firework.x, firework.y + 10)
        ctx.stroke()

        // Draw bright tip
        ctx.fillStyle = `hsla(${firework.hue}, 100%, 100%, 0.8)`
        ctx.beginPath()
        ctx.arc(firework.x, firework.y, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawParticle = (particle: Particle) => {
      // Flicker effect
      const flicker = Math.random() * config.flickerDensity > config.flickerDensity / 2

      if (flicker) {
        ctx.save()
        ctx.globalAlpha = particle.alpha
        // ctx.fillStyle = `hsl(${particle.hue}, 100%, ${particle.brightness}%)`
        ctx.fillStyle = `white`
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    const animate = () => {
      // Use subtle transparency for trail effect instead of black
      ctx.clearRect(0, 0, viewport.width, viewport.height)
      ctx.fillStyle = `rgba(0, 0, 0, ${config.clearAlpha / 200})`
      ctx.fillRect(0, 0, viewport.width, viewport.height)

      // Update and draw fireworks
      for (let i = fireworks.length - 1; i >= 0; i -= 1) {
        const firework = fireworks[i]
        updateFirework(firework)
        drawFirework(firework)

        if (firework.exploded) {
          fireworks.splice(i, 1)
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i]
        if (updateParticle(particle)) {
          drawParticle(particle)
        } else {
          particles.splice(i, 1)
        }
      }

      // Launch new firework occasionally
      if (Math.random() < 0.03 && fireworks.length < 3) {
        fireworks.push(createFirework())
      }

      animationFrameId = window.requestAnimationFrame(animate)
    }

    const setupScene = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
      resizeViewport()
      fireworks.length = 0
      particles.length = 0
      // Clear canvas to be transparent
      ctx.clearRect(0, 0, viewport.width, viewport.height)
      // Start with one firework
      fireworks.push(createFirework())
      animationFrameId = window.requestAnimationFrame(animate)
    }

    const handleResize = () => {
      if (resizeFrameId) {
        window.cancelAnimationFrame(resizeFrameId)
      }
      resizeFrameId = window.requestAnimationFrame(() => {
        setupScene()
      })
    }

    setupScene()
    window.addEventListener('resize', handleResize)

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
      if (resizeFrameId) {
        window.cancelAnimationFrame(resizeFrameId)
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <FireworkLayer ref={layerRef}>
      <FireworkCanvas ref={fireworkCanvasRef} />
    </FireworkLayer>
  )
})
