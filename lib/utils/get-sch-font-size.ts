import type { Matrix } from "transformation-matrix"

// Net label font size constant (0.18mm)
export const getSchMmFontSize = () => {
  return 0.18
}

export const getSchScreenFontSize = (transform: Matrix) => {
  return Math.abs(transform.a) * getSchMmFontSize()
}
