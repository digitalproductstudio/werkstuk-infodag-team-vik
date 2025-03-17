import {
  GestureRecognizer,
  GestureRecognizerOptions,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import { Hands } from "@mediapipe/hands";

const videoElement = document.getElementById("video") as HTMLVideoElement;
const canvasElement = document.getElementById("output") as HTMLCanvasElement;
const ctx = canvasElement.getContext("2d")!;

let thumbsUpTimer: NodeJS.Timeout | null = null; // Variabele om de timer bij te houden
let timerStarted = false; // Indicator of de timer al gestart is

async function setupCamera(): Promise<void> {
  const videoStream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  videoElement.srcObject = videoStream;
  videoElement.onloadedmetadata = () => {
    videoElement.play();
  };
}

// Initializeer het MediaPipe Hands model
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
    modelAssetPath: "./src/models/gesture_recognizer.task",
    delegate: "GPU", // ✅ Gebruik GPU in plaats van CPU
  },
  runningMode: "VIDEO",
  numHands: 2,
} as GestureRecognizerOptions);

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

// Wanneer hand landmarks worden gedetecteerd, teken ze op de canvas
hands.onResults((results: HandsResult) => {
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks) {
    results.multiHandLandmarks.forEach((landmarks) => {
      drawLandmarks(landmarks, ctx);

      detectThumbsUp(results).then((isThumbsUp) => {
        if (isThumbsUp) {
          // Als de duim omhoog gedetecteerd wordt en de timer nog niet is gestart
          if (!timerStarted) {
            // Stel een timer in van 2 seconden en redirect naar de game-pagina
            thumbsUpTimer = setTimeout(() => {
              window.location.href = "./src/pages/game.html";
            }, 3000);

            timerStarted = true; // Markeer de timer als gestart
            startCountdown();
          }
        } else {
          // Als de duim omhoog niet meer gedetecteerd wordt, reset de timer
          if (thumbsUpTimer) {
            clearTimeout(thumbsUpTimer); // Stop de oude timer
            thumbsUpTimer = 3000; // Zet de timer terug naar 2 seconden
          }

          timerStarted = false; // Markeer de timer als niet gestart
          resetCountdown();
        }
      });
    });
  }
});

function drawLandmarks(
  landmarks: Landmark[],
  ctx: CanvasRenderingContext2D
): void {
  const palmRadius = 2;
  const fingerRadius = 2;

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
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

async function detectHands(): Promise<void> {
  await hands.initialize();
  const detect = async () => {
    await hands.send({ image: videoElement });
    requestAnimationFrame(detect);
  };
  detect();
}

// Controleer of de gebruiker de "Thumbs Up" gebaar maakt
async function detectThumbsUp(results: HandsResult): Promise<boolean> {
  if (!gestureRecognizer) return false;

  const detections = await gestureRecognizer.recognizeForVideo(
    videoElement,
    performance.now()
  );

  if (!detections || !detections.gestures || detections.gestures.length === 0) {
    return false;
  }

  // Controleer of een van de herkende gebaren "Thumbs Up" is
  const thumbsUpGesture = detections.gestures.some((gestureSet) =>
    gestureSet.some(
      (gesture) => gesture.categoryName === "Thumb_Up" && gesture.score > 0.6
    )
  );

  return thumbsUpGesture;
}

async function start(): Promise<void> {
  await setupCamera();
  detectHands(); // Zorg ervoor dat de handdetectie blijft draaien
}

start();

let countdownTime = 3;
const countdownElement = document.getElementById("countdown") as HTMLDivElement;
let countdownInterval: NodeJS.Timeout | null = null; // Houd het interval bij

function startCountdown(): void {
  resetCountdown(); // Zorg ervoor dat er geen dubbele intervals lopen

  countdownElement.textContent = `${countdownTime}`;
  countdownElement.style.display = "block";
  countdownElement.classList.add("countdown-pulse");

  countdownInterval = setInterval(() => {
    countdownElement.classList.remove("countdown-pulse");
    void countdownElement.offsetWidth; // Trigger reflow

    countdownTime--;

    if (countdownTime <= 0) {
      clearInterval(countdownInterval!);
      countdownInterval = null; // Reset de interval referentie

      countdownElement.classList.add("countdown-zoom-out");

      setTimeout(() => {
        countdownElement.style.display = "none";
      }, 800);
    } else {
      countdownElement.textContent = `${countdownTime}`;
      countdownElement.classList.add("countdown-pulse");
    }
  }, 1000);
}

function resetCountdown(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  countdownTime = 3;
  countdownElement.textContent = `${countdownTime}`;
  countdownElement.style.display = "none";
  countdownElement.classList.remove("countdown-pulse", "countdown-zoom-out");
}
