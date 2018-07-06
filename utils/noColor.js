// ffmpeg -r 5 -i img/%03d.png -vcodec h264 -pix_fmt yuv420p -crf 22 -s 1480x1640 color.mp4
// ffmpeg -r 25 -i out_img/%03d.png -vcodec h264 -pix_fmt yuv420p -crf 22 -s 2880x1620 title11.mp4
const Canvas = require('canvas');
const Image = Canvas.Image;
const fs = require('fs');

// const amplitude = 10; // how far should lines deviate from center for a given level of darkness
const rowAmplitude = 2;
const colAmplitude = 2;

// what is the spacing between cols or rows (make a line out of every nth col or row of pixels)
const rowLineFreq = 8;
const colLineFreq = 8;
// how often should we sample a pixel to build our path?
const rowSamplingFreq = 8;
const colSamplingFreq = 20;

const rowBaseRGB = '255,255,255';
const colBaseRGB = '255,255,255';
// const colBaseRGB = '0,0,255';

const glowSize = 5;
// red from 100 to 240

const scale = 1.5;

module.exports = (pathIn, pathOut, channel1Peak, channel2Peak) => {
  fs.readFile(pathIn, (err, image) => {
    if (err) console.log(err);

    const bgColor = `rgba(0,0,0,1)`;
    // const bgColor = `rgba(${Math.round((channel2Peak * 100) + 100)},90,60,1)`;
    const rowAmplitude = 4;
    // const rowAmplitude = 10 * channel1Peak;

    const img = new Image();
    img.src = image;
    const canvas = new Canvas(img.width * scale, img.height * scale);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pxData = transformData(canvas, ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    makeImage(pxData, canvas.width, canvas.height, pathOut, bgColor, rowAmplitude);
  });
};

function makeImage(pxData, width, height, path, bgColor, rowAmplitude) {
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  drawLines(ctx, pxData, rowAmplitude);
  // path to output images to
  const out = fs.createWriteStream(path);
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

function drawLines(ctx, { rows, cols }, rowAmplitude) {
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
  let isBuildingCmd = false;

  const paths = points.reduce((paths, pt, movingCoord, pts) => {
      if (pts.length - 1 === movingCoord) return paths;
      const samplingFreq = isRow ? rowSamplingFreq : colSamplingFreq;

      if (!movingCoord || !(movingCoord % samplingFreq)) {
        // if the value doesn't pass our threshold, return
        // if (isRow && pt > 0.2 || !isRow && pt < 0.2) {
        //   isBuildingCmd = false;
        //   return paths;
        // }

        if (!isBuildingCmd) {
          paths.push({ startVal: movingCoord, cmds: [] });
          isBuildingCmd = true;
        }

        dir *= -1;
        const adjustedCoord = fixedCoord + (dir * pt * amplitude);
        let nextMoving = movingCoord + samplingFreq;
        if (nextMoving > pts.length - 1) nextMoving = pts.length - 1;
        const nextAdjusted = fixedCoord + (dir * pts[nextMoving] * amplitude * -1);
        const movingMid = movingCoord + (samplingFreq / 2);

        if (isRow) {
          paths[paths.length - 1].cmds.push([movingMid, adjustedCoord, movingMid, nextAdjusted, nextMoving, nextAdjusted]);
        } else {
          paths[paths.length - 1].cmds.push([adjustedCoord, movingMid, nextAdjusted, movingMid, nextAdjusted, nextMoving]);
        }
      }

      return paths;
  }, []);

  paths.forEach(path => renderLine(ctx, path, fixedCoord, isRow, baseColor, 1, 0));

  // this is the GLOW
  if (!isRow) {
    for (let i = -glowSize; i <= glowSize; i++) {
      // const opacity = 0.5 - (( 0.5 - ((glowSize - (Math.abs(i))) / glowSize)) * 0.5);
      paths.forEach(path => renderLine(ctx, path, fixedCoord, isRow, baseColor, 1, i));
    }
  }
}

function renderLine(ctx, path, fixedCoord, isRow, baseColor, opacity, translation) {
  ctx.strokeStyle = `rgba(${baseColor},${opacity})`;
  ctx.beginPath();

  if (isRow) {
    ctx.translate(0, translation);
    ctx.moveTo(path.startVal, fixedCoord);
    path.cmds.forEach(cmd => ctx.bezierCurveTo.apply(ctx, cmd));
    ctx.translate(0, -translation);
  } else {
    ctx.translate(translation, 0);
    ctx.moveTo(fixedCoord, path.startVal);
    path.cmds.forEach(cmd => ctx.bezierCurveTo.apply(ctx, cmd));
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
