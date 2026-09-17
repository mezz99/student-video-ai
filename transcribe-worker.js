import {pipeline} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';

self.onmessage = async event => {
  try {
    const transcriber = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
      device:'wasm', dtype:'fp32',
      progress_callback: data => {
        if (data.status === 'progress' && typeof data.progress === 'number') self.postMessage({type:'status', message:`Downloading speech model: ${Math.round(data.progress)}% of current file. First run only on this browser.`});
      }
    });
    self.postMessage({type:'status', message:'Transcribing on your device… Keep this tab open. You can cancel at any time.'});
    const result = await transcriber(event.data.audio, {chunk_length_s:30, stride_length_s:5, return_timestamps:true});
    self.postMessage({type:'result', result:{text:result.text, chunks:result.chunks}});
    await transcriber.dispose();
  } catch (error) {
    console.error('Speech worker failed:', error.message);
    self.postMessage({type:'error', details:error.message, message:/memory|allocation/i.test(error.message) ? 'This device ran out of memory. Try a shorter audio clip.' : 'The speech model could not load or transcribe. Check your connection and try a short MP3 or WAV file. You can also paste a transcript.'});
  }
};
