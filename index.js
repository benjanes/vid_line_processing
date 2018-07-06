// ffmpeg -i title31.mp4 -i song2.mp3 -shortest -c:v copy -c:a aac -b:a 44.1k newvid.mp4

const processSound = require('./utils/processSound');
const processImgWithColor = require('./utils/color');
const processImgNoColor = require('./utils/noColor');
const padNumber = require('./utils/padNumber');

const fps = 25;
const startTime = 0;
const endTime = 8;

processSound(`${__dirname}/src/song2.mp3`, fps, startTime, endTime, (channel1Data, channel2Data) => {
  console.log('Done processing audio');

  // for (let i = 1; i <= fps * (endTime - startTime); i++) {
  for (let i = 1; i < 2; i++) {
    const imgNumber = padNumber(i, 3);
    processImgWithColor(`${__dirname}/in_img/out${imgNumber}.png`, `${__dirname}/out_img/${imgNumber}.png`, channel1Data[i], channel2Data[i]);
  }
});
