import { Hands } from "@mediapipe/hands";

// ==================================================
// 🎮 GAME SETUP & HTML ELEMENTEN
// ==================================================
const videoElement = document.getElementById("video") as HTMLVideoElement;
const canvasElement = document.getElementById("output") as HTMLCanvasElement;
const ctx = canvasElement.getContext("2d")!;
const scoreElement = document.getElementById("score") as HTMLParagraphElement;

// ✅ Spelvariabelen
let balls: Ball[] = [];
let popEffects: PopEffect[] = []; // Array voor pop-animaties
let gameOver = false; // Flag om te controleren of het spel voorbij is
let score = 0; // Score van de speler

// ✅ Instellingen voor ballen
const maxBalls = 5; // Maximum aantal ballen in het beeld
const maxBallsPerSpawn = 3; // Aantal ballen dat tegelijk wordt gespawned
let ballSpawnTime = 2000; // Start tijd voor het spawnen van een bal (in milliseconden)
let growthRateModifier = 0.1; // Startwaarde voor de groeisnelheid (kleiner is snel, groter is langzaam)
const growthRateIncrease = 0.04; // Hoeveelheid waarmee de groeisnelheid verhoogd wordt na elke bal
let maxGrowthRate = 0.7; // Maximum groeisnelheid van de ballen (pas dit aan naar wens)

// ✅ Instellingen voor geluidseffecten
const popSounds = [
  new Audio("../audio/pop.mp3"),
  new Audio("../audio/pop.mp3"),
  new Audio("../audio/pop.mp3"),
]; // Meerdere pop-geluiden voor variatie

// ✅ Countdown variabelen
let countdownTime = 3; // Countdown from 3 seconds
let gameStarted = false; // Flag to track if the game has started
const countdownElement = document.getElementById("countdown") as HTMLDivElement;

// ==================================================
// 📷 CAMERA SETUP
// ==================================================
async function setupCamera(): Promise<void> {
  const videoStream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  videoElement.srcObject = videoStream;
  videoElement.onloadedmetadata = () => {
    videoElement.play();
  };
}

// ==================================================
// ✋ HAND DETECTIE SETUP
// ==================================================
const hands = new Hands({
  locateFile: (file: string) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});

hands.setOptions({
  maxNumHands: 4,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults(async (results: HandsResult) => {
  if (gameOver) return;

  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      drawLandmarks(landmarks, ctx);
      detectBallCollision(landmarks);

      // Voeg deze regel toe om de nabijheid te controleren
      checkPlayerProximity(landmarks);
    }
  }

  growBalls();
  drawBalls();
  updatePopEffects(); // Update de pop-animaties
});

// ==================================================
// 🎨 TEKENEN VAN HANDEN & BALLEN OP CANVAS
// ==================================================
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

// ==================================================
// 🔴 BALLEN LOGICA
// ==================================================
interface Ball {
  x: number;
  y: number;
  radius: number;
  growthRate: number;
  color?: string; // Optionele eigenschap voor de kleur
}

// ✅ Interface voor explosie-animatie bij het klappen
interface PopEffect {
  x: number;
  y: number;
  particles: Particle[];
  lifetime: number;
  maxLifetime: number;
  initialRadius: number; // De oorspronkelijke radius van de bal
  color: string; // Kleur van de pop-effect (overgenomen van de bal)
}

// ✅ Interface voor deeltjes in de explosie
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number; // Transparantie
  color: string; // Kleur van het deeltje
}

function createBalls(): void {
  if (balls.length >= maxBalls) {
    return; // Stop met het toevoegen van ballen als het aantal ballen 10 is
  }

  // Voeg meerdere ballen tegelijk toe
  for (let i = 0; i < maxBallsPerSpawn; i++) {
    const x = Math.random() * canvasElement.width;
    const y = Math.random() * canvasElement.height;
    const radius = 20 + Math.random() * 20; // Bollen variëren in grootte
    let growthRate = growthRateModifier + Math.random() * 0.2; // Groeisnelheid van de bal

    // Zorg ervoor dat de groeisnelheid niet groter is dan maxGrowthRate
    if (growthRate > maxGrowthRate) {
      growthRate = maxGrowthRate;
    }

    balls.push({ x, y, radius, growthRate });
  }

  // Verhoog de groeisnelheid voor de volgende ballen om het spel moeilijker te maken
  growthRateModifier += growthRateIncrease;

  // Verlaag de tijd voor de volgende groep ballen
  ballSpawnTime *= 0.95; // Maak de spawn tijd elke keer 5% korter
}

function growBalls(): void {
  balls.forEach((ball) => {
    ball.radius += ball.growthRate;

    // Als de bal een bepaalde grootte heeft bereikt, game over
    // ✅ Verander de game-over logica
    if (ball.radius > 100) {
      // Stel de maximale grootte in
      gameOver = true;
      setTimeout(() => {
        // Verwijs naar de gameover pagina en geef de score mee als query parameter
        window.location.href = `gameOver.html?score=${score}`;
      }, 1000);
    }
  });
}

