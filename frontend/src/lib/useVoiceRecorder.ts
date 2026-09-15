import { useRef, useState } from "react";

/** Records a voice note via the browser mic (MediaRecorder → webm/Opus) and hands
 * the finished recording back as a File — the backend remuxes webm into the
 * Ogg/Opus container WhatsApp's Cloud API actually accepts. */
export function useVoiceRecorder(onRecorded: (file: File) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function start() {
    if (recording) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert("Could not access the microphone. Check your browser's mic permission for this site.");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      if (blob.size > 0 && !cancelledRef.current) {
        onRecorded(new File([blob], "voice-note.webm", { type: blob.type }));
      }
    };

    recorderRef.current = recorder;
    cancelledRef.current = false;
    recorder.start();
    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function finish() {
    stopTimer();
    setRecording(false);
    recorderRef.current?.stop();
  }

  function cancel() {
    stopTimer();
    setRecording(false);
    cancelledRef.current = true;
    recorderRef.current?.stop();
  }

  return { recording, seconds, start, finish, cancel };
}
