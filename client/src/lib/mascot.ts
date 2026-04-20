// Deterministic mascot SVG generator
// Same slug always produces the same mascot

function hashSlug(slug: string): number[] {
  const nums: number[] = [];
  let h = 5381;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) + h) ^ slug.charCodeAt(i);
    h = h >>> 0;
  }
  for (let i = 0; i < 16; i++) {
    h = ((h * 1664525 + 1013904223) >>> 0);
    nums.push(h);
  }
  return nums;
}

function pick<T>(arr: T[], n: number): T {
  return arr[Math.abs(n) % arr.length];
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

export type MascotConfig = {
  bodyShape: "round" | "square" | "hex" | "diamond" | "blob";
  eyeStyle: "circle" | "square" | "star" | "heart" | "triangle";
  mouthStyle: "smile" | "grin" | "beam" | "line" | "open";
  antennaStyle: "single" | "double" | "spring" | "none" | "fork";
  armStyle: "wave" | "up" | "down" | "cross" | "none";
  primaryColor: string;
  secondaryColor: string;
  eyeColor: string;
  accentColor: string;
  cheekColor: string;
  hasGlasses: boolean;
  hasCrown: boolean;
  hasHalo: boolean;
  hasStar: boolean;
  bodyScale: number;
};

const BODY_COLORS = [
  "#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98D8C8",
  "#F7DC6F","#BB8FCE","#85C1E9","#F1948A","#82E0AA","#F8C471","#AED6F1",
  "#A9DFBF","#F9E79F","#D7BDE2","#A3E4D7","#FAD7A0","#D5DBDB",
];

const EYE_COLORS = ["#2C3E50","#1A1A2E","#0D0D0D","#2E4057","#1B2631","#17202A"];

const ACCENT_COLORS = ["#FF9FF3","#54A0FF","#5F27CD","#00D2D3","#FF9F43","#EE5A24","#C8D6E5","#8395A7"];

export function getMascotConfig(slug: string, overrideColor?: string): MascotConfig {
  const h = hashSlug(slug);
  const bodyShapes: MascotConfig["bodyShape"][] = ["round","square","hex","diamond","blob"];
  const eyeStyles: MascotConfig["eyeStyle"][] = ["circle","square","star","heart","triangle"];
  const mouthStyles: MascotConfig["mouthStyle"][] = ["smile","grin","beam","line","open"];
  const antennaStyles: MascotConfig["antennaStyle"][] = ["single","double","spring","none","fork"];
  const armStyles: MascotConfig["armStyle"][] = ["wave","up","down","cross","none"];

  const primaryColor = overrideColor ?? pick(BODY_COLORS, h[0]);
  const secondaryColor = pick(BODY_COLORS, h[1]);
  const eyeColor = pick(EYE_COLORS, h[2]);
  const accentColor = pick(ACCENT_COLORS, h[3]);

  // Derive cheek color from primary
  const cheekColor = primaryColor + "88";

  return {
    bodyShape: pick(bodyShapes, h[4]),
    eyeStyle: pick(eyeStyles, h[5]),
    mouthStyle: pick(mouthStyles, h[6]),
    antennaStyle: pick(antennaStyles, h[7]),
    armStyle: pick(armStyles, h[8]),
    primaryColor,
    secondaryColor,
    eyeColor,
    accentColor,
    cheekColor,
    hasGlasses: (h[9] % 5) === 0,
    hasCrown: (h[10] % 7) === 0,
    hasHalo: (h[11] % 9) === 0,
    hasStar: (h[12] % 4) === 0,
    bodyScale: 0.85 + ((h[13] % 30) / 100),
  };
}

export function generateMascotSVG(slug: string, size = 120, overrideColor?: string): string {
  const cfg = getMascotConfig(slug, overrideColor);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size * 0.38) * cfg.bodyScale;

  // Body path
  let bodyPath = "";
  if (cfg.bodyShape === "round") {
    bodyPath = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${cfg.primaryColor}" />`;
  } else if (cfg.bodyShape === "square") {
    const hw = r * 0.9;
    bodyPath = `<rect x="${cx - hw}" y="${cy - hw}" width="${hw * 2}" height="${hw * 2}" rx="${hw * 0.25}" fill="${cfg.primaryColor}" />`;
  } else if (cfg.bodyShape === "hex") {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
    bodyPath = `<polygon points="${pts}" fill="${cfg.primaryColor}" />`;
  } else if (cfg.bodyShape === "diamond") {
    bodyPath = `<polygon points="${cx},${cy - r} ${cx + r * 0.8},${cy} ${cx},${cy + r} ${cx - r * 0.8},${cy}" fill="${cfg.primaryColor}" />`;
  } else {
    // blob
    const blobR = r * 1.05;
    bodyPath = `<ellipse cx="${cx}" cy="${cy + r * 0.05}" rx="${blobR}" ry="${blobR * 0.92}" fill="${cfg.primaryColor}" />`;
  }

  // Eyes
  const eyeY = cy - r * 0.15;
  const eyeOffX = r * 0.32;
  const eyeR = r * 0.14;
  let eyes = "";
  if (cfg.eyeStyle === "circle") {
    eyes = `
      <circle cx="${cx - eyeOffX}" cy="${eyeY}" r="${eyeR}" fill="${cfg.eyeColor}" />
      <circle cx="${cx + eyeOffX}" cy="${eyeY}" r="${eyeR}" fill="${cfg.eyeColor}" />
      <circle cx="${cx - eyeOffX + eyeR * 0.3}" cy="${eyeY - eyeR * 0.25}" r="${eyeR * 0.3}" fill="white" opacity="0.7" />
      <circle cx="${cx + eyeOffX + eyeR * 0.3}" cy="${eyeY - eyeR * 0.25}" r="${eyeR * 0.3}" fill="white" opacity="0.7" />`;
  } else if (cfg.eyeStyle === "square") {
    const ew = eyeR * 1.6;
    eyes = `
      <rect x="${cx - eyeOffX - ew / 2}" y="${eyeY - ew / 2}" width="${ew}" height="${ew}" rx="2" fill="${cfg.eyeColor}" />
      <rect x="${cx + eyeOffX - ew / 2}" y="${eyeY - ew / 2}" width="${ew}" height="${ew}" rx="2" fill="${cfg.eyeColor}" />`;
  } else if (cfg.eyeStyle === "star") {
    const starPath = (x: number, y: number) => {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? eyeR : eyeR * 0.4;
        return `${x + rad * Math.cos(a)},${y + rad * Math.sin(a)}`;
      }).join(" ");
      return `<polygon points="${pts}" fill="${cfg.eyeColor}" />`;
    };
    eyes = starPath(cx - eyeOffX, eyeY) + starPath(cx + eyeOffX, eyeY);
  } else if (cfg.eyeStyle === "heart") {
    eyes = `
      <text x="${cx - eyeOffX}" y="${eyeY + eyeR * 0.5}" text-anchor="middle" font-size="${eyeR * 2}" fill="${cfg.eyeColor}">♥</text>
      <text x="${cx + eyeOffX}" y="${eyeY + eyeR * 0.5}" text-anchor="middle" font-size="${eyeR * 2}" fill="${cfg.eyeColor}">♥</text>`;
  } else {
    // triangle
    const tw = eyeR * 1.5;
    eyes = `
      <polygon points="${cx - eyeOffX},${eyeY - tw / 2} ${cx - eyeOffX + tw / 2},${eyeY + tw / 2} ${cx - eyeOffX - tw / 2},${eyeY + tw / 2}" fill="${cfg.eyeColor}" />
      <polygon points="${cx + eyeOffX},${eyeY - tw / 2} ${cx + eyeOffX + tw / 2},${eyeY + tw / 2} ${cx + eyeOffX - tw / 2},${eyeY + tw / 2}" fill="${cfg.eyeColor}" />`;
  }

  // Mouth
  const mouthY = cy + r * 0.28;
  const mouthW = r * 0.45;
  let mouth = "";
  if (cfg.mouthStyle === "smile") {
    mouth = `<path d="M ${cx - mouthW} ${mouthY} Q ${cx} ${mouthY + r * 0.22} ${cx + mouthW} ${mouthY}" stroke="${cfg.eyeColor}" stroke-width="${r * 0.07}" fill="none" stroke-linecap="round" />`;
  } else if (cfg.mouthStyle === "grin") {
    mouth = `<path d="M ${cx - mouthW} ${mouthY} Q ${cx} ${mouthY + r * 0.3} ${cx + mouthW} ${mouthY}" stroke="${cfg.eyeColor}" stroke-width="${r * 0.07}" fill="${cfg.accentColor}88" stroke-linecap="round" />`;
  } else if (cfg.mouthStyle === "beam") {
    mouth = `<line x1="${cx - mouthW}" y1="${mouthY}" x2="${cx + mouthW}" y2="${mouthY}" stroke="${cfg.eyeColor}" stroke-width="${r * 0.07}" stroke-linecap="round" />`;
  } else if (cfg.mouthStyle === "line") {
    mouth = `<path d="M ${cx - mouthW * 0.6} ${mouthY} L ${cx + mouthW * 0.6} ${mouthY}" stroke="${cfg.eyeColor}" stroke-width="${r * 0.06}" stroke-linecap="round" />`;
  } else {
    // open
    mouth = `<ellipse cx="${cx}" cy="${mouthY}" rx="${mouthW * 0.6}" ry="${r * 0.12}" fill="${cfg.eyeColor}" />`;
  }

  // Cheeks
  const cheeks = `
    <circle cx="${cx - r * 0.55}" cy="${cy + r * 0.1}" r="${r * 0.16}" fill="${cfg.cheekColor}" opacity="0.6" />
    <circle cx="${cx + r * 0.55}" cy="${cy + r * 0.1}" r="${r * 0.16}" fill="${cfg.cheekColor}" opacity="0.6" />`;

  // Antenna
  let antenna = "";
  const antBase = cy - r;
  if (cfg.antennaStyle === "single") {
    antenna = `
      <line x1="${cx}" y1="${antBase}" x2="${cx}" y2="${antBase - r * 0.55}" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.08}" stroke-linecap="round" />
      <circle cx="${cx}" cy="${antBase - r * 0.6}" r="${r * 0.12}" fill="${cfg.accentColor}" />`;
  } else if (cfg.antennaStyle === "double") {
    antenna = `
      <line x1="${cx - r * 0.2}" y1="${antBase}" x2="${cx - r * 0.3}" y2="${antBase - r * 0.5}" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.07}" stroke-linecap="round" />
      <circle cx="${cx - r * 0.3}" cy="${antBase - r * 0.55}" r="${r * 0.1}" fill="${cfg.accentColor}" />
      <line x1="${cx + r * 0.2}" y1="${antBase}" x2="${cx + r * 0.3}" y2="${antBase - r * 0.5}" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.07}" stroke-linecap="round" />
      <circle cx="${cx + r * 0.3}" cy="${antBase - r * 0.55}" r="${r * 0.1}" fill="${cfg.accentColor}" />`;
  } else if (cfg.antennaStyle === "spring") {
    antenna = `
      <path d="M ${cx} ${antBase} Q ${cx + r * 0.15} ${antBase - r * 0.2} ${cx} ${antBase - r * 0.35} Q ${cx - r * 0.15} ${antBase - r * 0.5} ${cx} ${antBase - r * 0.6}" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.07}" fill="none" stroke-linecap="round" />
      <circle cx="${cx}" cy="${antBase - r * 0.65}" r="${r * 0.1}" fill="${cfg.accentColor}" />`;
  } else if (cfg.antennaStyle === "fork") {
    antenna = `
      <line x1="${cx}" y1="${antBase}" x2="${cx}" y2="${antBase - r * 0.35}" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.08}" stroke-linecap="round" />
      <line x1="${cx}" y1="${antBase - r * 0.35}" x2="${cx - r * 0.2}" y2="${antBase - r * 0.6}" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.07}" stroke-linecap="round" />
      <line x1="${cx}" y1="${antBase - r * 0.35}" x2="${cx + r * 0.2}" y2="${antBase - r * 0.6}" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.07}" stroke-linecap="round" />`;
  }

  // Arms
  const armY = cy + r * 0.05;
  let arms = "";
  if (cfg.armStyle === "wave") {
    arms = `
      <path d="M ${cx - r} ${armY} Q ${cx - r * 1.3} ${armY - r * 0.3} ${cx - r * 1.2} ${armY - r * 0.6}" stroke="${cfg.primaryColor}" stroke-width="${r * 0.15}" fill="none" stroke-linecap="round" />
      <path d="M ${cx + r} ${armY} Q ${cx + r * 1.3} ${armY - r * 0.3} ${cx + r * 1.2} ${armY - r * 0.6}" stroke="${cfg.primaryColor}" stroke-width="${r * 0.15}" fill="none" stroke-linecap="round" />`;
  } else if (cfg.armStyle === "up") {
    arms = `
      <line x1="${cx - r}" y1="${armY}" x2="${cx - r * 1.35}" y2="${armY - r * 0.55}" stroke="${cfg.primaryColor}" stroke-width="${r * 0.15}" stroke-linecap="round" />
      <line x1="${cx + r}" y1="${armY}" x2="${cx + r * 1.35}" y2="${armY - r * 0.55}" stroke="${cfg.primaryColor}" stroke-width="${r * 0.15}" stroke-linecap="round" />`;
  } else if (cfg.armStyle === "down") {
    arms = `
      <line x1="${cx - r}" y1="${armY}" x2="${cx - r * 1.35}" y2="${armY + r * 0.45}" stroke="${cfg.primaryColor}" stroke-width="${r * 0.15}" stroke-linecap="round" />
      <line x1="${cx + r}" y1="${armY}" x2="${cx + r * 1.35}" y2="${armY + r * 0.45}" stroke="${cfg.primaryColor}" stroke-width="${r * 0.15}" stroke-linecap="round" />`;
  } else if (cfg.armStyle === "cross") {
    arms = `
      <line x1="${cx - r}" y1="${armY}" x2="${cx - r * 1.4}" y2="${armY}" stroke="${cfg.primaryColor}" stroke-width="${r * 0.15}" stroke-linecap="round" />
      <line x1="${cx + r}" y1="${armY}" x2="${cx + r * 1.4}" y2="${armY}" stroke="${cfg.primaryColor}" stroke-width="${r * 0.15}" stroke-linecap="round" />`;
  }

  // Accessories
  let accessories = "";
  if (cfg.hasGlasses) {
    const gw = eyeR * 1.8;
    accessories += `
      <circle cx="${cx - eyeOffX}" cy="${eyeY}" r="${gw}" fill="none" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.05}" opacity="0.8" />
      <circle cx="${cx + eyeOffX}" cy="${eyeY}" r="${gw}" fill="none" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.05}" opacity="0.8" />
      <line x1="${cx - eyeOffX + gw}" y1="${eyeY}" x2="${cx + eyeOffX - gw}" y2="${eyeY}" stroke="${cfg.secondaryColor}" stroke-width="${r * 0.04}" />`;
  }
  if (cfg.hasCrown) {
    const crownY = cy - r - r * 0.05;
    accessories += `
      <polygon points="${cx - r * 0.35},${crownY} ${cx - r * 0.35},${crownY - r * 0.3} ${cx - r * 0.15},${crownY - r * 0.15} ${cx},${crownY - r * 0.35} ${cx + r * 0.15},${crownY - r * 0.15} ${cx + r * 0.35},${crownY - r * 0.3} ${cx + r * 0.35},${crownY}" fill="${cfg.accentColor}" />`;
  }
  if (cfg.hasHalo) {
    accessories += `<ellipse cx="${cx}" cy="${cy - r * 1.1}" rx="${r * 0.5}" ry="${r * 0.1}" fill="none" stroke="${cfg.accentColor}" stroke-width="${r * 0.07}" opacity="0.9" />`;
  }
  if (cfg.hasStar) {
    const sx = cx + r * 0.75;
    const sy = cy - r * 0.75;
    const sr = r * 0.12;
    const starPts = Array.from({ length: 10 }, (_, i) => {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? sr : sr * 0.4;
      return `${sx + rad * Math.cos(a)},${sy + rad * Math.sin(a)}`;
    }).join(" ");
    accessories += `<polygon points="${starPts}" fill="${cfg.accentColor}" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs>
      <filter id="shadow-${slug}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="${r * 0.06}" stdDeviation="${r * 0.08}" flood-color="${cfg.primaryColor}44" />
      </filter>
    </defs>
    <g filter="url(#shadow-${slug})">
      ${arms}
      ${bodyPath}
      ${cheeks}
      ${eyes}
      ${mouth}
      ${antenna}
      ${accessories}
    </g>
  </svg>`;
}

export function getMascotDataUrl(slug: string, size = 120, overrideColor?: string): string {
  const svg = generateMascotSVG(slug, size, overrideColor);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