function drawBalls(): void {
  balls.forEach((ball) => {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);

    // Bepaal het verloop van groen naar rood op basis van de grootte van de bal
    const minRadius = 20;
    const maxRadius = 100;
    const ratio = (ball.radius - minRadius) / (maxRadius - minRadius); // Verhouding van de grootte van de bal

    // Zorg ervoor dat de verhouding tussen 0 en 1 blijft
    const red = Math.min(255, Math.floor(ratio * 255)); // Rood wordt sterker naarmate de bal groter wordt
    const blue = Math.min(255, Math.floor((1 - ratio) * 255)); // Blauw wordt minder naarmate de bal groter wordt

    // Pas de kleur toe op basis van het verloop
    const color = `rgb(${red}, 0, ${blue})`; // De groene component blijft altijd 0
    ctx.fillStyle = color;
    ctx.fill();

    // Sla de kleur op bij de bal voor later gebruik in pop-effecten
    ball.color = color;

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Teken ook de pop-effecten
  drawPopEffects();
}

// ✅ Functie voor het tekenen van de pop-effecten
function drawPopEffects(): void {
  popEffects.forEach((effect) => {
    // Teken de ring van licht die uitzet
    const ringAlpha = 0.7 * (effect.lifetime / effect.maxLifetime);
    const ringSize =
      effect.initialRadius * (2 - effect.lifetime / effect.maxLifetime);

    ctx.beginPath();
    ctx.arc(effect.x, effect.y, ringSize, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Teken alle deeltjes
    effect.particles.forEach((particle) => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${particle.color}, ${particle.alpha})`;
      ctx.fill();
    });
  });
}

// ✅ Functie om pop-effecten te updaten (beweging, levensduur, etc.)
function updatePopEffects(): void {
  // Itereer door de pop-effecten in omgekeerde volgorde om gemakkelijk te kunnen verwijderen
  for (let i = popEffects.length - 1; i >= 0; i--) {
    const effect = popEffects[i];
    effect.lifetime--;

    // Update alle deeltjes binnen dit effect
    effect.particles.forEach((particle) => {
      // Beweeg de deeltjes
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Verminder de zichtbaarheid langzaam
      particle.alpha = Math.max(0, particle.alpha - 0.02);

      // Voeg zwaartekracht toe
      particle.vy += 0.05;
    });

    // Verwijder het effect als de levensduur voorbij is
    if (effect.lifetime <= 0) {
      popEffects.splice(i, 1);
    }
  }
}

// ✅ Functie om een pop-effect te creëren
function createPopEffect(ball: Ball): void {
  const numParticles = Math.floor(ball.radius * 0.7); // Meer deeltjes voor grotere ballen
  const particles: Particle[] = [];

  // Extraheer RGB-waarden uit de ball.color string
  let r = 255,
    g = 0,
    b = 255; // Standaardwaarden
  if (ball.color) {
    const match = ball.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    }
  }

  // Creëer deeltjes die in verschillende richtingen bewegen
  for (let i = 0; i < numParticles; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3; // Variabele snelheid
    const size = 1 + Math.random() * 3; // Variabele grootte

    particles.push({
      x: ball.x,
      y: ball.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: size,
      alpha: 0.8 + Math.random() * 0.2, // Begin met volle zichtbaarheid
      color: `${r}, ${g}, ${b}`, // Gebruik dezelfde kleur als de bal
    });
  }

  // Voeg het effect toe aan de effecten-array
  popEffects.push({
    x: ball.x,
    y: ball.y,
    particles: particles,
    lifetime: 30, // Aantal frames dat het effect zichtbaar is
    maxLifetime: 30,
    initialRadius: ball.radius,
    color: ball.color || "rgb(255, 0, 255)", // Fallback naar paars als er geen kleur is
  });
}

// ✅ Functie om een willekeurig popgeluid af te spelen
function playPopSound(): void {
  // Kies een willekeurig geluid uit de array
  const randomIndex = Math.floor(Math.random() * popSounds.length);
  const sound = popSounds[randomIndex];

  // Reset het geluid en speel het af
  sound.currentTime = 0;
  sound.volume = 0.5; // Pas het volume aan (0.0 tot 1.0)
  sound.play().catch((error) => {
    console.log("Geluid kon niet worden afgespeeld:", error);
    // Dit kan gebeuren als de gebruiker nog niet met de pagina heeft geïnteracteerd
  });
}

function detectBallCollision(landmarks: Landmark[]): void {
  // Itereer door de ballen in omgekeerde volgorde om problemen met indexverandering te voorkomen
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];

    // Itereer door de handlandmarks
    for (const landmark of landmarks) {
      const x = landmark.x * canvasElement.width;
      const y = landmark.y * canvasElement.height;

      // Controleer of de hand dicht bij de bol is
      const distance = Math.sqrt((x - ball.x) ** 2 + (y - ball.y) ** 2);
      if (distance < ball.radius) {
        // ✅ Creëer een pop-effect op de locatie van de bal
        createPopEffect(ball);

        // ✅ Speel een popgeluid af
        playPopSound();

        // Verhoog de score en verwijder de bol
        score += 1;
        balls.splice(i, 1); // Verwijder de bal die geraakt is
        updateScore(); // Werk de score bij

        break; // Stop met het controleren van deze bal, omdat deze is verwijderd
      }
    }
  }
}

function updateScore(): void {
  scoreElement.textContent = `Score: ${score}`;

  // ✅ Voeg een kleine animatie toe aan de score wanneer deze verandert
  scoreElement.classList.add("score-pulse");
  setTimeout(() => {
    scoreElement.classList.remove("score-pulse");
  }, 300);
}

function startBallSpawner(): void {
  if (gameOver) return;

  createBalls();

  // Only schedule the next ball spawn if the game has started
  if (gameStarted) {
    setTimeout(startBallSpawner, ballSpawnTime);
  }
}

// ==================================================
// 🏁 SPEL STARTEN
// ==================================================
async function start(): Promise<void> {
  await setupCamera();
  detectHands();

  // Start the countdown instead of immediately spawning balls
  startCountdown();

  // Preload sounds for better performance
  popSounds.forEach((sound) => {
    sound.load();
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

start();

// ✅ Voeg deze variabelen toe bij de spelvariabelen
let isPlayerTooClose = false; // Flag om bij te houden of de speler te dicht staat
let warningTimer = 0; // Timer voor het tonen van de waarschuwing
const WARNING_DURATION = 3000; // Duur van de waarschuwing in milliseconden
const PROXIMITY_THRESHOLD = 0.4; // Drempelwaarde voor wanneer de speler te dicht staat (0-1)

// ✅ Voeg dit element toe aan je HTML
// <div id="warning-message" class="warning-hidden">Te dicht bij! Ga alsjeblieft een stap naar achteren.</div>

// ✅ Voeg deze functie toe om de nabijheid van de speler te controleren
function checkPlayerProximity(landmarks: Landmark[]): void {
  // Bereken de gemiddelde Z-waarde van alle landmarks
  // Als de Z-waarde te klein is (hand te dicht bij camera), toon waarschuwing

  // Bereken de grootte van de hand in het frame als indicatie van nabijheid
  const handWidth =
    Math.max(...landmarks.map((lm) => lm.x * canvasElement.width)) -
    Math.min(...landmarks.map((lm) => lm.x * canvasElement.width));

  const handHeight =
    Math.max(...landmarks.map((lm) => lm.y * canvasElement.height)) -
    Math.min(...landmarks.map((lm) => lm.y * canvasElement.height));

  // Bereken de hand grootte relatief aan het canvas
  const handSize = Math.max(
    handWidth / canvasElement.width,
    handHeight / canvasElement.height
  );

  // Als de handgrootte groter is dan de drempelwaarde, is de speler te dicht bij
  if (handSize > PROXIMITY_THRESHOLD) {
    if (!isPlayerTooClose) {
      isPlayerTooClose = true;
      warningTimer = Date.now();
      showWarningMessage(true);
    }
  } else {
    if (isPlayerTooClose) {
      isPlayerTooClose = false;
      showWarningMessage(false);
    }
  }

  // Update de waarschuwingsstatus als de timer is verlopen
  if (isPlayerTooClose && Date.now() - warningTimer > WARNING_DURATION) {
    warningTimer = Date.now(); // Reset de timer voor een herhalende waarschuwing
  }
}

// ✅ Functie om de waarschuwingsboodschap te tonen of te verbergen
function showWarningMessage(show: boolean): void {
  const warningElement = document.getElementById("warning-message");
  if (!warningElement) return;

  if (show) {
    warningElement.classList.remove("warning-hidden");
    warningElement.classList.add("warning-visible");
  } else {
    warningElement.classList.remove("warning-visible");
    warningElement.classList.add("warning-hidden");
  }
}

// Add this countdown function
function startCountdown(): void {
  countdownElement.textContent = `${countdownTime}`;
  countdownElement.style.display = "block";

  // Add initial animation class
  countdownElement.classList.add("countdown-pulse");

  const countdownInterval = setInterval(() => {
    // Reset animations
    countdownElement.classList.remove("countdown-pulse");
    void countdownElement.offsetWidth; // Trigger reflow to restart animations

    countdownTime--;

    if (countdownTime <= 0) {
      // Countdown finished
      clearInterval(countdownInterval);

      // Add final animation
      countdownElement.textContent = "GO!";
      countdownElement.classList.add("countdown-zoom-out");

      // Hide countdown after animation completes
      setTimeout(() => {
        countdownElement.style.display = "none";
        gameStarted = true;
        startBallSpawner(); // Start spawning balls now
      }, 800);
    } else {
      countdownElement.textContent = `${countdownTime}`;
      countdownElement.classList.add("countdown-pulse");
    }
  }, 1000);
}
