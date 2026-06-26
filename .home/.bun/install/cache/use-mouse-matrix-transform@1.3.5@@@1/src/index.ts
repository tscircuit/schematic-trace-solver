import {
  Matrix,
  identity,
  translate,
  compose,
  applyToPoint,
  scale,
} from "transformation-matrix"
// import { fromTwoMovingPoints } from "transformation-matrix" // Not used currently
import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { computePinchTransform } from "./computePinchTransform"

type Point = { x: number; y: number }

interface Props {
  canvasElm?: HTMLElement
  transform?: Matrix
  initialTransform?: Matrix
  onSetTransform?: (transform: Matrix) => any
  enabled?: boolean
  shouldDrag?: (e: MouseEvent | TouchEvent | WheelEvent) => boolean
}

export const useMouseMatrixTransform = (props: Props = {}) => {
  const extRef = useRef<any>(null)
  const [lastDragCancelTime, setLastDragCancelTime] = useState(0)
  const outerCanvasElm = props.canvasElm ?? extRef.current
  const [internalTransform, setInternalTransform] = useState<Matrix>(
    props.initialTransform ?? identity(),
  )
  const [waitCounter, setWaitCounter] = useState(0)
  const [extChangeCounter, incExtChangeCounter] = useReducer((s) => s + 1, 0)

  const setTransform = useCallback(
    (newTransform: Matrix) => {
      if (props.onSetTransform) {
        props.onSetTransform(newTransform)
      }
      if (!props.transform) {
        setInternalTransform(newTransform)
      }
    },
    [props.onSetTransform, setInternalTransform],
  )

  const setTransformExt = useCallback(
    (newTransform: Matrix) => {
      setTransform(newTransform)
      incExtChangeCounter()
    },
    [setTransform],
  )

  const transform = props.transform ?? internalTransform

  const cancelDrag = useCallback(() => {
    setLastDragCancelTime(Date.now())
  }, [])

  const gestureModeRef = useRef<"none" | "drag" | "pinch">("none")
  // const lastTouchRef = useRef<{ x: number; y: number } | null>(null) // No longer needed for delta calculation
  const dragDataRef = useRef<{
    initialTransform: Matrix
    initialTouch: Point
  } | null>(null)
  const pinchDataRef = useRef<{
    initialTransform: Matrix
    initialTouch1: Point
    initialTouch2: Point
    finalTouch1: Point | null
    finalTouch2: Point | null
  } | null>(null)

  useEffect(() => {
    const canvasElm: HTMLCanvasElement | null =
      props.canvasElm ?? extRef.current
    if (canvasElm && !outerCanvasElm) {
      setWaitCounter(waitCounter + 1)
      return
    }
    if (!canvasElm) {
      const timeout = setTimeout(() => {
        setWaitCounter(waitCounter + 1)
      }, 100)
      return () => clearTimeout(timeout)
    }
    let init_tf = props.transform ?? internalTransform

    let m0: Point = { x: 0, y: 0 },
      m1: Point = { x: 0, y: 0 },
      md = false,
      mlastrel: Point = { x: 0, y: 0 }

    const getMousePos = (e: MouseEvent) => {
      return {
        x: e.pageX - canvasElm.getBoundingClientRect().left - window.scrollX,
        y: e.pageY - canvasElm.getBoundingClientRect().top - window.scrollY,
      }
    }

    function handleMouseDown(e: MouseEvent) {
      if (props.enabled === false) return
      if (props.shouldDrag && !props.shouldDrag(e)) return
      m0 = getMousePos(e)
      if (Date.now() - lastDragCancelTime < 100) return
      md = true
      e.preventDefault()
    }
    function handleMouseUp(e: MouseEvent) {
      if (!md || props.enabled === false) return
      if (props.shouldDrag && !props.shouldDrag(e)) return
      m1 = getMousePos(e)

      const new_tf = compose(translate(m1.x - m0.x, m1.y - m0.y), init_tf)
      setTransform(new_tf)
      init_tf = new_tf

      md = false
    }
    function handleMouseMove(e: MouseEvent) {
      mlastrel = getMousePos(e)
      if (!md || props.enabled === false) return
      if (props.shouldDrag && !props.shouldDrag(e)) return
      m1 = getMousePos(e)
      const new_tf = compose(translate(m1.x - m0.x, m1.y - m0.y), init_tf)
      setTransform(new_tf)
    }
    function handleMouseWheel(e: WheelEvent) {
      if (props.enabled === false) return
      if (props.shouldDrag && !props.shouldDrag(e)) return
      const center = getMousePos(e)
      const new_tf = compose(
        translate(center.x, center.y),
        scale(1 - e.deltaY / 1000, 1 - e.deltaY / 1000),
        translate(-center.x, -center.y),
        init_tf,
      )
      setTransform(new_tf)
      init_tf = new_tf
      e.preventDefault()
    }
    function handleMouseOut(e: MouseEvent) {
      if (!md) return
      if (props.shouldDrag && !props.shouldDrag(e)) return

      if (canvasElm) {
        const boundingBox = canvasElm.getBoundingClientRect()
        if (
          e.clientX >= boundingBox.left + 10 &&
          e.clientX <= boundingBox.right - 10 &&
          e.clientY >= boundingBox.top + 10 &&
          e.clientY <= boundingBox.bottom - 10
        ) {
          return
        }
      }

      md = false
      m1 = getMousePos(e)
      const new_tf = compose(translate(m1.x - m0.x, m1.y - m0.y), init_tf)
      setTransform(new_tf)
      init_tf = new_tf
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault()
      if (props.enabled === false) return
      if (e.touches.length === 1) {
        // Start Drag
        gestureModeRef.current = "drag"
        const touch = e.touches[0]
        dragDataRef.current = {
          initialTransform: init_tf, // Capture transform before drag starts
          initialTouch: { x: touch.clientX, y: touch.clientY },
        }
      } else if (e.touches.length === 2) {
        // Start Pinch
        gestureModeRef.current = "pinch"
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        pinchDataRef.current = {
          initialTransform: init_tf, // Store the transform at the start of the pinch
          initialTouch1: { x: touch1.clientX, y: touch1.clientY },
          initialTouch2: { x: touch2.clientX, y: touch2.clientY },
          finalTouch1: null,
          finalTouch2: null,
        }
      }
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault()
      if (props.enabled === false) return
      if (
        gestureModeRef.current === "drag" &&
        e.touches.length === 1 &&
        dragDataRef.current // Check if drag has started
      ) {
        // Handle Drag Move
        const touch = e.touches[0]
        const currentTouch = { x: touch.clientX, y: touch.clientY }
        const deltaX = currentTouch.x - dragDataRef.current.initialTouch.x
        const deltaY = currentTouch.y - dragDataRef.current.initialTouch.y

        // Apply delta to the transform that existed *before* the drag started
        const new_tf = compose(
          translate(deltaX, deltaY),
          dragDataRef.current.initialTransform,
        )
        setTransform(new_tf)
        // Do not update init_tf here
      } else if (
        gestureModeRef.current === "pinch" &&
        e.touches.length === 2 &&
        pinchDataRef.current
      ) {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]

        pinchDataRef.current.finalTouch1 = {
          x: touch1.clientX,
          y: touch1.clientY,
        }
        pinchDataRef.current.finalTouch2 = {
          x: touch2.clientX,
          y: touch2.clientY,
        }

        const new_tf = computePinchTransform(pinchDataRef.current)
        setTransform(new_tf)
        // Don't update init_tf here, only on touch end
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      e.preventDefault()

      // Use changedTouches to get the final position of the lifted finger(s)
      const finalTouch = e.changedTouches[0]

      if (
        gestureModeRef.current === "drag" &&
        dragDataRef.current && // Check if drag was active
        finalTouch // Ensure we have the final touch info
      ) {
        // Drag End
        const finalTouchPos = { x: finalTouch.clientX, y: finalTouch.clientY }
        const deltaX = finalTouchPos.x - dragDataRef.current.initialTouch.x
        const deltaY = finalTouchPos.y - dragDataRef.current.initialTouch.y

        // Calculate the final transform based on the total delta
        const new_tf = compose(
          translate(deltaX, deltaY),
          dragDataRef.current.initialTransform,
        )
        setTransform(new_tf) // Update the visual state
        init_tf = new_tf // Lock in the transform for the next gesture
      } else if (gestureModeRef.current === "pinch" && pinchDataRef.current) {
        const new_tf = computePinchTransform(pinchDataRef.current)
        setTransform(new_tf) // Ensure the final state is set
        init_tf = new_tf // Update init_tf
      }

      // Reset gesture state and data refs
      gestureModeRef.current = "none"
      // lastTouchRef.current = null // No longer used
      dragDataRef.current = null
      pinchDataRef.current = null
    }

    canvasElm.addEventListener("mousedown", handleMouseDown)
    canvasElm.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("mousemove", handleMouseMove)
    canvasElm.addEventListener("mouseout", handleMouseOut)
    canvasElm.addEventListener("wheel", handleMouseWheel)

    canvasElm.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    })
    canvasElm.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    })
    canvasElm.addEventListener("touchend", handleTouchEnd, { passive: false })
    canvasElm.addEventListener("touchcancel", handleTouchEnd, {
      passive: false,
    })

    return () => {
      canvasElm.removeEventListener("mousedown", handleMouseDown)
      canvasElm.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("mousemove", handleMouseMove)
      canvasElm.removeEventListener("mouseout", handleMouseOut)
      canvasElm.removeEventListener("wheel", handleMouseWheel)

      canvasElm.removeEventListener("touchstart", handleTouchStart)
      canvasElm.removeEventListener("touchmove", handleTouchMove)
      canvasElm.removeEventListener("touchend", handleTouchEnd)
      canvasElm.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [
    outerCanvasElm,
    waitCounter,
    extChangeCounter,
    lastDragCancelTime,
    props.enabled,
    props.shouldDrag,
  ])

  const applyTransformToPoint = useCallback(
    (obj: Point | [number, number]) => applyToPoint(transform, obj),
    [transform],
  )

  return {
    ref: extRef,
    transform,
    applyTransformToPoint,
    setTransform: setTransformExt,
    cancelDrag,
  }
}

export default useMouseMatrixTransform
