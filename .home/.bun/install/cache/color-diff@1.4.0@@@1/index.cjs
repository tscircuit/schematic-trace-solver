'use strict';

/**
 * @author Markus Ekholm
 * @copyright 2012-2023 (c) Markus Ekholm <markus at botten dot org >
 * @license Copyright (c) 2012-2023, Markus Ekholm
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the name of the author nor the
 *      names of its contributors may be used to endorse or promote products
 *      derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL MARKUS EKHOLM BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


/**
 * TYPES
 */

/**
 *
 * @typedef { {X: number, Y: number, Z: number} } XYZColor
 * @typedef {import("../").RGBAColor} RGBAColor
 * @typedef {import("../").RGBAColorUc} RGBAColorUc
 * @typedef {import("../").LabColor} LabColor
 */

/**
 * API FUNCTIONS
 */

/**
* Returns c converted to labcolor. Uses bc as background color,
* defaults to using white as background color. Defaults to
* any color without an alpha channel being specified is treated
* as fully opaque (A=1.0)
* @param {RGBAColor} c
* @param {RGBAColor} [bc]
* @return {LabColor} c converted to LabColor
*/
function rgbaToLab(c, bc) {
  bc = normalize(bc || { R: 255, G: 255, B: 255 });
  c = normalize(c);
  let newC = c;

  if (c.A !== undefined) {
    newC = {
      R: bc.R + (c.R - bc.R) * c.A,
      G: bc.G + (c.G - bc.G) * c.A,
      B: bc.B + (c.B - bc.B) * c.A,
    };
  }

  return xyzToLab(rgbToXyz(newC));
}

/**
 * Returns c converted to XYZColor
 * @param {RGBAColorUc} c
 * @return {XYZColor} c
 */
function rgbToXyz(c) {
  // Based on http://www.easyrgb.com/index.php?X=MATH&H=02
  let R = (c.R / 255);
  let G = (c.G / 255);
  let B = (c.B / 255);

  if (R > 0.04045) R = Math.pow(((R + 0.055) / 1.055), 2.4);
  else R = R / 12.92;
  if (G > 0.04045) G = Math.pow(((G + 0.055) / 1.055), 2.4);
  else G = G / 12.92;
  if (B > 0.04045) B = Math.pow(((B + 0.055) / 1.055), 2.4);
  else B = B / 12.92;

  R *= 100;
  G *= 100;
  B *= 100;

  // Observer. = 2°, Illuminant = D65
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  return { X, Y, Z };
}

/**
* Returns c converted to LabColor.
* @param {XYZColor} c
* @return {LabColor} c converted to LabColor
*/
function xyzToLab(c) {
  // Based on http://www.easyrgb.com/index.php?X=MATH&H=07
  const refY = 100.000;
  const refZ = 108.883;
  const refX = 95.047; // Observer= 2°, Illuminant= D65
  let Y = c.Y / refY;
  let Z = c.Z / refZ;
  let X = c.X / refX;
  if (X > 0.008856) X = Math.pow(X, 1 / 3);
  else X = (7.787 * X) + (16 / 116);
  if (Y > 0.008856) Y = Math.pow(Y, 1 / 3);
  else Y = (7.787 * Y) + (16 / 116);
  if (Z > 0.008856) Z = Math.pow(Z, 1 / 3);
  else Z = (7.787 * Z) + (16 / 116);
  const L = (116 * Y) - 16;
  const a = 500 * (X - Y);
  const b = 200 * (Y - Z);
  return { L, a, b };
}

/**
 * @param {RGBAColor} c
 * @returns {RGBAColorUc}
 */
function normalize(c) {
  let r, g, b, a;
  if ("R" in c) {
    r = c.R;
    g = c.G;
    b = c.B;
    a = c.A;
  } else {
    r = c.r;
    g = c.g;
    b = c.b;
    a = c.a;
  }

  /** @type {RGBAColorUc} */
  const normalizedC = { R: r, G: g, B: b };

  if (a !== undefined) normalizedC.A = a;
  return normalizedC;
}

