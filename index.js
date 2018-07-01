const processSound = require('./utils/processSound');
const processImgWithColor = require('./utils/color');
const padNumber = require('./utils/padNumber');

const fps = 30;

// for (let i = 1; i < 2; i++) {
//   const imgNumber = padNumber(i, 3);
//   processImgWithColor(`${__dirname}/in_img/out${imgNumber}.png`, `${__dirname}/out_img/${imgNumber}.png`);
// }

processSound(`${__dirname}/src/song1.mp3`, fps);
