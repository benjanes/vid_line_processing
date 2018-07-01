module.exports = (number, length) => {
  let n = number.toString();
  while (n.length < length) {
    n = `0${n}`;
  }
  return n;
};