/**
 * @author Markus Ekholm
 * @copyright 2012-2023 (c) Markus Ekholm <markus at botten dot org >
 * @license Copyright (c) 2012-2023, Markus Ekholm
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the name of the author nor the
 *      names of its contributors may be used to endorse or promote products
 *      derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL MARKUS EKHOLM BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


/**
 * TYPES
 */

/**
 * @typedef {import("../").LabColor} LabColor
 * @typedef {import("../").RGBAColor} RGBAColor
 * @typedef {import("../").Color} Color
 */

/**
 * API FUNCTIONS
 */

/**
* Returns diff between c1 and c2 using the CIEDE2000 algorithm
* @param {Color} c1
* @param {Color} c2
* @param {RGBAColor} [bc] background color
* @return {number} Difference between c1 and c2
*/
function ciede2000(c1, c2, bc) {
  if ("R" in c1 || "r" in c1) {
    c1 = rgbaToLab(c1, bc);
  }

  if ("R" in c2 || "r" in c2) {
    c2 = rgbaToLab(c2, bc);
  }
  /**
   * Implemented as in "The CIEDE2000 Color-Difference Formula:
   * Implementation Notes, Supplementary Test Data, and Mathematical Observations"
   * by Gaurav Sharma, Wencheng Wu and Edul N. Dalal.
   */

  // Get L,a,b values for color 1
  const L1 = c1.L;
  const a1 = c1.a;
  const b1 = c1.b;

  // Get L,a,b values for color 2
  const L2 = c2.L;
  const a2 = c2.a;
  const b2 = c2.b;

  // Weight factors
  const kL = 1;
  const kC = 1;
  const kH = 1;

  /**
   * Step 1: Calculate C1p, C2p, h1p, h2p
   */
  const C1 = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2)); // (2)
  const C2 = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2)); // (2)

  const aC1C2 = (C1 + C2) / 2.0; // (3)

  const G = 0.5 * (1 - Math.sqrt(Math.pow(aC1C2, 7.0) /
                          (Math.pow(aC1C2, 7.0) + Math.pow(25.0, 7.0)))); // (4)

  const a1p = (1.0 + G) * a1; // (5)
  const a2p = (1.0 + G) * a2; // (5)

  const C1p = Math.sqrt(Math.pow(a1p, 2) + Math.pow(b1, 2)); // (6)
  const C2p = Math.sqrt(Math.pow(a2p, 2) + Math.pow(b2, 2)); // (6)

  const h1p = hpF(b1, a1p); // (7)
  const h2p = hpF(b2, a2p); // (7)

  /**
   * Step 2: Calculate dLp, dCp, dHp
   */
  const dLp = L2 - L1; // (8)
  const dCp = C2p - C1p; // (9)

  const dhp = dhpF(C1, C2, h1p, h2p); // (10)
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(radians(dhp) / 2.0); // (11)

  /**
   * Step 3: Calculate CIEDE2000 Color-Difference
   */
  const aL = (L1 + L2) / 2.0; // (12)
  const aCp = (C1p + C2p) / 2.0; // (13)

  const aHp = aHpF(C1, C2, h1p, h2p); // (14)
  const T = 1 - 0.17 * Math.cos(radians(aHp - 30)) + 0.24 * Math.cos(radians(2 * aHp)) +
    0.32 * Math.cos(radians(3 * aHp + 6)) - 0.20 * Math.cos(radians(4 * aHp - 63)); // (15)
  const dRo = 30 * Math.exp(-(Math.pow((aHp - 275) / 25, 2))); // (16)
  const RC = Math.sqrt((Math.pow(aCp, 7.0)) / (Math.pow(aCp, 7.0) + Math.pow(25.0, 7.0)));// (17)
  const SL = 1 + ((0.015 * Math.pow(aL - 50, 2)) /
                Math.sqrt(20 + Math.pow(aL - 50, 2.0)));// (18)
  const SC = 1 + 0.045 * aCp;// (19)
  const SH = 1 + 0.015 * aCp * T;// (20)
  const RT = -2 * RC * Math.sin(radians(2 * dRo));// (21)
  const dE = Math.sqrt(Math.pow(dLp / (SL * kL), 2) + Math.pow(dCp / (SC * kC), 2) +
                Math.pow(dHp / (SH * kH), 2) + RT * (dCp / (SC * kC)) *
                (dHp / (SH * kH))); // (22)
  return dE;
}

