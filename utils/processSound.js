const fs = require('fs');
const AudioContext = require('web-audio-api').AudioContext;
const ctx = new AudioContext();

module.exports = (path, fps, startTime, endTime, callback) => {
  fs.readFile(path, (err, buffer) => {
    if (err) console.log(err);
    ctx.decodeAudioData(buffer, audioBuffer => {
      const pcm0 = peaksPerFrame(audioBuffer.getChannelData(0), audioBuffer.sampleRate, fps, startTime, endTime);
      const pcm1 = peaksPerFrame(audioBuffer.getChannelData(1), audioBuffer.sampleRate, fps, startTime, endTime);

      // when normalizing, should we use 0 or the minimum from the pcm peaks to transform?
      callback(normalize(pcm0), normalize(pcm1));
    });
  });
}

function normalize({ data, max }) {
  // for now, do a linear transform from min of peaks.data to peaks.max
  const min = Math.min(...data);
  const diff = max - min;
  return data.map(peak => (peak - min) / diff);
}

// startTime and endTime in seconds
function peaksPerFrame(data, sampleRate, fps, startTime, endTime) {
  startTime = startTime || 0;
  endTime = endTime || Math.floor(data.length / sampleRate);
  const samplesPerFrame = sampleRate / fps;
  let min = 0;
  let max = 0;

  return data
    .slice(startTime * sampleRate, endTime * sampleRate)
    .reduce((peaks, datum, idx) => {
      if (idx && idx - (peaks.data.length * samplesPerFrame) < samplesPerFrame) {
        peaks.data[peaks.data.length - 1] = Math.max(peaks.data[peaks.data.length - 1], Math.abs(datum));
      } else {
        peaks.data.push(Math.abs(datum));
      }

      return { ...peaks, min: Math.min(peaks.min, Math.abs(datum)), max: Math.max(peaks.max, Math.abs(datum)) };
    }, { data: [], max: 0 });
  }
