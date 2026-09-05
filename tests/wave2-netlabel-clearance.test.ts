import test from 'ava'

test('Wave 2: Inline Net Label Clearance and Box Bounding Integrity', (t) => {
  interface BoundingBox {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }

  const doesIntersect = (a: BoundingBox, b: BoundingBox): boolean => {
    return !(
      a.maxX <= b.minX ||
      a.minX >= b.maxX ||
      a.maxY <= b.minY ||
      a.minY >= b.maxY
    )
  }

  const labelBox: BoundingBox = { minX: 10, minY: 10, maxX: 30, maxY: 20 }
  const obstacleBox: BoundingBox = { minX: 25, minY: 15, maxX: 45, maxY: 35 }
  const clearBox: BoundingBox = { minX: 50, minY: 50, maxX: 70, maxY: 60 }

  t.true(doesIntersect(labelBox, obstacleBox), 'Overlapping boxes must register intersection')
  t.false(doesIntersect(labelBox, clearBox), 'Disjoint boxes must have zero clearance intersection')
})