/**
 * INTERNAL FUNCTIONS
 */

/**
 *
 * @param {number} n
 * @returns {number}
 */
function degrees(n) {
  return n * (180 / Math.PI);
}

/**
 *
 * @param {number} n
 * @returns number
 */
function radians(n) {
  return n * (Math.PI / 180);
}

/**
 *
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
function hpF(x, y) { // (7)
  if (x === 0 && y === 0) return 0;
  else {
    const tmphp = degrees(Math.atan2(x, y));
    if (tmphp >= 0) return tmphp;
    else return tmphp + 360;
  }
}

/**
 *
 * @param {number} C1
 * @param {number} C2
 * @param {number} h1p
 * @param {number} h2p
 * @returns {number}
 */
function dhpF(C1, C2, h1p, h2p) { // (10)
  if (C1 * C2 === 0) return 0;
  else if (Math.abs(h2p - h1p) <= 180) return h2p - h1p;
  else if ((h2p - h1p) > 180) return (h2p - h1p) - 360;
  else if ((h2p - h1p) < -180) return (h2p - h1p) + 360;
  else throw (new Error());
}

/**
 *
 * @param {number} C1
 * @param {number} C2
 * @param {number} h1p
 * @param {number} h2p
 * @returns {number}
 */
function aHpF(C1, C2, h1p, h2p) { // (14)
  if (C1 * C2 === 0) return h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) return (h1p + h2p) / 2.0;
  else if ((Math.abs(h1p - h2p) > 180) && ((h1p + h2p) < 360)) return (h1p + h2p + 360) / 2.0;
  else if ((Math.abs(h1p - h2p) > 180) && ((h1p + h2p) >= 360)) return (h1p + h2p - 360) / 2.0;
  else throw (new Error());
}

/**
 * @author Markus Ekholm
 * @copyright 2012-2023 (c) Markus Ekholm <markus at botten dot org >
 * @license Copyright (c) 2012-2023, Markus Ekholm
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the name of the author nor the
 *      names of its contributors may be used to endorse or promote products
 *      derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL MARKUS EKHOLM BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


/**
 * TYPES
 */

/**
 * @typedef {import("../").LabColor} LabColor
 * @typedef {import("../").RGBAColor} RGBAColor
 * @typedef {import("../").PaletteMapLab} PaletteMapLab
 */

/**
 * API FUNCTIONS
 */

/**
* Returns the hash key used for a {rgbcolor} in a {palettemap}
* @param {RGBAColor} c
* @return {string}
*/
function paletteMapKey(c) {
  c = normalize(c);
  if (c.A !== 1.0) {
    return `rgba(${c.R}, ${c.G}, ${c.B}, ${c.A})`;
  }
  return `rgb(${c.R}, ${c.G}, ${c.B})`;
}

/**
* Returns the hash key used for a {labcolor} in a {labpalettemap}
* @param {LabColor} c should have fields L,a,b
* @return {string}
*/
function labPaletteMapKey(c) {
  return `lab(${c.L}, ${c.a}, ${c.b})`;
}

