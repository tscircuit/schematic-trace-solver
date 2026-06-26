"use client"
// Example Usage
import React, { useState } from "react"
import { useMouseMatrixTransform } from "../index"
export default () => {
  const { ref, applyTransformToPoint, transform, cancelDrag } =
    useMouseMatrixTransform()
  const [offCenter, setOffCenter] = useState(false)

  // console.log(transform)

  const gridSize = 10
  const spacing = 50
  const squareSize = 25

  const gridElements = []
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const originalX = 100 + col * spacing
      const originalY = 100 + row * spacing
      const { x: left, y: top } = applyTransformToPoint({
        x: originalX,
        y: originalY,
      }) as any
      const currentSize = squareSize * transform.d

      gridElements.push(
        <div
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            left,
            top,
            width: currentSize,
            height: currentSize,
            backgroundColor: `hsl(${(row * 360) / gridSize}, 70%, 60%)`,
            border: `${1 * transform.d}px solid black`, // Scale border too
            boxSizing: "border-box",
          }}
        />,
      )
    }
  }

  // Calculate position for the cancelDrag button based on one of the grid points
  const { x: cancelLeft, y: cancelTop } = applyTransformToPoint({
    x: 100 + (gridSize - 1) * spacing + 100, // Position relative to the grid
    y: 100,
  }) as any

  return (
    <div style={{ height: 2000 }}>
      <div
        ref={ref}
        style={{
          marginTop: offCenter ? 400 : 0,
          marginLeft: offCenter ? 400 : 0,
          position: "relative",
          backgroundColor: "#eee",
          height: 600,
          width: 600,
          overflow: "hidden",
          border: "1px solid #ccc", // Add border to visualize canvas area
        }}
      >
        {gridElements}
        <div
          style={{
            position: "absolute",
            left: cancelLeft,
            top: cancelTop,
            padding: `${8 * transform.d}px`, // Scale padding
            fontSize: `${12 * transform.d}px`, // Scale font size
            color: "white",
            cursor: "pointer",
            backgroundColor: "blue",
            fontFamily: "monospace",
            whiteSpace: "nowrap", // Prevent text wrapping when scaled down
          }}
          onMouseDown={(e) => {
            // Prevent triggering drag on the canvas when clicking the button
            e.stopPropagation()
            cancelDrag()
          }}
          onTouchStart={(e) => {
            // Prevent triggering touch events on the canvas
            e.stopPropagation()
          }}
        >
          cancelDrag
        </div>
      </div>
      <div>
        <input
          type="checkbox"
          checked={offCenter} // Use checked for controlled component
          onChange={() => setOffCenter(!offCenter)} // Use onChange
        />{" "}
        off
        center
      </div>
      <div style={{ marginTop: 20 }}>Try dragging the canvas above around</div>
    </div>
  )
}
