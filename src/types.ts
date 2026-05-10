export interface Point {
  x: number
  y: number
}

export interface TraceLine {
  start: Point
  end: Point
  path?: Point[]
}
