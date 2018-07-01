const fs = require('fs');
const AudioContext = require('web-audio-api').AudioContext;
const ctx = new AudioContext();

module.exports = (path, fps) => {
  fs.readFile(path, (err, buffer) => {
    if (err) console.log(err);
    ctx.decodeAudioData(buffer, audioBuffer => {
      console.log(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate, audioBuffer.duration)
      const pcm0 = averageDataPerFrame(audioBuffer.getChannelData(0), audioBuffer.sampleRate, fps);
      const pcm1 = averageDataPerFrame(audioBuffer.getChannelData(1), audioBuffer.sampleRate, fps);
    });
  });
}

function averageDataPerFrame(data, sampleRate, fps) {
  const samplesPerFrame = sampleRate / fps;
  return data.reduce((averagedData, datum, idx) => {
    if (!idx) {
      averagedData.push(datum);
    } else if (idx - (averagedData.length * samplesPerFrame) < samplesPerFrame) {
      // add the value
      averagedData[averagedData.length - 1] += datum;
    } else {
      // average the last val in averagedData by dividing by samplesPerFrame, start on next one
      averagedData[averagedData.length - 1] = averagedData[averagedData.length - 1] / samplesPerFrame;
      averagedData.push(0);
    }
    return averagedData;
  }, []);
}
