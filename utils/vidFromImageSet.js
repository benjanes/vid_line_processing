// const ffmpeg = require('fluent-ffmpeg');
// const command = ffmpeg();

const Canvas = require('canvas');
const Image = Canvas.Image;
const fs = require('fs');

const magnitude = 10; // how far should lines deviate from center for a given level of darkness
const lineFreq = 6; // what is the spacing between cols or rows (make a line out of every nth col or row of pixels)
const samplingFreq = 6; // how often should we sample a pixel to build our path?
const scale = 2;
const strokeColor = 'rgba(255,255,255,1)';

for (let i = 1; i < 126; i++) {
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
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 0, width, height);

  drawLines(ctx, pxData, 14);
  // drawLines(ctx, pxData, i * 0.25);
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
      const cellValue = (255 - val) / 255;

      rows[currRowIdx].push(cellValue);
      cols[currColIdx].push(cellValue);

      currColIdx++;
      if (rows[currRowIdx].length === width) currRowIdx++;
      if (currColIdx === width) currColIdx = 0;
    }
  });

  return { rows, cols };
}

function drawLines(ctx, { rows, cols }) {
  rows.forEach((row, y) => {
    if (!y || !((y) % lineFreq)) drawPathFromPoints(ctx, row, y, true);
  });

  cols.forEach((col, x) => {
    if (!x || !((x) % lineFreq)) drawPathFromPoints(ctx, col, x, false);
  });
}

function drawPathFromPoints(ctx, points, fixedCoord, isRow) {
  let dir = -1;
  ctx.strokeStyle = strokeColor;
  ctx.beginPath();

  if (isRow) {
    ctx.moveTo(0, fixedCoord);
  } else {
    ctx.moveTo(fixedCoord, 0);
  }

  // switch this to a reduce and add a renderLine function

  points.forEach((pt, movingCoord, pts) => {
    if (pts.length - 1 === movingCoord) return;

    if (!movingCoord || !(movingCoord % samplingFreq)) {
      dir *= -1;
      const adjustedCoord = fixedCoord + (dir * pt * magnitude);
      const nextMoving = movingCoord + samplingFreq;
      // multiply by -1 b/c next point will have opposite direction from this point
      const nextAdjusted = fixedCoord + (dir * pts[nextMoving] * magnitude * -1);
      const movingMid = movingCoord + (samplingFreq / 2);
      const adjustedMid = (adjustedCoord + nextAdjusted) / 2;
      const movingCP1= ((movingMid + movingCoord) / 2);
      const adjustedCP1 = ((adjustedMid + adjustedCoord) / 2);
      const movingCP2 = ((movingMid + nextMoving) / 2);
      const adjustedCP2 = ((adjustedMid + nextAdjusted) / 2);

      if (isRow) {
        ctx.quadraticCurveTo(movingCP1, adjustedCP1, movingCP2, adjustedCP2, nextMoving, nextAdjusted);
      } else {
        ctx.quadraticCurveTo(adjustedCP1, movingCP1, adjustedCP2, movingCP2, nextAdjusted, nextMoving);
      }
    }
  });

  ctx.stroke();
}

function padNumber(number) {
  let n = number.toString();
  while (n.length < 3) {
    n = `0${n}`;
  }
  return n;
}
