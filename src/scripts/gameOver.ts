import {
  GestureRecognizer,
  GestureRecognizerOptions,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import { Hands } from "@mediapipe/hands";

const videoElement = document.getElementById("video") as HTMLVideoElement;
const canvasElement = document.getElementById("output") as HTMLCanvasElement;
const ctx = canvasElement.getContext("2d")!;

let timerStarted = false;
let timer: ReturnType<typeof setTimeout>;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let homeTimer: ReturnType<typeof setTimeout> | null = null;

async function setupCamera(): Promise<void> {
  const videoStream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  videoElement.srcObject = videoStream;
  videoElement.onloadedmetadata = () => {
    videoElement.play();
  };
}

const hands = new Hands({
  locateFile: (file: string) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});

const vision = await FilesetResolver.forVisionTasks(
  // path/to/wasm/root
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

console.log("Laden van gesture model...");
const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "../models/gesture_recognizer.task",
    delegate: "GPU", // ✅ Gebruik GPU in plaats van CPU
  },
  runningMode: "VIDEO",
  numHands: 2,
} as GestureRecognizerOptions);

hands.setOptions({
  maxNumHands: 4,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

async function detectThumbsUp(): Promise<boolean> {
  if (!gestureRecognizer) return false;

  const detections = await gestureRecognizer.recognizeForVideo(
    videoElement,
    performance.now()
  );

  const progressBar = document.getElementById("progress-restart")!;

  if (!detections || !detections.gestures || detections.gestures.length === 0) {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    progressBar.style.transition = "none"; // Direct resetten
    progressBar.style.width = "0%";
    requestAnimationFrame(() => {
      progressBar.style.transition = "width 2s linear"; // Herstel de animatie
    });
    return false;
  }

  const thumbsUpGesture = detections.gestures.some((gestureSet) =>
    gestureSet.some(
      (gesture) => gesture.categoryName === "Thumb_Up" && gesture.score > 0.6
    )
  );

  if (thumbsUpGesture) {
    if (!restartTimer) {
      restartTimer = setTimeout(() => {
        window.location.href = "game.html";
      }, 2000);
    }
    progressBar.style.width = "100%";
    return true;
  } else {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    progressBar.style.transition = "none"; // Direct resetten
    progressBar.style.width = "0%";
    requestAnimationFrame(() => {
      progressBar.style.transition = "width 2s linear"; // Herstel de animatie
    });
  }

  return false;
}

async function detectThumbsDown(): Promise<boolean> {
  if (!gestureRecognizer) return false;

  const detections = await gestureRecognizer.recognizeForVideo(
    videoElement,
    performance.now()
  );

  const progressBar = document.getElementById("progress-home")!;

  if (!detections || !detections.gestures || detections.gestures.length === 0) {
    if (homeTimer) {
      clearTimeout(homeTimer);
      homeTimer = null;
    }
    progressBar.style.transition = "none"; // Direct resetten
    progressBar.style.width = "0%";
    requestAnimationFrame(() => {
      progressBar.style.transition = "width 2s linear"; // Herstel de animatie
    });
    return false;
  }

  const thumbsDownGesture = detections.gestures.some((gestureSet) =>
    gestureSet.some(
      (gesture) => gesture.categoryName === "Thumb_Down" && gesture.score > 0.6
    )
  );

  if (thumbsDownGesture) {
    if (!homeTimer) {
      homeTimer = setTimeout(() => {
        window.location.href = "../../index.html";
      }, 2000);
    }
    progressBar.style.width = "100%";
    return true;
  } else {
    if (homeTimer) {
      clearTimeout(homeTimer);
      homeTimer = null;
    }
    progressBar.style.transition = "none"; // Direct resetten
    progressBar.style.width = "0%";
    requestAnimationFrame(() => {
      progressBar.style.transition = "width 2s linear"; // Herstel de animatie
    });
  }

  return false;
}

hands.onResults(async (results: HandsResult) => {
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      drawLandmarks(landmarks, ctx);

      // ✅ Wacht op detectie van een "Thumbs Up" voor het starten van het spel
      await detectThumbsUp();
      await detectThumbsDown();
    }
  }
});

// Functie om handlandmarks te tekenen
function drawLandmarks(
  landmarks: Landmark[],
  ctx: CanvasRenderingContext2D
): void {
  const palmRadius = 5;
  const fingerRadius = 3;

  // Teken de lijnen tussen de handlandmarks
  drawHandLines(landmarks, ctx);

  // Teken de punten (landmarks)
  landmarks.forEach((landmark, index) => {
    const x = landmark.x * canvasElement.width;
    const y = landmark.y * canvasElement.height;

    ctx.beginPath();
    ctx.arc(x, y, index === 0 ? palmRadius : fingerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
  });
}

// Functie om lijnen tussen handlandmarks te tekenen
function drawHandLines(
  landmarks: Landmark[],
  ctx: CanvasRenderingContext2D
): void {
  const connections = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4], // Thumb
    [0, 5],
    [5, 6],
    [6, 7], // Index
    [0, 9],
    [9, 10],
    [10, 11],
    [11, 12], // Middle
    [0, 13],
    [13, 14],
    [14, 15],
    [15, 16], // Ring
    [0, 17],
    [17, 18],
    [18, 19],
    [19, 20], // Pinky
  ];

  // Teken lijnen voor elke verbinding
  connections.forEach(([start, end]) => {
    const startX = landmarks[start].x * canvasElement.width;
    const startY = landmarks[start].y * canvasElement.height;
    const endX = landmarks[end].x * canvasElement.width;
    const endY = landmarks[end].y * canvasElement.height;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = "blue"; // Lijnkleur
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

async function start(): Promise<void> {
  await setupCamera();
  detectHands();
  startInactivityTimer(); // Start de timer voor inactiviteit
}

// Timer om de gebruiker na 10 seconden inactiviteit naar de indexpagina te sturen
function startInactivityTimer() {
  if (timerStarted) return; // Zorg ervoor dat de timer niet meerdere keren wordt gestart
  timerStarted = true;

  timer = setTimeout(() => {
    window.location.href = "../../index.html"; // Verwijs naar index.html na 10 seconden zonder gebaren
  }, 20000);
}

async function detectHands(): Promise<void> {
  const model = await hands.initialize();
  const detect = async () => {
    await hands.send({ image: videoElement });
    requestAnimationFrame(detect);
  };
  detect();
}

start();