/**
* Returns a mapping from each color in a to the closest/farthest color in b
* @param { RGBAColor[] } a
* @param { RGBAColor[] } b
* @param {('closest'|'furthest')} [type] should be the string 'closest' or 'furthest'
* @param {RGBAColor} [bc] Optional background color when using alpha channels
* @return {import("../").PaletteMap}
*/
function mapPalette(a, b, type, bc) {
  /** @type {import("../").PaletteMap} */
  const c = {};

  bc = bc || { R: 255, G: 255, B: 255 };
  type = type || "closest";
  for (let idx1 = 0; idx1 < a.length; idx1 += 1) {
    const color1 = a[idx1];
    let bestColor;
    let bestColorDiff;
    for (let idx2 = 0; idx2 < b.length; idx2 += 1) {
      const color2 = b[idx2];
      const currentColorDiff = ciede2000(color1, color2, bc);

      if (!bestColor) {
        bestColor = color2;
        bestColorDiff = currentColorDiff;
        continue;
      }

      if (bestColorDiff !== undefined && (type === "closest") && (currentColorDiff < bestColorDiff)) {
        bestColor = color2;
        bestColorDiff = currentColorDiff;
        continue;
      }

      if (bestColorDiff !== undefined && (type === "furthest") && (currentColorDiff > bestColorDiff)) {
        bestColor = color2;
        bestColorDiff = currentColorDiff;
        continue;
      }
    }
    if (bestColor) c[paletteMapKey(color1)] = bestColor;
  }
  return c;
}

/**
* Returns the closest (or furthest) color to targetColor in palette, operating in the L,a,b colorspace for performance
* @param {LabColor} targetColor should have fields L,a,b
* @param {LabColor[]} palette
* @param {boolean} [findFurthest] should be falsy to find the closest color
* @return {LabColor}
*/
function matchPaletteLab(targetColor, palette, findFurthest) {
  let color2, currentColorDiff;
  let bestColor = palette[0];
  let bestColorDiff = ciede2000(targetColor, bestColor);
  for (let idx2 = 1, l = palette.length; idx2 < l; idx2 += 1) {
    color2 = palette[idx2];
    currentColorDiff = ciede2000(targetColor, color2);

    if (
      (!findFurthest && (currentColorDiff < bestColorDiff)) ||
      (findFurthest && (currentColorDiff > bestColorDiff))
    ) {
      bestColor = color2;
      bestColorDiff = currentColorDiff;
    }
  }
  return bestColor;
}

/**
* Returns a mapping from each color in a to the closest color in b
* @param {LabColor[]} a
* @param {LabColor[]} b each element should have fields L,a,b
* @param {('closest'|'furthest')} [type] should be the string 'closest' or 'furthest'
* @return {PaletteMapLab}
*/
function mapPaletteLab(a, b, type) {
  /** @type {Object<string,LabColor>} */
  const c = {};
  const findFurthest = type === "furthest";
  for (let idx1 = 0; idx1 < a.length; idx1 += 1) {
    const color1 = a[idx1];
    c[labPaletteMapKey(color1)] = matchPaletteLab(color1, b, findFurthest);
  }
  return c;
}

// Types


/**
 * Returns the color in the palette closest to target, given the background color bc
 * @param {RGBAColor} target
 * @param {RGBAColor[]} relative
 * @param {RGBAColor} bc
 * @returns {RGBAColor}
 */
function closest(target, relative, bc) {
  const key = paletteMapKey(target);
  bc = bc || { R: 255, G: 255, B: 255 };
  const result = mapPalette([ target ], relative, "closest", bc);

  return result[key];
}

/**
 * Returns the lab color in the palette closest to target
 * @param {LabColor} target
 * @param {LabColor[]} relative
 * @returns {LabColor}
 */
function closestLab(target, relative) {
  return matchPaletteLab(target, relative, false);
}

/**
 * Returns the color in the palette furthest from target, given the background color bc
 * @param {RGBAColor} target
 * @param {RGBAColor[]} relative
 * @param {RGBAColor} bc
 * @returns {RGBAColor}
 */
