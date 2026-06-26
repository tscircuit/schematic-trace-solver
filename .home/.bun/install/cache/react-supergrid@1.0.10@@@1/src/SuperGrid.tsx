import React, { useEffect, useRef, useState } from "react"
import { type Matrix, applyToPoint, inverse } from "transformation-matrix"

const rangeInclusive = (start: number, end: number, inc: number) => {
  const result = []
  if (end < start) {
    for (let i = start; i >= end; i -= Math.abs(inc)) {
      result.push(i)
    }
  } else {
    for (let i = start; i <= end; i += Math.abs(inc)) {
      result.push(i)
    }
  }
  return result
}

export interface SuperGridProps {
  /**
   * Represents the transformation between world and screen coordinates
   */
  transform: Matrix
  width: number
  height: number
  screenSpaceCellSize?: number
  textColor?: string
  majorColor?: string
  minorColor?: string
  stringifyCoord?: (x: number, y: number, cellSize?: number) => string
}

function roundPointToZ(Z: number, position: { x: number; y: number }) {
  return {
    x: Math.round(position.x / Z) * Z,
    y: Math.round(position.y / Z) * Z,
  }
}

export function toMeterSI(value: number, Z: number = 1): string {
  if (value < 0) return "-" + toMeterSI(-value)
  if (value < 0.000001) return "0m"

  if (value > 1e3) return Math.floor(value / 1000) + "km"
  if (value > 1 && Z > 1) return Math.round(value) + "m"
  if (value > 1 && Z <= 1) return value.toFixed(Math.ceil(-Math.log10(Z))) + "m"
  if (value < 1 && Z >= 1 / 1000) return Math.round(value * 1000) + "mm"
  if (value < 1 && Z < 1 / 1000)
    return (value * 1000).toFixed(Math.ceil(-Math.log10(Z * 1000))) + "mm"
  return ""
}

export function toMMSI(value: number, Z: number = 1): string {
  return toMeterSI(value / 1000, Z / 1000)
}

