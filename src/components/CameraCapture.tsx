'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, RotateCcw, Check, Loader2, AlertCircle } from 'lucide-react';

/**
 * Takes a product photograph with a camera attached to this computer.
 *
 * Shop staff photograph a safa on the counter and want it on the product
 * there and then; saving to Pictures and hunting for the file is the step
 * that stops them bothering. This hands back an ordinary image file, so it
 * goes through exactly the same compression as a photo chosen from disk —
 * nothing downstream knows the difference.
 *
 * The camera is released the moment this closes. A shop counter often has
 * more than one camera (a laptop's own, and a USB one pointed at the
 * counter), so the list is offered whenever there is a choice.
 */

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
  title?: string;
}

export function CameraCapture({ onCapture, onClose, title = 'Take a product photo' }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const blobRef = useRef<Blob | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (wanted?: string) => {
    stop();
    setStarting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: wanted
          ? { deviceId: { exact: wanted } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      // Camera names are only readable once permission has been given.
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter(d => d.kind === 'videoinput'));
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'The camera was blocked. Allow camera access for this app and try again.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'No camera was found on this computer. Plug one in, or import the photo from a file instead.'
          : name === 'NotReadableError'
          ? 'The camera is being used by another program. Close that and try again.'
          : 'The camera could not be opened. Import the photo from a file instead.'
      );
    } finally {
      setStarting(false);
    }
  }, [stop]);

  useEffect(() => {
    void start();
    return stop;
    // Started once; switching camera calls start() again by hand.
  }, [start, stop]);

  const take = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setShot(canvas.toDataURL('image/jpeg', 0.92));
    canvas.toBlob(blob => { blobRef.current = blob; }, 'image/jpeg', 0.92);
  };

  const use = () => {
    const blob = blobRef.current;
    if (!blob) return;
    onCapture(new File([blob], `product-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    stop();
    onClose();
  };

  const close = () => {
    stop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-black text-slate-800">
            <Camera size={16} className="text-indigo-600" /> {title}
          </p>
          <button type="button" onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-slate-900">
          {/* The preview and the photograph share the frame, so nothing jumps. */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-contain ${shot ? 'invisible' : ''}`}
          />
          {shot && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="The photo just taken" className="absolute inset-0 h-full w-full object-contain" />
          )}

          {starting && !error && (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-bold text-white/80">
              <Loader2 size={16} className="animate-spin" /> Opening the camera…
            </p>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="flex max-w-sm items-start gap-2 rounded-xl bg-white/95 p-4 text-xs font-semibold leading-relaxed text-slate-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                {error}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3 px-5 py-4">
          {cameras.length > 1 && !shot && (
            <select
              value={deviceId ?? ''}
              onChange={e => {
                const next = e.target.value || undefined;
                setDeviceId(next);
                void start(next);
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="">Default camera</option>
              {cameras.map((camera, index) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-2">
            {shot ? (
              <>
                <button
                  type="button"
                  onClick={() => { setShot(null); blobRef.current = null; }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  <RotateCcw size={14} /> Take it again
                </button>
                <button
                  type="button"
                  onClick={use}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <Check size={14} /> Use this photo
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={take}
                disabled={starting || Boolean(error)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                <Camera size={15} /> Take the photo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
