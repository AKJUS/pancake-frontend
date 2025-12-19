import { memo, useEffect, useRef } from 'react'
import { styled } from 'styled-components'

const XmasStarLayer = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
`

const XmasCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`

export const XmasStarEffect: React.FC = memo(() => {
  const layerRef = useRef<HTMLDivElement>(null)
  const starsCanvasRef = useRef<HTMLCanvasElement>(null)

  // Handles the animated star field drawn via canvas.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const layer = layerRef.current
    const starsCanvas = starsCanvasRef.current

    if (!layer || !starsCanvas) {
      return undefined
    }

    const starCtx = starsCanvas.getContext('2d')

    if (!starCtx) {
      return undefined
    }

    type Entity = {
      update: () => void
    }

    const viewport = { width: 0, height: 0 }
    let animationFrameId = 0
    let resizeFrameId = 0
    let entities: Entity[] = []

    const resizeViewport = () => {
      const width = Math.max(layer.offsetWidth || window.innerWidth, 1)
      const layerHeight = layer.offsetHeight || document.body?.offsetHeight || window.innerHeight
      viewport.width = width
      viewport.height = Math.max(layerHeight, 400)

      starsCanvas.width = viewport.width
      starsCanvas.height = viewport.height
    }

    const createStar = (x: number, y: number): Entity => {
      let starX = x
      let starY = y
      let size = Math.random() * 2
      let speed = Math.random() * 0.1

      const reset = () => {
        size = Math.random() * 2
        speed = Math.random() * 0.1
        starX = viewport.width
        starY = Math.random() * viewport.height
      }

      return {
        update: () => {
          starX -= speed
          if (starX < 0) {
            reset()
          } else {
            starCtx.fillRect(starX, starY, size, size)
          }
        },
      }
    }

    const createShootingStar = (): Entity => {
      let posX = Math.random() * viewport.width
      let posY = 0
      let len = Math.random() * 80 + 10
      let speed = Math.random() * 10 + 6
      let size = Math.random() * 1 + 0.1
      let waitTime = Date.now() + Math.random() * 3000 + 500
      let active = false

      const reset = () => {
        posX = Math.random() * viewport.width
        posY = 0
        len = Math.random() * 80 + 10
        speed = Math.random() * 10 + 6
        size = Math.random() * 1 + 0.1
        waitTime = Date.now() + Math.random() * 3000 + 500
        active = false
      }

      return {
        update: () => {
          if (active) {
            posX -= speed
            posY += speed
            if (posX < 0 || posY >= viewport.height) {
              reset()
            } else {
              starCtx.lineWidth = size
              starCtx.beginPath()
              starCtx.moveTo(posX, posY)
              starCtx.lineTo(posX + len, posY - len)
              starCtx.stroke()
            }
          } else if (waitTime < Date.now()) {
            active = true
          }
        },
      }
    }

    const buildEntities = () => {
      const starEntities: Entity[] = []
      const count = 500
      for (let i = 0; i < count; i += 1) {
        starEntities.push(createStar(Math.random() * viewport.width, Math.random() * viewport.height))
      }
      starEntities.push(createShootingStar())
      starEntities.push(createShootingStar())
      return starEntities
    }

    const animate = () => {
      starCtx.clearRect(0, 0, viewport.width, viewport.height)
      starCtx.fillStyle = '#ffffff'
      starCtx.strokeStyle = '#ffffff'

      for (let i = entities.length - 1; i >= 0; i -= 1) {
        entities[i].update()
      }

      animationFrameId = window.requestAnimationFrame(animate)
    }

    const setupScene = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
      resizeViewport()
      entities = buildEntities()
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
    <XmasStarLayer ref={layerRef}>
      <XmasCanvas ref={starsCanvasRef} />
    </XmasStarLayer>
  )
})
