import React, { useState, useEffect, useRef } from 'react';
import {
  BLOCK_TABLE,
  nearestBlock,
  HUE_KEYS_SORTED,
  HUE_LABELS,
  BLOCKS_BY_HUE,
  WOOL_HUE,
  RAINBOW_SEQUENCE,
  FONT_STYLES,
  fontCssString,
  generateWorldEditCommands,
  splitIntoParts,
  RGB,
  FontStyleConfig,
  hexToRgb,
} from './lib/colorEngine';
import {
  LogoSvg,
  ImageIcon,
  TextIcon,
  BrushIcon,
  PipetteIcon,
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  TrashIcon,
  PlusIcon,
  BackArrowIcon,
  EyeIcon,
  TerminalIcon,
  LayersIcon,
} from './components/SvgIcons';
import { BackgroundGrid } from './components/BackgroundGrid';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'tab1' | 'tab2' | 'tab3'>('tab1');
  const [mode, setMode] = useState<'image' | 'text' | 'manual' | 'ie'>('image');

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing, please wait...');
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);

  // Grid / pixel state
  const [gridBlocks, setGridBlocks] = useState<(string | null)[][] | null>(null);
  const [gridColors, setGridColors] = useState<(RGB | null)[][] | null>(null);
  const [gridW, setGridW] = useState(0);
  const [gridH, setGridH] = useState(0);

  // Commands state
  const [generatedParts, setGeneratedParts] = useState<string[][]>([]);

  // 1. IMAGE MODE STATE
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState(20);
  const [imageParts, setImageParts] = useState(6);

  // 2. TEXT MODE STATE
  const [textInput, setTextInput] = useState('VIENAS');
  const [selectedFontId, setSelectedFontId] = useState('montserrat');
  const [textSize, setTextSize] = useState(25);
  const [colorMode, setColorMode] = useState<'default' | 'rainbow' | 'custom'>('default');
  const [customColors, setCustomColors] = useState<Record<number, string>>({});
  const [textParts, setTextParts] = useState(1);
  const textLiveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3. MANUAL DRAW MODE STATE
  const [manualSize, setManualSize] = useState(20);
  const [manualParts, setManualParts] = useState(6);
  const [manualPalette, setManualPalette] = useState<{ id: string; rgb: RGB }[]>([]);
  const [activeBrushId, setActiveBrushId] = useState<string | null>(null);
  const [manualColorStep, setManualColorStep] = useState(false);
  const [manualSelectedHue, setManualSelectedHue] = useState<string | null>(null);
  const manualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPaintingRef = useRef(false);

  // 4. IE HELP MODE STATE
  const [ieImage, setIeImage] = useState<HTMLImageElement | null>(null);
  const [iePixelColors, setIePixelColors] = useState<(RGB | null)[][]>([]);
  const [ieSelectedHex, setIeSelectedHex] = useState('Click any pixel to inspect');
  const ieCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Preview canvas
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg);
    setToastIsError(isError);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const copyToClipboard = async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast(successMsg);
    }
  };

  const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

  // Render pixels onto a 2D canvas
  const drawGridOnCanvas = (
    canvas: HTMLCanvasElement | null,
    blocks: (string | null)[][] | null,
    colors: (RGB | null)[][] | null,
    w: number,
    h: number,
    maxDisplayPx: number
  ) => {
    if (!canvas || !blocks || !colors || w === 0 || h === 0) return;
    const cell = Math.max(1, Math.floor(maxDisplayPx / Math.max(w, h)));
    canvas.width = w * cell;
    canvas.height = h * cell;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const col = colors[y]?.[x];
        if (col) {
          ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  };

  // -------------------------------------------------------------
  // IMAGE CONVERSION
  // -------------------------------------------------------------
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setUploadedImage(img);
      showToast('Image loaded successfully');
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  const convertImageToPixelArt = async () => {
    if (!uploadedImage) {
      showToast('Please upload an image first', true);
      return;
    }
    setIsLoading(true);
    setLoadingText('Converting image to MultiCraft pixel blocks...');
    setLoadingProgress(0);

    await nextFrame();

    const targetW = imageSize;
    const targetH = Math.max(
      1,
      Math.round((targetW * uploadedImage.height) / uploadedImage.width)
    );

    const off = document.createElement('canvas');
    off.width = targetW;
    off.height = targetH;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.imageSmoothingEnabled = true;
    octx.drawImage(uploadedImage, 0, 0, targetW, targetH);
    const data = octx.getImageData(0, 0, targetW, targetH).data;

    const bMatrix: (string | null)[][] = [];
    const cMatrix: (RGB | null)[][] = [];

    const ROWS_PER_CHUNK = 8;
    for (let y = 0; y < targetH; y++) {
      const rowB: (string | null)[] = [];
      const rowC: (RGB | null)[] = [];
      for (let x = 0; x < targetW; x++) {
        const idx = (y * targetW + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 20) {
          rowB.push(null);
          rowC.push(null);
        } else {
          const id = nearestBlock(r, g, b);
          rowB.push(id);
          rowC.push(BLOCK_TABLE[id]);
        }
      }
      bMatrix.push(rowB);
      cMatrix.push(rowC);

      if (y % ROWS_PER_CHUNK === 0) {
        setLoadingProgress(Math.round((y / targetH) * 100));
        await nextFrame();
      }
    }

    setGridW(targetW);
    setGridH(targetH);
    setGridBlocks(bMatrix);
    setGridColors(cMatrix);
    setIsLoading(false);
    setActiveTab('tab2');
    showToast('Pixel art generated! Viewing live preview.');
  };

  // -------------------------------------------------------------
  // TEXT & GLYPH MODE ENGINE
  // -------------------------------------------------------------
  const getSelectedFont = (): FontStyleConfig => {
    return FONT_STYLES.find((f) => f.id === selectedFontId) || FONT_STYLES[FONT_STYLES.length - 1];
  };

  const layoutTextLines = (
    ctx: CanvasRenderingContext2D,
    lines: string[],
    refSize: number,
    lsEm: number
  ) => {
    const charLayout: {
      ch: string;
      line: number;
      x: number;
      w: number;
      visIndex: number;
    }[] = [];
    let maxWidth = 0;
    let vis = 0;
    const lineHeight = refSize * 1.25;

    lines.forEach((line, li) => {
      let x = 0;
      Array.from(line).forEach((ch) => {
        const w = ctx.measureText(ch).width || refSize * 0.5;
        const visible = ch.trim() !== '';
        charLayout.push({ ch, line: li, x, w, visIndex: visible ? vis : -1 });
        if (visible) vis++;
        x += w + lsEm * refSize;
      });
      maxWidth = Math.max(maxWidth, x);
    });

    return {
      charLayout,
      maxWidth,
      totalHeight: lines.length * lineHeight,
      lineHeight,
      visibleCount: vis,
    };
  };

  const cropToBoundingBox = (
    blocks: (string | null)[][],
    colors: (RGB | null)[][]
  ) => {
    const h = blocks.length;
    const w = h ? blocks[0].length : 0;
    let minX = w,
      maxX = -1,
      minY = h,
      maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (blocks[y][x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0) return { blocks: [], colors: [], w: 0, h: 0 };
    const nb: (string | null)[][] = [];
    const nc: (RGB | null)[][] = [];
    for (let y = minY; y <= maxY; y++) {
      nb.push(blocks[y].slice(minX, maxX + 1));
      nc.push(colors[y].slice(minX, maxX + 1));
    }
    return { blocks: nb, colors: nc, w: maxX - minX + 1, h: maxY - minY + 1 };
  };

  const processTextToGrid = async () => {
    if (!textInput.trim()) {
      showToast('Please type some text first', true);
      return null;
    }
    const f = getSelectedFont();
    const letterH = textSize;
    const SCALE = letterH >= 40 ? 3 : 6;
    const REF = 100;

    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    if (!mctx) return null;
    mctx.font = fontCssString(f, REF);

    const lines = textInput.split('\n');
    const layout = layoutTextLines(mctx, lines, REF, f.letterSpacingEm);

    if (layout.maxWidth <= 0) return null;

    const sf = (letterH * SCALE) / layout.lineHeight;
    const cw = Math.max(SCALE, Math.round(layout.maxWidth * sf));
    const ch = Math.max(SCALE, Math.round(layout.totalHeight * sf));
    const gW = Math.max(1, Math.round(cw / SCALE));
    const gH = Math.max(1, Math.round(ch / SCALE));

    const mask = document.createElement('canvas');
    mask.width = cw;
    mask.height = ch;
    const mc = mask.getContext('2d');
    if (!mc) return null;
    mc.font = fontCssString(f, REF * sf);
    mc.textBaseline = 'alphabetic';
    mc.fillStyle = '#000000';

    const chars = layout.charLayout.map((c) => ({
      ch: c.ch,
      visIndex: c.visIndex,
      x: c.x * sf,
      w: c.w * sf,
      lineTop: c.line * layout.lineHeight * sf,
      lineBottom: (c.line + 1) * layout.lineHeight * sf,
      baselineY: (c.line + 0.82) * layout.lineHeight * sf,
    }));

    for (const c of chars) {
      mc.fillText(c.ch, c.x, c.baselineY);
    }

    const img = mc.getImageData(0, 0, cw, ch).data;
    const bMatrix: (string | null)[][] = [];
    const cMatrix: (RGB | null)[][] = [];

    for (let gy = 0; gy < gH; gy++) {
      const rb = new Array(gW).fill(null);
      const rc = new Array(gW).fill(null);
      const py0 = gy * SCALE;
      const py1 = Math.min(ch, py0 + SCALE);

      for (let gx = 0; gx < gW; gx++) {
        const px0 = gx * SCALE;
        const px1 = Math.min(cw, px0 + SCALE);
        let sum = 0;
        let n = 0;
        for (let py = py0; py < py1; py++) {
          for (let px = px0; px < px1; px++) {
            sum += img[(py * cw + px) * 4 + 3];
            n++;
          }
        }
        if ((n ? sum / n : 0) > 60) {
          const cx = px0 + SCALE / 2;
          const cy = py0 + SCALE / 2;
          const owner = chars.find(
            (c) =>
              c.visIndex >= 0 &&
              cx >= c.x &&
              cx <= c.x + c.w &&
              cy >= c.lineTop &&
              cy <= c.lineBottom
          );

          let id = 'concrete:concrete';
          if (colorMode === 'rainbow' && owner) {
            id = RAINBOW_SEQUENCE[owner.visIndex % RAINBOW_SEQUENCE.length];
          } else if (
            colorMode === 'custom' &&
            owner &&
            customColors[owner.visIndex]
          ) {
            const rgb = hexToRgb(customColors[owner.visIndex]);
            id = nearestBlock(rgb[0], rgb[1], rgb[2]);
          }

          rb[gx] = id;
          rc[gx] = BLOCK_TABLE[id];
        }
      }
      bMatrix.push(rb);
      cMatrix.push(rc);
    }

    const cr = cropToBoundingBox(bMatrix, cMatrix);
    return cr;
  };

  // Live text update debounce
  useEffect(() => {
    if (mode !== 'text' || textSize >= 40 || !textInput.trim()) return;
    const t = setTimeout(async () => {
      const res = await processTextToGrid();
      if (res && textLiveCanvasRef.current) {
        drawGridOnCanvas(
          textLiveCanvasRef.current,
          res.blocks,
          res.colors,
          res.w,
          res.h,
          260
        );
      }
    }, 280);
    return () => clearTimeout(t);
  }, [textInput, selectedFontId, textSize, colorMode, customColors, mode]);

  const handleTextContinue = async () => {
    setIsLoading(true);
    setLoadingText('Processing styled text into pixel grid...');
    await nextFrame();
    const res = await processTextToGrid();
    setIsLoading(false);
    if (res && res.w > 0) {
      setGridW(res.w);
      setGridH(res.h);
      setGridBlocks(res.blocks);
      setGridColors(res.colors);
      setActiveTab('tab2');
      showToast('Text converted! Viewing live preview.');
    } else {
      showToast('No printable pixels detected for this text.', true);
    }
  };

  // -------------------------------------------------------------
  // MANUAL CANVAS DRAWING
  // -------------------------------------------------------------
  const initManualCanvas = (size: number) => {
    const blocks = Array.from({ length: size }, () => new Array(size).fill(null));
    const colors = Array.from({ length: size }, () => new Array(size).fill(null));
    setGridW(size);
    setGridH(size);
    setGridBlocks(blocks);
    setGridColors(colors);
  };

  useEffect(() => {
    if (mode === 'manual' && (!gridBlocks || gridW !== manualSize)) {
      initManualCanvas(manualSize);
    }
  }, [mode, manualSize]);

  useEffect(() => {
    if (mode === 'manual' && manualCanvasRef.current && gridBlocks && gridColors) {
      drawGridOnCanvas(manualCanvasRef.current, gridBlocks, gridColors, gridW, gridH, 440);
    }
  }, [gridBlocks, gridColors, mode, gridW, gridH]);

  const paintPixelAtPointer = (clientX: number, clientY: number) => {
    const canvas = manualCanvasRef.current;
    if (!canvas || !gridBlocks || !gridColors) return;
    const rect = canvas.getBoundingClientRect();
    const cellW = canvas.width / gridW;
    const cellH = canvas.height / gridH;
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    const gx = Math.floor(px / cellW);
    const gy = Math.floor(py / cellH);

    if (gx < 0 || gy < 0 || gx >= gridW || gy >= gridH) return;

    const nb = gridBlocks.map((r) => [...r]);
    const nc = gridColors.map((r) => [...r]);

    if (activeBrushId) {
      nb[gy][gx] = activeBrushId;
      nc[gy][gx] = BLOCK_TABLE[activeBrushId];
    } else {
      nb[gy][gx] = null;
      nc[gy][gx] = null;
    }

    setGridBlocks(nb);
    setGridColors(nc);
  };

  const handleManualPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isPaintingRef.current = true;
    paintPixelAtPointer(e.clientX, e.clientY);
  };

  const handleManualPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPaintingRef.current) {
      paintPixelAtPointer(e.clientX, e.clientY);
    }
  };

  const handleManualPointerUp = () => {
    isPaintingRef.current = false;
  };

  const addBlockToPalette = (id: string, rgb: RGB) => {
    if (!manualPalette.find((p) => p.id === id)) {
      setManualPalette((prev) => [...prev, { id, rgb }]);
    }
    setActiveBrushId(id);
    setManualColorStep(false);
    setManualSelectedHue(null);
    showToast(`Selected ${id} for brush`);
  };

  const handleManualContinue = () => {
    const filled = countFilledBlocks();
    if (!gridBlocks || filled === 0) {
      showToast('Please paint at least one block on the canvas!', true);
      return;
    }
    setActiveTab('tab2');
    showToast('Manual pixel art loaded into preview.');
  };

  // -------------------------------------------------------------
  // IE HELP 16x16 MODE
  // -------------------------------------------------------------
  const handleIeImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setIeImage(img);
      processIeCanvas(img);
      showToast('16x16 inspection canvas ready');
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  const rgbToHexStr = (r: number, g: number, b: number) =>
    '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();

  const processIeCanvas = (img: HTMLImageElement) => {
    const off = document.createElement('canvas');
    off.width = 16;
    off.height = 16;
    const oc = off.getContext('2d');
    if (!oc) return;
    oc.imageSmoothingEnabled = true;
    oc.drawImage(img, 0, 0, 16, 16);
    const d = oc.getImageData(0, 0, 16, 16).data;

    const matrix: (RGB | null)[][] = [];
    for (let y = 0; y < 16; y++) {
      const row: (RGB | null)[] = [];
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        if (d[i + 3] > 20) {
          row.push([d[i], d[i + 1], d[i + 2]]);
        } else {
          row.push(null);
        }
      }
      matrix.push(row);
    }
    setIePixelColors(matrix);
    renderIeOnCanvas(matrix);
  };

  const renderIeOnCanvas = (matrix: (RGB | null)[][]) => {
    const canvas = ieCanvasRef.current;
    if (!canvas) return;
    const cell = 12; // 192px total
    canvas.width = 16 * cell;
    canvas.height = 16 * cell;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const rgb = matrix[y]?.[x];
        if (rgb) {
          ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
          ctx.fillRect(x * cell, y * cell, cell, cell);
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#11170a' : '#1c2612';
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  };

  const handleIeCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ieCanvasRef.current;
    if (!canvas || !iePixelColors.length) return;
    const r = canvas.getBoundingClientRect();
    const cell = canvas.width / 16;
    const gx = Math.floor(((e.clientX - r.left) * (canvas.width / r.width)) / cell);
    const gy = Math.floor(((e.clientY - r.top) * (canvas.height / r.height)) / cell);

    if (gx < 0 || gy < 0 || gx >= 16 || gy >= 16) return;
    const rgb = iePixelColors[gy]?.[gx];
    if (rgb) {
      const hexCode = rgbToHexStr(rgb[0], rgb[1], rgb[2]);
      setIeSelectedHex(`[X:${gx}, Y:${gy}] -> ${hexCode}`);
      copyToClipboard(hexCode, `Copied HEX ${hexCode} to clipboard!`);
    } else {
      setIeSelectedHex(`[X:${gx}, Y:${gy}] -> Transparent Blank`);
    }
  };

  const copyAllIeHex = () => {
    if (!iePixelColors.length) {
      showToast('Please upload an image first', true);
      return;
    }
    const lines: string[] = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const rgb = iePixelColors[y]?.[x];
        if (rgb) {
          lines.push(`X:${x} Y:${y} -> ${rgbToHexStr(rgb[0], rgb[1], rgb[2])}`);
        }
      }
    }
    if (!lines.length) {
      showToast('No solid pixels to copy', true);
      return;
    }
    copyToClipboard(lines.join('\n'), 'Copied all 16x16 HEX codes to clipboard!');
  };

  // -------------------------------------------------------------
  // TAB 2: LIVE PREVIEW & EXPORT
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeTab === 'tab2' && previewCanvasRef.current && gridBlocks && gridColors) {
      drawGridOnCanvas(
        previewCanvasRef.current,
        gridBlocks,
        gridColors,
        gridW,
        gridH,
        480
      );
    }
  }, [activeTab, gridBlocks, gridColors, gridW, gridH]);

  const countFilledBlocks = () => {
    if (!gridBlocks) return 0;
    let n = 0;
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        if (gridBlocks[y]?.[x]) n++;
      }
    }
    return n;
  };

  const downloadPixelArtPng = () => {
    if (!previewCanvasRef.current || !gridBlocks) {
      showToast('No pixel art to download', true);
      return;
    }
    const link = document.createElement('a');
    link.download = `multicraft_pixelart_${gridW}x${gridH}.png`;
    link.href = previewCanvasRef.current.toDataURL('image/png');
    link.click();
    showToast('PNG image downloaded successfully!');
  };

  // -------------------------------------------------------------
  // TAB 3: COMMAND GENERATION (180° INVERTED)
  // -------------------------------------------------------------
  const generateCommands = async () => {
    if (!gridBlocks || countFilledBlocks() === 0) {
      showToast('No pixel art blocks available to compile', true);
      return;
    }

    setIsLoading(true);
    setLoadingText('Generating WorldEdit commands with 180° inverted orientation...');
    await nextFrame();

    const lines = generateWorldEditCommands(gridBlocks, gridW, gridH);

    let partsCount = imageParts;
    if (mode === 'text') partsCount = textParts;
    else if (mode === 'manual') partsCount = manualParts;

    const parts = splitIntoParts(lines, partsCount);
    setGeneratedParts(parts);
    setIsLoading(false);
    setActiveTab('tab3');
    showToast(`Compiled ${lines.length} lines into ${partsCount} parts!`);
  };

  return (
    <div className="relative min-h-screen text-[#f3fbe4] select-none font-sans overflow-x-hidden">
      {/* Interactive Background Grid & Ambient Glow */}
      <BackgroundGrid />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-[#233113] border-t-[#bef264] animate-spin" />
            <div className="absolute inset-2 rounded-full border-2 border-[#bef264]/20 border-b-[#bef264] animate-spin" style={{ animationDirection: 'reverse' }} />
          </div>
          <p className="text-base font-semibold text-[#bef264] tracking-wide mb-1 glow-pistachio-text">
            {loadingText}
          </p>
          {loadingProgress > 0 && (
            <div className="w-56 bg-[#12180c] rounded-full h-2 overflow-hidden border border-[#233113]">
              <div
                className="bg-[#bef264] h-full transition-all duration-150"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border text-sm font-semibold shadow-2xl backdrop-blur-md transition-all duration-300 ${
            toastIsError
              ? 'bg-[#2b0808]/90 border-red-500 text-red-200'
              : 'bg-[#0b1206]/95 border-[#bef264] text-[#bef264] glow-pistachio-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            {!toastIsError && <CheckIcon size={16} color="#bef264" />}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 border-b border-[#233113] bg-[#000000]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#0e1608] border border-[#233113] glow-pistachio-sm">
              <LogoSvg size={28} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center justify-center sm:justify-start gap-2">
                Pixel Art <span className="text-[#bef264] glow-pistachio-text">Generator</span>
              </h1>
              <p className="text-xs text-[#8ca36d]">
                2D Pixel Art WorldEdit Command Studio for MultiCraft &amp; Minetest
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Tabbar Navigation */}
      <nav className="sticky top-0 z-30 bg-[#000000]/90 backdrop-blur-md border-b border-[#233113]">
        <div className="max-w-4xl mx-auto flex">
          <button
            onClick={() => setActiveTab('tab1')}
            className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition border-b-2 ${
              activeTab === 'tab1'
                ? 'border-[#bef264] text-[#bef264] bg-[#0c1307]'
                : 'border-transparent text-[#8ca36d] hover:text-[#f3fbe4]'
            }`}
          >
            <BrushIcon size={16} />
            <span>1. Generator Studio</span>
          </button>
          <button
            onClick={() => gridBlocks && setActiveTab('tab2')}
            disabled={!gridBlocks}
            className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition border-b-2 ${
              activeTab === 'tab2'
                ? 'border-[#bef264] text-[#bef264] bg-[#0c1307]'
                : 'border-transparent text-[#8ca36d] disabled:opacity-30 disabled:cursor-not-allowed hover:text-[#f3fbe4]'
            }`}
          >
            <EyeIcon size={16} />
            <span>2. Live Preview</span>
          </button>
          <button
            onClick={() => generatedParts.length > 0 && setActiveTab('tab3')}
            disabled={generatedParts.length === 0}
            className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition border-b-2 ${
              activeTab === 'tab3'
                ? 'border-[#bef264] text-[#bef264] bg-[#0c1307]'
                : 'border-transparent text-[#8ca36d] disabled:opacity-30 disabled:cursor-not-allowed hover:text-[#f3fbe4]'
            }`}
          >
            <TerminalIcon size={16} />
            <span>3. WorldEdit Commands</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* ============================================================== */}
        {/* TAB 1: GENERATOR MODES */}
        {/* ============================================================== */}
        {activeTab === 'tab1' && (
          <div className="space-y-6">
            {/* Mode Selector Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#090e05] p-2 rounded-2xl border border-[#233113]">
              <button
                type="button"
                onClick={() => setMode('image')}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  mode === 'image'
                    ? 'bg-[#bef264] text-black font-bold shadow-md shadow-[#bef264]/20'
                    : 'text-[#8ca36d] hover:text-[#f3fbe4] hover:bg-[#12180c]'
                }`}
              >
                <ImageIcon size={16} />
                <span>From Image</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('text')}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  mode === 'text'
                    ? 'bg-[#bef264] text-black font-bold shadow-md shadow-[#bef264]/20'
                    : 'text-[#8ca36d] hover:text-[#f3fbe4] hover:bg-[#12180c]'
                }`}
              >
                <TextIcon size={16} />
                <span>Text &amp; Glyphs</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  mode === 'manual'
                    ? 'bg-[#bef264] text-black font-bold shadow-md shadow-[#bef264]/20'
                    : 'text-[#8ca36d] hover:text-[#f3fbe4] hover:bg-[#12180c]'
                }`}
              >
                <BrushIcon size={16} />
                <span>Manual Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('ie')}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  mode === 'ie'
                    ? 'bg-[#bef264] text-black font-bold shadow-md shadow-[#bef264]/20'
                    : 'text-[#8ca36d] hover:text-[#f3fbe4] hover:bg-[#12180c]'
                }`}
              >
                <PipetteIcon size={16} />
                <span>/ie Inspector</span>
              </button>
            </div>

            {/* 1. IMAGE MODE */}
            {mode === 'image' && (
              <div className="bg-[#090d05]/90 border border-[#233113] rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex items-center gap-2 border-b border-[#233113] pb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#bef264] shadow-[0_0_8px_#bef264]" />
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Image &amp; Dimensions Configuration
                  </h2>
                </div>

                {/* Upload File */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold block">
                    Upload Source Image
                  </label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#233113] hover:border-[#bef264] rounded-xl cursor-pointer bg-[#0e1508]/60 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      <ImageIcon size={28} className="text-[#bef264] mb-2" />
                      <p className="text-sm font-medium text-white">
                        {uploadedImage ? 'Click to replace current image' : 'Click or drop PNG, JPG, or WebP'}
                      </p>
                      <p className="text-xs text-[#8ca36d] mt-1">
                        High or low resolution accepted (auto scaled)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageFileChange}
                    />
                  </label>
                </div>

                {/* Size Slider */}
                <div className="space-y-3 bg-[#0e1508]/40 p-4 rounded-xl border border-[#233113]/60">
                  <div className="flex justify-between items-center">
                    <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold">
                      Target Width Resolution (Max 200x)
                    </label>
                    <span className="text-lg font-mono font-bold text-[#bef264] glow-pistachio-text">
                      {imageSize}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="200"
                    value={imageSize}
                    onChange={(e) => setImageSize(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-[#1b250f] rounded-lg appearance-none cursor-pointer"
                  />
                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[16, 20, 32, 40, 50, 75, 100, 150, 200].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setImageSize(sz)}
                        className={`text-xs px-2.5 py-1 rounded-md border font-mono transition ${
                          imageSize === sz
                            ? 'bg-[#bef264] text-black font-bold border-[#bef264]'
                            : 'bg-[#12180c] text-[#8ca36d] border-[#233113] hover:text-[#bef264]'
                        }`}
                      >
                        {sz}x
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#8ca36d]">
                    Full unlocked range up to 200x without restrictions or passwords.
                  </p>
                </div>

                {/* Parts Divider */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold block">
                    Divide Commands Into Equal Parts
                  </label>
                  <select
                    value={imageParts}
                    onChange={(e) => setImageParts(parseInt(e.target.value, 10))}
                    className="w-full bg-[#0e1508] border border-[#233113] focus:border-[#bef264] rounded-xl px-4 py-3 text-sm text-white outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? '1 Part (Single Full Execution)' : `Divide into ${n} Parts ${n === 6 ? '(Recommended default)' : ''}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Convert Button */}
                <button
                  type="button"
                  onClick={convertImageToPixelArt}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#bef264] to-[#a3df42] text-black font-bold text-base hover:brightness-110 active:scale-[0.99] transition shadow-lg shadow-[#bef264]/20 flex items-center justify-center gap-2"
                >
                  <BrushIcon size={18} color="#000" />
                  <span>Convert to MultiCraft Pixel Art</span>
                </button>
              </div>
            )}

            {/* 2. TEXT & GLYPH MODE */}
            {mode === 'text' && (
              <div className="bg-[#090d05]/90 border border-[#233113] rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex items-center gap-2 border-b border-[#233113] pb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#bef264] shadow-[0_0_8px_#bef264]" />
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Text &amp; Glyph Studio
                  </h2>
                </div>

                {/* Text Area */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold block">
                    Text String (Multi-line supported)
                  </label>
                  <textarea
                    rows={3}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type words, symbols, or letters..."
                    className="w-full bg-[#0e1508] border border-[#233113] focus:border-[#bef264] rounded-xl p-3 text-white text-base outline-none resize-y"
                  />
                </div>

                {/* Font Selector */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold">
                      Typography Font (30 Google Web Fonts)
                    </label>
                    <span className="text-xs text-[#8ca36d]">
                      Suggested: {getSelectedFont().recommended}x
                    </span>
                  </div>
                  <select
                    value={selectedFontId}
                    onChange={(e) => {
                      setSelectedFontId(e.target.value);
                      const f = FONT_STYLES.find((font) => font.id === e.target.value);
                      if (f) setTextSize(f.recommended);
                    }}
                    className="w-full bg-[#0e1508] border border-[#233113] focus:border-[#bef264] rounded-xl px-4 py-3 text-sm text-white outline-none cursor-pointer"
                  >
                    {FONT_STYLES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Size Slider */}
                <div className="space-y-3 bg-[#0e1508]/40 p-4 rounded-xl border border-[#233113]/60">
                  <div className="flex justify-between items-center">
                    <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold">
                      Single Letter Height (Max 200x)
                    </label>
                    <span className="text-lg font-mono font-bold text-[#bef264] glow-pistachio-text">
                      {textSize}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="200"
                    value={textSize}
                    onChange={(e) => setTextSize(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-[#1b250f] rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-[#8ca36d]">
                    Height of a single letter in blocks. Multi-line heights adjust automatically.
                  </p>
                </div>

                {/* Color Mode */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold block">
                    Color Shading Scheme
                  </label>
                  <select
                    value={colorMode}
                    onChange={(e) =>
                      setColorMode(e.target.value as 'default' | 'rainbow' | 'custom')
                    }
                    className="w-full bg-[#0e1508] border border-[#233113] focus:border-[#bef264] rounded-xl px-4 py-3 text-sm text-white outline-none cursor-pointer"
                  >
                    <option value="default">Default Concrete (concrete:concrete)</option>
                    <option value="rainbow">Rainbow Shading (Spectacular Concrete Spectrum)</option>
                    <option value="custom">Per-Character Custom Colors</option>
                  </select>
                </div>

                {/* Custom Color Swatches if enabled */}
                {colorMode === 'custom' && (
                  <div className="p-3 bg-[#0e1508] border border-[#233113] rounded-xl space-y-2">
                    <p className="text-xs text-[#8ca36d] font-semibold">
                      Assign custom HEX color per character:
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                      {Array.from(textInput)
                        .filter((ch) => ch.trim() !== '')
                        .map((ch, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col items-center bg-[#151e0e] border border-[#233113] p-1.5 rounded-lg text-xs"
                          >
                            <span className="font-mono text-white mb-1 font-bold">{ch}</span>
                            <input
                              type="color"
                              value={customColors[idx] || '#3ecf6b'}
                              onChange={(e) =>
                                setCustomColors((prev) => ({
                                  ...prev,
                                  [idx]: e.target.value,
                                }))
                              }
                              className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Command Parts */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold block">
                    Divide Commands Into Equal Parts (Max 4 for Text)
                  </label>
                  <select
                    value={textParts}
                    onChange={(e) => setTextParts(parseInt(e.target.value, 10))}
                    className="w-full bg-[#0e1508] border border-[#233113] focus:border-[#bef264] rounded-xl px-4 py-3 text-sm text-white outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? '1 Part (Single chunk)' : `Divide into ${n} Parts`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live Preview canvas under 40x */}
                {textSize < 40 ? (
                  <div className="border border-[#233113] rounded-xl p-3 bg-[#050802] flex flex-col items-center justify-center overflow-auto">
                    <p className="text-xs text-[#8ca36d] mb-2 font-mono">Live Interactive Preview</p>
                    <canvas ref={textLiveCanvasRef} className="max-w-full rounded shadow" />
                  </div>
                ) : (
                  <div className="p-3 bg-[#171304] border border-[#75550a] text-[#ffdf6d] rounded-xl text-xs text-center">
                    Note: Resolution is set to {textSize}x. Click &quot;Show Result&quot; below to generate and view full preview.
                  </div>
                )}

                {/* Continue button */}
                <button
                  type="button"
                  onClick={handleTextContinue}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#bef264] to-[#a3df42] text-black font-bold text-base hover:brightness-110 active:scale-[0.99] transition shadow-lg shadow-[#bef264]/20 flex items-center justify-center gap-2"
                >
                  <EyeIcon size={18} color="#000" />
                  <span>Show Result &rarr; Live Preview</span>
                </button>
              </div>
            )}

            {/* 3. MANUAL DRAW MODE */}
            {mode === 'manual' && (
              <div className="bg-[#090d05]/90 border border-[#233113] rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex items-center gap-2 border-b border-[#233113] pb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#bef264] shadow-[0_0_8px_#bef264]" />
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Manual Pixel Drawing Canvas
                  </h2>
                </div>

                {/* Canvas Size */}
                <div className="space-y-3 bg-[#0e1508]/40 p-4 rounded-xl border border-[#233113]/60">
                  <div className="flex justify-between items-center">
                    <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold">
                      Square Canvas Dimension (Max 200x)
                    </label>
                    <span className="text-lg font-mono font-bold text-[#bef264] glow-pistachio-text">
                      {manualSize}x{manualSize}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="200"
                    value={manualSize}
                    onChange={(e) => setManualSize(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-[#1b250f] rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-2">
                    {[16, 20, 24, 32, 48, 64, 100].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setManualSize(sz)}
                        className={`text-xs px-2.5 py-1 rounded-md border font-mono transition ${
                          manualSize === sz
                            ? 'bg-[#bef264] text-black font-bold border-[#bef264]'
                            : 'bg-[#12180c] text-[#8ca36d] border-[#233113]'
                        }`}
                      >
                        {sz}x{sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Block / Color Button */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setManualColorStep(true);
                      setManualSelectedHue(null);
                    }}
                    className="w-full py-2.5 rounded-xl border border-[#bef264]/40 hover:border-[#bef264] text-[#bef264] font-semibold text-sm bg-[#0e1608] hover:bg-[#15200c] transition flex items-center justify-center gap-2"
                  >
                    <PlusIcon size={16} />
                    <span>Add Block / Color to Brush Palette</span>
                  </button>
                </div>

                {/* Step 1: Hue Selection */}
                {manualColorStep && !manualSelectedHue && (
                  <div className="p-4 bg-[#0e1508] border border-[#233113] rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs uppercase tracking-wider font-bold text-[#bef264]">
                        Step 1 &mdash; Select Color Hue
                      </h4>
                      <button
                        type="button"
                        onClick={() => setManualColorStep(false)}
                        className="text-xs text-[#8ca36d] hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {HUE_KEYS_SORTED.map((h) => {
                        const rgb = WOOL_HUE[h];
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setManualSelectedHue(h)}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-[#141d0c] border border-[#233113] hover:border-[#bef264] transition"
                          >
                            <span
                              className="w-7 h-7 rounded border border-white/20"
                              style={{ backgroundColor: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }}
                            />
                            <span className="text-[11px] text-[#f3fbe4] truncate w-full text-center">
                              {HUE_LABELS[h] || h}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 2: Block Selection for selected Hue */}
                {manualColorStep && manualSelectedHue && (
                  <div className="p-4 bg-[#0e1508] border border-[#233113] rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs uppercase tracking-wider font-bold text-[#bef264]">
                        Step 2 &mdash; Choose Block ({HUE_LABELS[manualSelectedHue] || manualSelectedHue})
                      </h4>
                      <button
                        type="button"
                        onClick={() => setManualSelectedHue(null)}
                        className="text-xs text-[#bef264] flex items-center gap-1 hover:underline"
                      >
                        <BackArrowIcon size={12} /> Back to Hues
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                      {(BLOCKS_BY_HUE[manualSelectedHue] || []).map(([id, rgb]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => addBlockToPalette(id, rgb)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg bg-[#141d0c] border border-[#233113] hover:border-[#bef264] text-left transition"
                        >
                          <span
                            className="w-6 h-6 rounded border border-white/20 shrink-0"
                            style={{ backgroundColor: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }}
                          />
                          <span className="text-xs font-mono text-[#f3fbe4]">{id}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Selection Palette */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold block">
                    Active Brush &amp; Palette (Click to Paint)
                  </label>
                  <div className="flex flex-wrap gap-2 p-2 bg-[#0e1508] border border-[#233113] rounded-xl min-h-[50px] items-center">
                    {/* Eraser */}
                    <button
                      type="button"
                      onClick={() => setActiveBrushId(null)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                        activeBrushId === null
                          ? 'bg-[#bef264] text-black border-[#bef264] font-bold'
                          : 'bg-[#141d0c] text-[#8ca36d] border-[#233113] hover:text-white'
                      }`}
                    >
                      <TrashIcon size={14} />
                      <span>Eraser (Blank)</span>
                    </button>

                    {/* Added Palette items */}
                    {manualPalette.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveBrushId(item.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition ${
                          activeBrushId === item.id
                            ? 'bg-[#1b2c0b] text-[#bef264] border-[#bef264] font-bold glow-pistachio-sm'
                            : 'bg-[#141d0c] text-white border-[#233113] hover:border-[#bef264]/60'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded"
                          style={{
                            backgroundColor: `rgb(${item.rgb[0]},${item.rgb[1]},${item.rgb[2]})`,
                          }}
                        />
                        <span className="font-mono text-[11px] truncate max-w-[130px]">
                          {item.id.split(':')[1] || item.id}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset button */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#8ca36d] font-mono">
                    Hold &amp; Drag to Paint
                  </span>
                  <button
                    type="button"
                    onClick={() => initManualCanvas(manualSize)}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <TrashIcon size={13} />
                    <span>Clear Canvas</span>
                  </button>
                </div>

                {/* Drawing Canvas */}
                <div className="border border-[#233113] rounded-xl p-3 bg-[#050802] flex justify-center overflow-auto">
                  <canvas
                    ref={manualCanvasRef}
                    onPointerDown={handleManualPointerDown}
                    onPointerMove={handleManualPointerMove}
                    onPointerUp={handleManualPointerUp}
                    className="cursor-crosshair border border-[#1b250f] rounded shadow max-w-full touch-none"
                  />
                </div>

                {/* Meta stats */}
                <div className="flex justify-between text-xs text-[#8ca36d] font-mono border-t border-[#233113] pt-3">
                  <span>Width: {gridW}</span>
                  <span>Height: {gridH}</span>
                  <span>Filled: {countFilledBlocks()} blocks</span>
                </div>

                {/* Continue button */}
                <button
                  type="button"
                  onClick={handleManualContinue}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#bef264] to-[#a3df42] text-black font-bold text-base hover:brightness-110 active:scale-[0.99] transition shadow-lg shadow-[#bef264]/20 flex items-center justify-center gap-2"
                >
                  <EyeIcon size={18} color="#000" />
                  <span>Continue &rarr; Live Preview</span>
                </button>
              </div>
            )}

            {/* 4. /IE HELP MODE */}
            {mode === 'ie' && (
              <div className="bg-[#090d05]/90 border border-[#233113] rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex items-center gap-2 border-b border-[#233113] pb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#bef264] shadow-[0_0_8px_#bef264]" />
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    /ie Help &mdash; 16x16 Canvas &amp; Instant HEX Reader
                  </h2>
                </div>

                <p className="text-sm text-[#8ca36d] leading-relaxed">
                  Upload an item texture or photo to view the 16x16 raw grid. Click any pixel
                  to instantly copy its exact HEX code for in-game item entity (/ie) commands.
                </p>

                {/* Upload Image */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-[#8ca36d] font-bold block">
                    Upload Texture for /ie
                  </label>
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-[#233113] hover:border-[#bef264] rounded-xl cursor-pointer bg-[#0e1508]/60 transition">
                    <div className="flex flex-col items-center justify-center text-center px-4">
                      <PipetteIcon size={24} className="text-[#bef264] mb-1.5" />
                      <p className="text-sm font-medium text-white">
                        {ieImage ? 'Click to replace texture' : 'Select or drop 16x16 or icon image'}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleIeImageChange}
                    />
                  </label>
                </div>

                {/* Output Canvas Section */}
                {iePixelColors.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="border border-[#233113] rounded-xl p-4 bg-[#050802] flex flex-col items-center justify-center overflow-auto">
                      <canvas
                        ref={ieCanvasRef}
                        onClick={handleIeCanvasClick}
                        className="cursor-pointer border border-[#1b250f] rounded shadow"
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs font-mono p-3 bg-[#0e1508] border border-[#233113] rounded-xl">
                      <span className="text-[#8ca36d]">Status: Ready</span>
                      <span className="text-[#bef264] font-bold">{ieSelectedHex}</span>
                    </div>

                    <button
                      type="button"
                      onClick={copyAllIeHex}
                      className="w-full py-3 rounded-xl border border-[#bef264]/40 hover:border-[#bef264] text-[#bef264] font-semibold text-sm bg-[#0e1608] hover:bg-[#15200c] transition flex items-center justify-center gap-2"
                    >
                      <CopyIcon size={16} />
                      <span>Copy All 16x16 HEX Codes List</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: LIVE PREVIEW & EXPORT */}
        {/* ============================================================== */}
        {activeTab === 'tab2' && (
          <div className="bg-[#090d05]/90 border border-[#233113] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#233113] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#bef264] shadow-[0_0_8px_#bef264]" />
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Live Pixel Art Preview
                </h2>
              </div>
              <span className="text-xs text-[#8ca36d] font-mono">
                {gridW} &times; {gridH} Blocks
              </span>
            </div>

            {/* Main Preview Canvas */}
            <div className="border border-[#233113] rounded-xl p-4 bg-[#050802] flex justify-center items-center overflow-auto min-h-[300px]">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full rounded border border-[#1b250f] shadow"
              />
            </div>

            {/* Metadata Stats */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-[#0e1508] border border-[#233113] rounded-xl text-center font-mono text-xs">
              <div>
                <p className="text-[#8ca36d]">Width</p>
                <p className="text-sm font-bold text-white">{gridW}</p>
              </div>
              <div>
                <p className="text-[#8ca36d]">Height</p>
                <p className="text-sm font-bold text-white">{gridH}</p>
              </div>
              <div>
                <p className="text-[#8ca36d]">Filled Blocks</p>
                <p className="text-sm font-bold text-[#bef264]">{countFilledBlocks()}</p>
              </div>
            </div>

            {/* Export & Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={downloadPixelArtPng}
                className="py-3.5 px-4 rounded-xl border border-[#bef264]/40 hover:border-[#bef264] text-[#bef264] font-semibold text-sm bg-[#0e1608] hover:bg-[#15200c] transition flex items-center justify-center gap-2"
              >
                <DownloadIcon size={18} />
                <span>Download Pixel Art PNG</span>
              </button>

              <button
                type="button"
                onClick={generateCommands}
                className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#bef264] to-[#a3df42] text-black font-bold text-sm hover:brightness-110 active:scale-[0.99] transition shadow-lg shadow-[#bef264]/20 flex items-center justify-center gap-2"
              >
                <TerminalIcon size={18} color="#000" />
                <span>Generate WorldEdit Commands</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: WORLDEDIT COMMAND CENTER */}
        {/* ============================================================== */}
        {activeTab === 'tab3' && (
          <div className="bg-[#090d05]/90 border border-[#233113] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#233113] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#bef264] shadow-[0_0_8px_#bef264]" />
                <h2 className="text-lg font-bold text-white tracking-wide">
                  WorldEdit Command Center ({generatedParts.length} Parts)
                </h2>
              </div>
              <span className="text-xs text-[#bef264] font-mono">180° Inverted Code</span>
            </div>

            {/* Copy All Button */}
            {generatedParts.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    generatedParts.map((p) => p.join('\n')).join('\n'),
                    'All command parts copied to clipboard!'
                  )
                }
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#bef264] to-[#a3df42] text-black font-bold text-sm hover:brightness-110 active:scale-[0.99] transition shadow-lg shadow-[#bef264]/20 flex items-center justify-center gap-2"
              >
                <CopyIcon size={18} color="#000" />
                <span>Copy All Parts With One Click</span>
              </button>
            )}

            {/* Parts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {generatedParts.map((part, idx) => (
                <div
                  key={idx}
                  className="bg-[#0e1608] border border-[#233113] hover:border-[#bef264]/60 rounded-xl p-4 transition space-y-3 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <LayersIcon size={14} color="#bef264" />
                      Part {idx + 1}
                    </span>
                    <span className="text-xs font-mono text-[#8ca36d]">
                      {part.length} Command Lines
                    </span>
                  </div>

                  <div className="bg-[#050802] border border-[#1b250f] rounded-lg p-2 font-mono text-[11px] text-[#8ca36d] overflow-x-auto max-h-20 whitespace-pre">
                    {part.slice(0, 3).join('\n')}
                    {part.length > 3 ? '\n...' : ''}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(part.join('\n'), `Part ${idx + 1} copied to clipboard!`)
                    }
                    className="w-full py-2.5 rounded-lg bg-[#bef264] text-black font-bold text-xs hover:bg-[#a6e246] transition flex items-center justify-center gap-1.5"
                  >
                    <CopyIcon size={14} color="#000" />
                    <span>Copy Part {idx + 1}</span>
                  </button>
                </div>
              ))}
            </div>

            {generatedParts.length === 0 && (
              <div className="text-center py-12 text-[#8ca36d]">
                <p>No commands generated yet. Generate your pixel art from Tab 1 or Tab 2.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-xs text-[#8ca36d] border-t border-[#233113] bg-[#000000]/80 backdrop-blur-md">
        <p>
          Built by <span className="text-white font-semibold">Kyranzo</span> &bull;{' '}
          <a
            href="https://github.com/kyranzo/pixelart-generator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#bef264] hover:underline font-mono"
          >
            mydomain/pixelart-generator
          </a>
        </p>
      </footer>
    </div>
  );
}
