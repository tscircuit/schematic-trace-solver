export const getColorFromString = (string: string, alpha = 1) => {
  // pseudo random number from string
  let hash = 0
  let useModuloHash = false

  for (const char of string.split("")) {
    if (hash >= Number.MAX_VALUE / 31) useModuloHash = true
    if (useModuloHash) hash %= 360
    hash = hash * 31 + char.charCodeAt(0)
  }

  return `hsl(${hash % 360}, 100%, 50%, ${alpha})`
}
