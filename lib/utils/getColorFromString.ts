export const getColorFromString = (string: string, alpha = 1) => {
  // pseudo random number from string
  //
  // `acc * 31 + code` grows without bound: it leaves exact-integer range at
  // 11 characters and overflows to Infinity past ~200, at which point
  // `Infinity % 360` is NaN and the result is an unparseable `hsl(NaN, ...)`.
  // Net ids here are selector paths such as
  // `group > capacitor.C101 > port.pin1 to U100.VOUT`, so deeply nested
  // groups reach that length in practice.
  //
  // Keeping the accumulator in signed 32-bit range via `| 0` is the standard
  // string-hash formulation and stays finite and exact for any input.
  let hash = 0
  for (let i = 0; i < string.length; i++) {
    hash = (hash * 31 + string.charCodeAt(i)) | 0
  }

  // `%` keeps the sign of the dividend, so normalise into [0, 360).
  const hue = ((hash % 360) + 360) % 360

  return `hsl(${hue}, 100%, 50%, ${alpha})`
}
