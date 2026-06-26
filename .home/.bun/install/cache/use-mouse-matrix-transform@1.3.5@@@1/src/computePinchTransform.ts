import { Matrix, compose, translate, scale } from "transformation-matrix"

type Point = { x: number; y: number }

interface PinchInput {
  initialTransform: Matrix
  initialTouch1: Point
  initialTouch2: Point
  finalTouch1: Point | null
  finalTouch2: Point | null
}

export const computePinchTransform = ({
  initialTransform,
  initialTouch1,
  initialTouch2,
  finalTouch1,
  finalTouch2,
}: PinchInput): Matrix => {
  if (!finalTouch1 || !finalTouch2) {
    return initialTransform
  }
  // Calculate initial and current centers
  const initialCenter = {
    x: (initialTouch1.x + initialTouch2.x) / 2,
    y: (initialTouch1.y + initialTouch2.y) / 2,
  }
  const currentCenter = {
    x: (finalTouch1.x + finalTouch2.x) / 2,
    y: (finalTouch1.y + finalTouch2.y) / 2,
  }

  // Calculate initial and current distances between touch points
  const initialDist = Math.hypot(
    initialTouch2.x - initialTouch1.x,
    initialTouch2.y - initialTouch1.y,
  )
  const currentDist = Math.hypot(
    finalTouch2.x - finalTouch1.x,
    finalTouch2.y - finalTouch1.y,
  )

  // Calculate the scaling factor, prevent division by zero
  const s = initialDist === 0 ? 1 : currentDist / initialDist

  // Calculate the translation delta
  const deltaX = currentCenter.x - initialCenter.x
  const deltaY = currentCenter.y - initialCenter.y

  // Compose the transformation matrix
  // 1. Translate by the delta movement of the center
  // 2. Translate to the initial center
  // 3. Scale around the initial center
  // 4. Translate back from the initial center
  // 5. Apply the initial transform before the pinch started
  const pinchTransform = compose(
    translate(deltaX, deltaY),
    translate(initialCenter.x, initialCenter.y),
    scale(s, s),
    translate(-initialCenter.x, -initialCenter.y),
    initialTransform,
  )

  return pinchTransform
}
