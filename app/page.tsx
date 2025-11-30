"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function Dashboard() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    const [violationCount, setViolationCount] = useState(0);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [isMirrored, setIsMirrored] = useState(true);

    // Check backend status on mount
    useEffect(() => {
        const checkBackend = async () => {
            try {
                const res = await fetch("http://localhost:8000/");
                if (res.ok) setBackendStatus("online");
                else setBackendStatus("offline");
            } catch (e) {
                setBackendStatus("offline");
            }
        };
        checkBackend();
    }, []);

    // Get available video devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                // Request permission first to get device labels
                await navigator.mediaDevices.getUserMedia({ video: true });

                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                setDevices(videoDevices);
                if (videoDevices.length > 0) {
                    setSelectedDeviceId(videoDevices[0].deviceId);
                }
            } catch (err) {
                console.error("Error enumerating devices:", err);
            }
        };
        getDevices();
    }, []);

    const startWebcam = async () => {
        try {
            const constraints = {
                video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsMonitoring(true);
                setViolationCount(0); // Reset stats
                addLog("Webcam started - Session initialized");
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
            addLog("Error accessing webcam");
        }
    };

    const stopWebcam = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach((track) => track.stop());
            videoRef.current.srcObject = null;
            setIsMonitoring(false);
            setAlertMessage(null);
            addLog("Webcam stopped - Session ended");

            // Clear canvas
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const addLog = (msg: string) => {
        setLogs((prev) => [new Date().toLocaleTimeString() + ": " + msg, ...prev.slice(0, 9)]);
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isMonitoring) {
            interval = setInterval(async () => {
                if (!videoRef.current || !canvasRef.current) return;

                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext("2d");

                if (!ctx) return;

                // Match canvas size to video size
                if (video.videoWidth && video.videoHeight) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }

                // Draw video frame to a temporary canvas to convert to blob
                const tempCanvas = document.createElement("canvas");
                tempCanvas.width = video.videoWidth;
                tempCanvas.height = video.videoHeight;
                const tempCtx = tempCanvas.getContext("2d");
                if (!tempCtx) return;

                tempCtx.drawImage(video, 0, 0);

                tempCanvas.toBlob(async (blob) => {
                    if (!blob) return;

                    const formData = new FormData();
                    formData.append("file", blob, "frame.jpg");

                    try {
                        const res = await fetch("http://localhost:8000/recognize", {
                            method: "POST",
                            body: formData,
                        });

                        if (res.ok) {
                            const data = await res.json();

                            // Handle Status
                            if (data.status !== "CLEAN") {
                                setAlertMessage(data.message);
                                setViolationCount(prev => prev + 1);
                                // addLog(`Violation: ${data.message}`);
                            } else {
                                setAlertMessage(null);
                            }

                            // Clear previous drawings
                            ctx.clearRect(0, 0, canvas.width, canvas.height);

                            // Draw new boxes
                            data.results.forEach((result: any) => {
                                let [x1, y1, x2, y2] = result.box;

                                // Mirror coordinates if needed
                                if (isMirrored) {
                                    const width = canvas.width;
                                    const newX1 = width - x2;
                                    const newX2 = width - x1;
                                    x1 = newX1;
                                    x2 = newX2;
                                }

                                const color = result.name === "UNKNOWN" ? "#ef4444" : "#22c55e"; // red or green

                                // Draw Box
                                ctx.strokeStyle = color;
                                ctx.lineWidth = 3;
                                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

                                // Draw Label Background
                                ctx.fillStyle = color;
                                const text = `${result.name} (${(result.confidence * 100).toFixed(1)}%)`;
                                const textWidth = ctx.measureText(text).width;
                                ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);

                                // Draw Text
                                ctx.fillStyle = "#ffffff";
                                ctx.font = "16px sans-serif";
                                ctx.fillText(text, x1 + 5, y1 - 7);

                                if (result.name !== "UNKNOWN") {
                                    // addLog(`Detected: ${result.name}`);
                                }
                            });
                        }
                    } catch (err) {
                        console.error("API Error", err);
                    }
                }, "image/jpeg", 0.8);

            }, 500); // Send frame every 500ms
        }

        return () => clearInterval(interval);
    }, [isMonitoring, isMirrored]);

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-8 font-sans text-neutral-900 dark:text-white">
            <header className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-2xl font-bold tracking-tight hover:opacity-80">
                        Exam Detection
                    </Link>
                    <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium dark:bg-neutral-800">
                        Dashboard
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${backendStatus === 'online' ? 'bg-green-500' : backendStatus === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        System Status: {backendStatus.toUpperCase()}
                    </span>
                </div>
            </header>

            <main className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <div className={`relative overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 aspect-video transition-all duration-300 ${alertMessage ? 'ring-red-500 ring-4' : 'ring-white/10'}`}>
                        {!isMonitoring && (
                            <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                                <p>Camera is offline</p>
                            </div>
                        )}

                        {alertMessage && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-600 text-white px-6 py-2 rounded-full font-bold shadow-lg animate-pulse">
                                ⚠️ {alertMessage}
                            </div>
                        )}

                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`h-full w-full object-cover transition-transform ${isMirrored ? 'scale-x-[-1]' : ''}`}
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 h-full w-full"
                        />
                    </div>

                    <div className="mt-6 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="flex-1 w-full sm:w-auto">
                                <label htmlFor="camera-select" className="sr-only">Select Camera</label>
                                <select
                                    id="camera-select"
                                    value={selectedDeviceId}
                                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                                    disabled={isMonitoring}
                                    className="w-full rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 focus:border-blue-500 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-400"
                                >
                                    {devices.map((device) => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                                        </option>
                                    ))}
                                    {devices.length === 0 && <option value="">No cameras found</option>}
                                </select>
                            </div>

                            {!isMonitoring ? (
                                <button
                                    onClick={startWebcam}
                                    className="w-full sm:w-auto rounded-full bg-blue-600 px-6 py-2.5 font-medium text-white transition hover:bg-blue-700 active:scale-95 whitespace-nowrap"
                                >
                                    Start Proctoring
                                </button>
                            ) : (
                                <button
                                    onClick={stopWebcam}
                                    className="w-full sm:w-auto rounded-full bg-red-600 px-6 py-2.5 font-medium text-white transition hover:bg-red-700 active:scale-95 whitespace-nowrap"
                                >
                                    Stop Session
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="mirror-toggle"
                                checked={isMirrored}
                                onChange={(e) => setIsMirrored(e.target.checked)}
                                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
                            />
                            <label htmlFor="mirror-toggle" className="text-sm text-neutral-600 dark:text-neutral-300 select-none cursor-pointer">
                                Mirror Camera View
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Stats Card */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
                        <h2 className="mb-4 text-lg font-semibold">Session Stats</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900/50">
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">Violations</p>
                                <p className={`text-2xl font-bold ${violationCount > 0 ? 'text-red-500' : 'text-neutral-900 dark:text-white'}`}>
                                    {violationCount}
                                </p>
                            </div>
                            <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900/50">
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">Status</p>
                                <p className={`text-2xl font-bold ${alertMessage ? 'text-red-500' : 'text-green-500'}`}>
                                    {alertMessage ? 'ALERT' : 'CLEAN'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Logs Card */}
                    <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
                        <h2 className="mb-4 text-lg font-semibold">Activity Log</h2>
                        <div className="h-[300px] overflow-y-auto rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900/50">
                            {logs.length === 0 ? (
                                <p className="text-sm text-neutral-400 italic">No activity recorded yet.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {logs.map((log, i) => (
                                        <li key={i} className="text-sm font-mono text-neutral-600 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-800 pb-1 last:border-0">
                                            {log}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
