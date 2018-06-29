// ffmpeg -r 5 -i img/%03d.png -vcodec h264 -pix_fmt yuv420p -crf 22 -s 1480x1640 color.mp4
// ffmpeg -r 25 -i img/%03d.png -vcodec h264 -pix_fmt yuv420p -crf 22 -s 2880x1620 title11.mp4
const Canvas = require('canvas');
const Image = Canvas.Image;
const fs = require('fs');

// const amplitude = 10; // how far should lines deviate from center for a given level of darkness
const rowAmplitude = 8;
const colAmplitude = 8;
// what is the spacing between cols or rows (make a line out of every nth col or row of pixels)
const rowLineFreq = 16;
const colLineFreq = 16;
// how often should we sample a pixel to build our path?
const rowSamplingFreq = 16;
const colSamplingFreq = 16;

const rowBaseRGB = '255,255,255';
const colBaseRGB = '255,255,255';
// const colBaseRGB = '0,0,255';

const glowSize = 4;
const bgColor = 'rgba(0,0,0,1)';
// const bgColor = 'rgba(255,255,255,1)';
const scale = 1.5;

for (let i = 1; i < 126; i++) {
  // path to the source images
  fs.readFile(`${__dirname}/srcImg/out${padNumber(i)}.png`, (err, image) => {
    if (err) console.log(err);

    const img = new Image();
    img.src = image;
    const canvas = new Canvas(img.width * scale, img.height * scale);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pxData = transformData(canvas, ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    makeImage(i, pxData, canvas.width, canvas.height);
  });
}

function makeImage(i, pxData, width, height) {
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  drawLines(ctx, pxData, i);
  // path to output images to
  const out = fs.createWriteStream(`img/${padNumber(i)}.png`);
  const stream = canvas.pngStream();
  stream.on('data', chunk => { out.write(chunk) });
}

function transformData(canvas, data) {
  const width = canvas.width;
  const rows = (new Array(canvas.height)).fill(0).map(x => []);
  const cols = (new Array(width)).fill(0).map(x => []);

  let currRowIdx = 0;
  let currColIdx = 0;

  // iterate through data and use every 4th item, starting with index 0.
  // this means that for the repeating pattern [r, g, b, a] we are using r (r == g == b)
  data.forEach((val, idx) => {
    if (!idx || !((idx) % 4)) {
      const r = val;
      const g = data[idx + 1];
      const b = data[idx + 2];
      // const cellValue = (255 - ((0.21 * r) + (0.72 * g) + (0.07 * b))) / 255; // dark gets highlighted
      const cellValue = ((0.21 * r) + (0.72 * g) + (0.07 * b)) / 255; // light gets highlighted

      rows[currRowIdx].push({ cellValue, r, g, b });
      cols[currColIdx].push({ cellValue, r, g, b });

      currColIdx++;
      if (rows[currRowIdx].length === width) currRowIdx++;
      if (currColIdx === width) currColIdx = 0;
    }
  });

  return { rows, cols };
}

function drawLines(ctx, { rows, cols }, i) {
  rows.forEach((row, y) => {
    if (!y || !((y) % rowLineFreq)) drawPathFromPoints(ctx, row, y, true, rowAmplitude);
  });
  cols.forEach((col, x) => {
    if (!x || !((x) % colLineFreq)) drawPathFromPoints(ctx, col, x, false, colAmplitude);
  });
}

function drawPathFromPoints(ctx, points, fixedCoord, isRow, amplitude) {
  let dir = -1;
  const baseColor = isRow ? rowBaseRGB : colBaseRGB;

  // flag for whether (if false) next passing command should get added to new obj with fresh array, tracking movingCoord as start val (in moveTo command)
  // (if true) next passing command gets tacked onto array of last obj in array
  // let isBuildingCmd = false;

  const paths = points.reduce((paths, pt, movingCoord, pts) => {
      if (pts.length - 1 === movingCoord) return paths;
      const samplingFreq = isRow ? rowSamplingFreq : colSamplingFreq;

      if (!movingCoord || !(movingCoord % samplingFreq)) {
        // if the value doesn't pass our threshold, return
        // if (/*isRow && pt < 0.2 || */!isRow && pt.cellValue < 0.2) {
        //   // isBuildingCmd = false;
        //   return paths;
        // }

        dir *= -1;
        const adjustedCoord = fixedCoord + (dir * pt.cellValue * amplitude);
        let nextMoving = movingCoord + samplingFreq;
        if (nextMoving > pts.length - 1) nextMoving = pts.length - 1;
        const nextAdjusted = fixedCoord + (dir * pts[nextMoving].cellValue * amplitude * -1);
        const movingMid = movingCoord + (samplingFreq / 2);

        if (isRow) {
          paths.push({ startCoords: [movingCoord, adjustedCoord], cmd: [movingMid, adjustedCoord, movingMid, nextAdjusted, nextMoving, nextAdjusted], rgb: pt });
        } else {
          paths.push({ startCoords: [adjustedCoord, movingCoord], cmd: [adjustedCoord, movingMid, nextAdjusted, movingMid, nextAdjusted, nextMoving], rgb: pt });
        }
      }

      return paths;
  }, []);

  paths.forEach(path => renderLine(ctx, path, fixedCoord, isRow, baseColor, 1, 0));

  // this is the GLOW
  if (!isRow) {
    for (let i = -glowSize; i <= glowSize; i++) {
      const opacity = 0.5 - (( 0.5 - ((glowSize - (Math.abs(i))) / glowSize)) * 0.5);
      paths.forEach(path => renderLine(ctx, path, fixedCoord, isRow, baseColor, opacity, i));
    }
  }
}

function renderLine(ctx, path, fixedCoord, isRow, baseColor, opacity, translation) {
  const { r, g, b } = path.rgb;
  ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
  // ctx.strokeStyle = `rgba(${baseColor},${opacity})`;
  ctx.beginPath();

  if (isRow) {
    ctx.translate(0, translation);
    ctx.moveTo(path.startCoords[0], path.startCoords[1]);
    ctx.bezierCurveTo.apply(ctx, path.cmd);
    ctx.translate(0, -translation);
  } else {
    ctx.translate(translation, 0);
    ctx.moveTo(path.startCoords[0], path.startCoords[1]);
    ctx.bezierCurveTo.apply(ctx, path.cmd);
    ctx.translate(-translation, 0);
  }

  ctx.stroke();
  ctx.closePath();
}

function padNumber(number) {
  let n = number.toString();
  while (n.length < 3) {
    n = `0${n}`;
  }
  return n;
}
