import React from "react"
import { SuperGrid } from "../src/SuperGrid"
import { useMouseMatrixTransform } from "use-mouse-matrix-transform"

export const CartesianYAxis = () => {
  const { transform, ref } = useMouseMatrixTransform({
    initialTransform: { a: 1, b: 0, c: 0, d: -1, e: 0, f: 0 },
  })

  return (
    <div ref={ref}>
      <SuperGrid width={1000} height={1000} transform={transform} />
    </div>
  )
}

export default {
  title: "CartesianYAxis",
  component: CartesianYAxis,
}
