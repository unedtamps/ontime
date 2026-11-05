"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, CameraOff } from "lucide-react";

type CameraState = "idle" | "starting" | "live" | "captured" | "unsupported" | "denied";

export interface CameraCaptureProps {
  onCapture: (file: File | null) => void;
  previewUrl: string | null;
}

export function CameraCapture({ onCapture, previewUrl }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setMessage("This browser cannot access a camera. Use a device with a camera to check in.");
      return;
    }
    setState("starting");
    setMessage(null);
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      stopStream();
      setState("unsupported");
      setMessage(
        "The camera did not respond. Check that no other app is using it, then try again.",
      );
    }, 12000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      settled = true;
      clearTimeout(timeout);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("live");
    } catch (err) {
      settled = true;
      clearTimeout(timeout);
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError");
      setState(denied ? "denied" : "unsupported");
      setMessage(
        denied
          ? "Camera access was blocked. Allow the camera in your browser settings, then try again."
          : "No camera could be started on this device.",
      );
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    if (state === "idle") return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
    );
    if (!blob) return;
    const file = new File([blob], `camera-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file);
    stopStream();
    setState("captured");
  }

  async function retake() {
    onCapture(null);
    await startCamera();
  }

  const retrying = state === "denied" || state === "unsupported";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-[4/3] w-full max-w-sm items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Captured photo proof"
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${state === "live" ? "opacity-100" : "opacity-0"}`}
            />
            {state !== "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
                {state === "starting" ? (
                  <>
                    <Camera size={20} strokeWidth={1.5} />
                    <span className="text-caption">Starting camera</span>
                  </>
                ) : retrying ? (
                  <>
                    <CameraOff size={20} strokeWidth={1.5} />
                    <span className="text-caption">{message}</span>
                  </>
                ) : (
                  <>
                    <Camera size={20} strokeWidth={1.5} />
                    <span className="text-caption">
                      The camera opens so you can take your photo on the spot
                    </span>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {previewUrl ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              leadingIcon={RefreshCw}
              onClick={retake}
            >
              Retake
            </Button>
            <span className="text-caption text-muted-foreground">
              Photo taken. Check in to submit it.
            </span>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="primary"
              size="compact"
              leadingIcon={Camera}
              disabled={state !== "live"}
              onClick={takePhoto}
            >
              Take photo
            </Button>
            {retrying && (
              <Button
                type="button"
                variant="ghost"
                size="compact"
                onClick={startCamera}
              >
                Try again
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