export const SuperGrid = (props: SuperGridProps) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const {
    majorColor = "rgba(0,0,0,0.2)",
    minorColor = "rgba(0,0,0,0.1)",
    textColor = props.majorColor ?? "rgba(0,0,0,0.5)",
    width,
    height,
    screenSpaceCellSize = 200,
    stringifyCoord = (x, y, Z) => `${toMeterSI(x, Z)}, ${toMeterSI(y, Z)}`,
  } = props

  /**
   * Max number of major cells you could draw on the screen across it's width
   */
  const cellScreenWidth = Math.ceil(width / screenSpaceCellSize) + 2
  /**
   * Max number of major cells you could draw on the screen across it's height
   */
  const cellScreenHeight = Math.ceil(height / screenSpaceCellSize) + 2

  useEffect(() => {
    if (!ref.current) return
    const ctx = ref.current.getContext("2d")!
    if (!ctx) return

    /**
     * Upper-bound at which minor cell becomes major cell.
     *
     * As you zoom in, this will go from 2000 to 200 to 20 to 2 etc. in discrete
     * steps.
     */
    const Z =
      screenSpaceCellSize / 10 ** Math.floor(Math.log10(props.transform.a))
    const yInvN = props.transform.d < 0 ? -1 : 1
    /**
     * Size of a minor cell in transform space.
     */
    const Za = screenSpaceCellSize / 10 ** Math.log10(props.transform.a)
    /**
     * Percentage transition from major transition point.
     *
     * As you zoom in, Zp goes from 1 to 0 repeatedly
     */
    const Zp = Za / Z

    function drawGridLines(
      z: number,
      start: { x: number; y: number },
      end: { x: number; y: number }
    ) {
      const cellSize = z
      let x: number, y: number
      let lineStart: { x: number; y: number }
      let lineEnd: { x: number; y: number }

      // Vertical Lines
      for (x = start.x; x <= end.x; x += cellSize) {
        lineStart = applyToPoint(props.transform, { x, y: start.y })
        lineEnd = applyToPoint(props.transform, { x, y: end.y })
        ctx.beginPath()
        ctx.moveTo(lineStart.x, lineStart.y)
        ctx.lineTo(lineEnd.x, lineEnd.y)
        ctx.stroke()
      }
      // Horizontal Lines
      const rowYs = rangeInclusive(start.y, end.y, cellSize * yInvN)
      // for (y = start.y; y <= end.y; y += cellSize) {
      for (const y of rowYs) {
        lineStart = applyToPoint(props.transform, { x: start.x, y })
        lineEnd = applyToPoint(props.transform, { x: end.x, y })
        ctx.beginPath()
        ctx.moveTo(lineStart.x, lineStart.y)
        ctx.lineTo(lineEnd.x, lineEnd.y)
        ctx.stroke()
      }
    }

    function drawGridText(
      z: number,
      start: { x: number; y: number },
      end: { x: number; y: number }
    ) {
      const cellSize = z
      let x: number, y: number

      for (x = start.x; x <= end.x; x += cellSize) {
        for (const y of rangeInclusive(start.y, end.y, cellSize * yInvN)) {
          const point = applyToPoint(props.transform, { x, y })
          ctx.fillStyle = textColor
          ctx.font = `12px sans-serif`
          ctx.fillText(stringifyCoord(x, y, z), point.x + 2, point.y - 2)
        }
      }
    }

    ctx.clearRect(0, 0, width, height)

    const topLeft = applyToPoint(inverse(props.transform), { x: 0, y: 0 })

    const zRoundedOffsetTopLeft = {
      x: Math.floor((topLeft.x - Z) / Z) * Z,
      // when y is cartesian (yInvN = -1), we need to add 2 rows to the top
      y: Math.floor((topLeft.y - Z) / Z + (yInvN == -1 ? 2 : 0)) * Z,
    }
    const zRoundedOffsetBottomRight = {
      x: zRoundedOffsetTopLeft.x + Z * cellScreenWidth,
      y: zRoundedOffsetTopLeft.y + Z * cellScreenHeight * yInvN,
    }

    const textN = 5
    const NZ = Z * textN
    const NZRoundedOffsetTopLeft = {
      x: Math.floor((topLeft.x - NZ) / NZ) * NZ,
      // when y is cartesian (yInvN = -1), we need to add 2 rows to the top
      y: Math.floor((topLeft.y - NZ) / NZ + (yInvN == -1 ? 2 : 0)) * NZ,
    }
    const NZRoundedOffsetBottomRight = {
      x: NZRoundedOffsetTopLeft.x + NZ * cellScreenWidth,
      y: NZRoundedOffsetTopLeft.y + NZ * cellScreenHeight * yInvN,
    }

    ctx.globalAlpha = 1
    ctx.strokeStyle = majorColor
    // Major Lines
    drawGridLines(Z, zRoundedOffsetTopLeft, zRoundedOffsetBottomRight)
    drawGridText(NZ, NZRoundedOffsetTopLeft, NZRoundedOffsetBottomRight)
    // Minor Lines
    ctx.globalAlpha = 1 - Zp
    drawGridLines(NZ / 10, NZRoundedOffsetTopLeft, NZRoundedOffsetBottomRight)
    ctx.globalAlpha = 1 - Zp
    ctx.strokeStyle = minorColor
    drawGridLines(Z / 10, zRoundedOffsetTopLeft, zRoundedOffsetBottomRight)
    ctx.globalAlpha = Math.max(((1 - Zp) * 10 - 5) / 5, 0)
    drawGridText(NZ / 10, NZRoundedOffsetTopLeft, NZRoundedOffsetBottomRight)

    ctx.globalAlpha = 1
    const projMousePos = applyToPoint(props.transform, mousePos)
    ctx.font = `12px sans-serif`
    ctx.fillStyle = textColor
    ctx.fillText(
      stringifyCoord(mousePos.x, mousePos.y, Z),
      projMousePos.x + 2,
      projMousePos.y - 2
    )
    ctx.strokeStyle = majorColor
    ctx.strokeRect(projMousePos.x - 5, projMousePos.y - 5, 10, 10)
  }, [ref, props.transform, mousePos, width, height])

  const onMouseSetTarget = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ref.current) return
    const Z =
      screenSpaceCellSize / 10 / 10 ** Math.floor(Math.log10(props.transform.a))
    const rect = ref.current.getBoundingClientRect()
    const projM = applyToPoint(inverse(props.transform), {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    const m = roundPointToZ(Z, projM)
    setMousePos(m)
  }

  return (
    <canvas
      onMouseUp={(e) => {
        if (e.button !== 1) return
        onMouseSetTarget(e)
      }}
      onDoubleClick={onMouseSetTarget}
      ref={ref}
      width={props.width}
      height={props.height}
    />
  )
}
