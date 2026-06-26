import React from "react"
import { SuperGrid } from "../src/SuperGrid"
import { useMouseMatrixTransform } from "use-mouse-matrix-transform"

export const Basic = () => {
  const { transform, ref } = useMouseMatrixTransform()

  return (
    <div ref={ref}>
      <SuperGrid width={1000} height={1000} transform={transform} />
    </div>
  )
}

export default {
  title: "Basic",
  component: Basic,
}
