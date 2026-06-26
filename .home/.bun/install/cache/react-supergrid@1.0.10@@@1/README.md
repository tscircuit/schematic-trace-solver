# react-supergrid

[online demo](https://supergrid.tscircuit.com) &middot; [npm](https://npmjs.com/package/react-supergrid)

Easily create a grid with infinitely nesting subgrid cells.

![gif of grid](https://user-images.githubusercontent.com/1910070/260363547-3bacbace-d6cc-42e3-b1f4-62ab173f218b.gif)

```ts
import React from "react"
import { SuperGrid } from "react-supergrid"
import { useMouseMatrixTransform } from "use-mouse-matrix-transform"

export const MyApp = () => {
  const { transform, ref } = useMouseMatrixTransform()

  return (
    <div ref={ref}>
      <SuperGrid width={1000} height={1000} transform={transform} />
    </div>
  )
}
```

## Installation

```bash
npm add react-supergrid
```

## More

- [use-mouse-matrix-transform](https://github.com/seveibar/use-mouse-matrix-transform)
- [transformation-matrix](https://github.com/chrvadala/transformation-matrix)
- [tscircuit](https://tscircuit.com) [(github)](https://github.com/tscircuit/tscircuit)