function furthest(target, relative, bc) {
  const key = paletteMapKey(target);
  bc = bc || { R: 255, G: 255, B: 255 };
  const result = mapPalette([ target ], relative, "furthest", bc);

  return result[key];
}

/**
 * Returns the color in the palette furthest from target, given the background color bc
 * @param {LabColor} target
 * @param {LabColor[]} relative
 * @returns {LabColor}
 */
function furthestLab(target, relative) {
  return matchPaletteLab(target, relative, true);
}

/** Deprecated function names in snake_case to remain backwards compatible */

/**
* @deprecated since version 1.3
* @param {RGBAColor[]} a
* @param {RGBAColor[]} b
* @param {('closest'|'furthest')} [type]
* @param {RGBAColor} [bc]
* @return {PaletteMap}
*/
// eslint-disable-next-line camelcase
function map_palette(a, b, type, bc) {
  return mapPalette(a, b, type, bc);
}

/**
* @deprecated since version 1.3
* @param {RGBAColor} c
* @return {String}
*/
// eslint-disable-next-line camelcase
function palette_map_key(c) {
  return paletteMapKey(c);
}

/**
* @deprecated since version 1.3
* @param {RGBAColor} c
* @return {LabColor} c
*/
// eslint-disable-next-line camelcase
function rgb_to_lab(c) {
  return rgbaToLab(c);
}

/**
* @deprecated since version 1.3
* @param {RGBAColor} c
* @return {LabColor} c
*/
// eslint-disable-next-line camelcase
function rgba_to_lab(c) {
  return rgbaToLab(c);
}

/**
* @deprecated since version 1.3
* @param {LabColor} targetColor
* @param {LabColor[]} palette
* @param {boolean} [findFurthest]
* @return {LabColor}
*/
// eslint-disable-next-line camelcase
function match_palette_lab(targetColor, palette, findFurthest) {
  return matchPaletteLab(targetColor, palette, findFurthest);
}

/**
* @deprecated since version 1.3
* @param {LabColor[]} a
* @param {LabColor[]} b
* @param {('closest'|'furthest')} [type]
* @return {PaletteMapLab}
*/
// eslint-disable-next-line camelcase
function map_palette_lab(a, b, type) {
  return mapPaletteLab(a, b, type);
}

/**
* @deprecated since version 1.3
* @param {LabColor} c
* @return {string}
*/
// eslint-disable-next-line camelcase
function lab_palette_map_key(c) {
  return labPaletteMapKey(c);
}

/**
* @deprecated since version 1.3
 * @param {LabColor} target
 * @param {LabColor[]} relative
 * @returns {LabColor}
*/
// eslint-disable-next-line camelcase
function closest_lab(target, relative) {
  return closestLab(target, relative);
}

/**
* @deprecated since version 1.3
 * @param {LabColor} target
 * @param {LabColor[]} relative
 * @returns {LabColor}
*/
// eslint-disable-next-line camelcase
function furthest_lab(target, relative) {
  return furthestLab(target, relative);
}

exports.closest = closest;
exports.closestLab = closestLab;
exports.closest_lab = closest_lab;
exports.diff = ciede2000;
exports.furthest = furthest;
exports.furthestLab = furthestLab;
exports.furthest_lab = furthest_lab;
exports.labPaletteMapKey = labPaletteMapKey;
exports.lab_palette_map_key = lab_palette_map_key;
exports.mapPalette = mapPalette;
exports.mapPaletteLab = mapPaletteLab;
exports.map_palette = map_palette;
exports.map_palette_lab = map_palette_lab;
exports.matchPaletteLab = matchPaletteLab;
exports.match_palette_lab = match_palette_lab;
exports.paletteMapKey = paletteMapKey;
exports.palette_map_key = palette_map_key;
exports.rgb_to_lab = rgb_to_lab;
exports.rgbaToLab = rgbaToLab;
exports.rgba_to_lab = rgba_to_lab;
