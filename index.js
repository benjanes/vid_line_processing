// ffmpeg -r 5 -i img/%03d.png -vcodec h264 -pix_fmt yuv420p -crf 22 -s 1480x1640 color.mp4
// ffmpeg -r 25 -i img/%03d.png -vcodec h264 -pix_fmt yuv420p -crf 22 -s 2880x1620 title11.mp4
const Canvas = require('canvas');
const Image = Canvas.Image;
const fs = require('fs');

// const magnitude = 10; // how far should lines deviate from center for a given level of darkness
const rowMagnitude = 16;
const colMagnitude = 1;

// what is the spacing between cols or rows (make a line out of every nth col or row of pixels)
const rowLineFreq = 16;
const colLineFreq = 64;

// how often should we sample a pixel to build our path?
const rowSamplingFreq = 4;
const colSamplingFreq = 6;

const scale = 1.5;

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

  drawLines(ctx, pxData, i);
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

      rows[currRowIdx].push(cellValue);
      cols[currColIdx].push(cellValue);

      currColIdx++;
      if (rows[currRowIdx].length === width) currRowIdx++;
      if (currColIdx === width) currColIdx = 0;
    }
  });

  return { rows, cols };
}

function drawLines(ctx, { rows, cols }, i) {
  rows.forEach((row, y) => {
    if (!y || !((y) % rowLineFreq)) drawPathFromPoints(ctx, row, y, true, rowMagnitude);
  });
  cols.forEach((col, x) => {
    if (!x || !((x) % colLineFreq)) drawPathFromPoints(ctx, col, x, false, colMagnitude);
  });
}

function drawPathFromPoints(ctx, points, fixedCoord, isRow, magnitude) {
  let dir = -1;
  // const baseColor = '255,255,255';
  const baseColor = isRow ? '255,255,255' : '0,0,255';

  // flag for whether (if false) next passing command should get added to new obj with fresh array, tracking movingCoord as start val (in moveTo command)
  // (if true) next passing command gets tacked onto array of last obj in array
  let isBuildingCmd = false;

  const paths = points.reduce((paths, pt, movingCoord, pts) => {
      if (pts.length - 1 === movingCoord) return paths;
      const samplingFreq = isRow ? rowSamplingFreq : colSamplingFreq;

      if (!movingCoord || !(movingCoord % samplingFreq)) {
        // if the value doesn't pass our threshold, return
        if (/*isRow && pt < 0.2 || */!isRow && pt > 0.2) {
          isBuildingCmd = false;
          return paths;
        }

        if (!isBuildingCmd) {
          paths.push({ startVal: movingCoord, cmds: [] });
          isBuildingCmd = true;
        }

        dir *= -1;
        const adjustedCoord = fixedCoord + (dir * pt * magnitude);
        let nextMoving = movingCoord + samplingFreq;
        if (nextMoving > pts.length - 1) nextMoving = pts.length - 1;
        const nextAdjusted = fixedCoord + (dir * pts[nextMoving] * magnitude * -1);
        const movingMid = movingCoord + (samplingFreq / 2);
        const adjustedMid = (adjustedCoord + nextAdjusted) / 2;
        const movingCP1= ((movingMid + movingCoord) / 2);
        const adjustedCP1 = ((adjustedMid + adjustedCoord) / 2);
        const movingCP2 = ((movingMid + nextMoving) / 2);
        const adjustedCP2 = ((adjustedMid + nextAdjusted) / 2);

        if (isRow) {
          paths[paths.length - 1].cmds.push([movingCP1, adjustedCP1, movingCP2, adjustedCP2, nextMoving, nextAdjusted]);
        } else {
          paths[paths.length - 1].cmds.push([adjustedCP1, movingCP1, adjustedCP2, movingCP2, nextAdjusted, nextMoving]);
        }
      }

      return paths;
  }, []);

  paths.forEach(path => renderLine(ctx, path, fixedCoord, isRow, baseColor, 1, 0));

  // this provides the glow
  // what i increments to should be variable. starting opacity should be variable. lowest opacity should always be +/- the same
  if (!isRow) {
    for (let i = -15; i <= 15; i++) {
      paths.forEach(path => renderLine(ctx, path, fixedCoord, isRow, baseColor, 0.5 - (( 0.5 - ((15 - (Math.abs(i))) / 15)) * 0.5), i));
    }
  }
}

function renderLine(ctx, path, fixedCoord, isRow, baseColor, opacity, translation) {
  ctx.strokeStyle = `rgba(${baseColor},${opacity})`;
  ctx.beginPath();

  if (isRow) {
    ctx.translate(0, translation);
    ctx.moveTo(path.startVal, fixedCoord);
    path.cmds.forEach(cmd => ctx.quadraticCurveTo.apply(ctx, cmd));
    ctx.translate(0, -translation);
  } else {
    ctx.translate(translation, 0);
    ctx.moveTo(fixedCoord, path.startVal);
    path.cmds.forEach(cmd => ctx.quadraticCurveTo.apply(ctx, cmd));
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
