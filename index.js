const processImgWithColor = require('./utils/color');
const padNumber = require('./utils/padNumber');

for (let i = 1; i < 2; i++) {
  const imgNumber = padNumber(i, 3);
  processImgWithColor(`${__dirname}/in_img/out${imgNumber}.png`, `${__dirname}/out_img/${imgNumber}.png`);
}
