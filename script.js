let gameState = {
  points: 0,
  level: 1,
  xp: 0,
  xpNext: 10,
  autoClickers: 0,
  clickPower: 1,
  xpBoost: 1,
  autoCost: 50,
  clickPowerCost: 100,
  xpBoostCost: 150,
  superClickCount: 0,
  superClickCost: 1000,
  superClickPower: 10,
  passiveXpCount: 0,
  passiveXpCost: 250,
  critChance: 0,
  critClickCost: 500,
  discountCount: 0,
  discountCost: 2000,
  pointMultiplier: 1,
  multiplierCost: 5000,
  goldenDetectorCount: 0,
  goldenDetectorCost: 10000
};

let pointRushActive = false, pointRushMultiplier = 5, pointRushDuration = 10000;
let xpSurgeActive = false, xpSurgeMultiplier = 5, xpSurgeDuration = 10000;
let goldenClickActive = false, goldenClickBonus = 5000;

const upgradeData = {
    autoClick: { id: "autoClickBtn", costVar: 'autoCost', countVar: 'autoClickers', newCostCalc: (c) => Math.floor(c * 1.5), requiredLevel: 0, text: "Auto Clicker", displayCostId: "autoCost" },
    clickPower: { id: "clickPowerBtn", costVar: 'clickPowerCost', powerVar: 'clickPower', newCostCalc: (c) => Math.floor(c * 1.75), bonus: 1, requiredLevel: 0, text: "+1 Click Power", displayCostId: "clickPowerCost" },
    xpBoost: { id: "xpBoostBtn", costVar: 'xpBoostCost', powerVar: 'xpBoost', newCostCalc: (c) => Math.floor(c * 1.8), bonus: 1, requiredLevel: 0, text: "+1 XP per click", displayCostId: "xpBoostCost" },
    passiveXp: { id: "passiveXpBtn", costVar: 'passiveXpCost', countVar: 'passiveXpCount', newCostCalc: (c) => Math.floor(c * 1.6), requiredLevel: 3, text: "Passive XP Gain", displayCostId: "passiveXpCost" },
    superClick: { id: "superClickBtn", costVar: 'superClickCost', powerVar: 'clickPower', newCostCalc: (c) => Math.floor(c * 2), bonus: 10, requiredLevel: 5, text: "Super Clicker", displayCostId: "superClickCost" },
    critClick: { id: "critClickBtn", costVar: 'critClickCost', powerVar: 'critChance', newCostCalc: (c) => Math.floor(c * 1.5), cap: 0.25, bonus: 0.01, requiredLevel: 2, text: "Critical Click Chance", displayCostId: "critClickCost" },
    discount: { id: "discountBtn", costVar: 'discountCost', countVar: 'discountCount', newCostCalc: (c) => Math.floor(c * 2.5), cap: 5, bonus: 1, requiredLevel: 10, text: "Upgrade Discount", displayCostId: "discountCost" },
    multiplier: { id: "multiplierBtn", costVar: 'multiplierCost', powerVar: 'pointMultiplier', newCostCalc: (c) => Math.floor(c * 2), bonus: 0.25, requiredLevel: 15, text: "Point Multiplier", displayCostId: "multiplierCost" },
    goldenDetector: { id: "goldenDetectorBtn", costVar: 'goldenDetectorCost', countVar: 'goldenDetectorCount', newCostCalc: (c) => Math.floor(c * 2.5), cap: 10, bonus: 1, requiredLevel: 20, text: "Golden Detector", displayCostId: "goldenDetectorCost" }
};

const updateUI = () => {
  document.getElementById("points").textContent = gameState.points;
  document.getElementById("level").textContent = gameState.level;
  document.getElementById("xp").textContent = gameState.xp;
  document.getElementById("xpNext").textContent = gameState.xpNext;
  document.getElementById("autoCount").textContent = gameState.autoClickers;
  document.getElementById("clickPower").textContent = gameState.clickPower;
  document.getElementById("xpBoost").textContent = gameState.xpBoost;
  document.getElementById("superClickCount").textContent = gameState.superClickCount;
  document.getElementById("passiveXpCount").textContent = gameState.passiveXpCount;
  document.getElementById("critChance").textContent = (gameState.critChance * 100).toFixed(2);
  document.getElementById("discountCount").textContent = gameState.discountCount;
  document.getElementById("pointMultiplier").textContent = gameState.pointMultiplier.toFixed(2);
  document.getElementById("goldenChance").textContent = (0.1 + gameState.goldenDetectorCount * 0.05).toFixed(2);

  const xpPercentage = (gameState.xp / gameState.xpNext) * 100;
  document.getElementById("xpBar").style.width = xpPercentage + "%";

  for (const key in upgradeData) {
      const data = upgradeData[key];
      const btn = document.getElementById(data.id);
      const currentCost = Math.floor(gameState[data.costVar] * (1 - gameState.discountCount * 0.05));
      const canAfford = gameState.points >= currentCost;

      if (data.requiredLevel > gameState.level) {
          btn.textContent = `Locked (Level ${data.requiredLevel})`;
          btn.classList.add("locked");
          btn.classList.remove("unaffordable");
          btn.disabled = true;
      } else {
          btn.textContent = `${data.text} (${currentCost} pts)`;
          btn.classList.remove("locked");
          btn.disabled = false;
          
          if (!canAfford) {
              btn.classList.add("unaffordable");
          } else {
              btn.classList.remove("unaffordable");
          }
      }
  }
};

const gainXP = (amount) => {
  let xpGain = amount;
  if (xpSurgeActive) {
      xpGain *= xpSurgeMultiplier;
  }
  gameState.xp += xpGain;
  if (gameState.xp >= gameState.xpNext) {
    gameState.xp -= gameState.xpNext;
    gameState.level++;
    gameState.xpNext = Math.floor(gameState.xpNext * 1.5);
  }
  updateUI();
};

const clicker = () => {
  let pointsThisClick = gameState.clickPower;
  if (Math.random() < gameState.critChance) {
    pointsThisClick *= 10;
  }
  if (goldenClickActive) {
    pointsThisClick += goldenClickBonus;
    goldenClickActive = false;
    document.getElementById("goldenClickBanner").style.display = "none";
  }
  if (pointRushActive) {
    pointsThisClick *= pointRushMultiplier;
  }
  pointsThisClick *= gameState.pointMultiplier;
  gameState.points += pointsThisClick;
  gainXP(gameState.xpBoost);
  updateUI();
};

const buyUpgrade = (upgradeType) => {
    const data = upgradeData[upgradeType];
    const currentCost = Math.floor(gameState[data.costVar] * (1 - gameState.discountCount * 0.05));
    const isCapped = data.cap !== undefined && (data.countVar ? gameState[data.countVar] >= data.cap : gameState[data.powerVar] >= data.cap);

    if (gameState.points >= currentCost && gameState.level >= data.requiredLevel && !isCapped) {
        gameState.points -= currentCost;
        if (data.countVar) gameState[data.countVar]++;
        if (data.powerVar) gameState[data.powerVar] += data.bonus;
        gameState[data.costVar] = data.newCostCalc(gameState[data.costVar]);
        updateUI();
    }
};

setInterval(() => {
  let passivePoints = gameState.autoClickers;
  if (pointRushActive) {
      passivePoints *= pointRushMultiplier;
  }
  gameState.points += passivePoints * gameState.pointMultiplier;
  gainXP(gameState.passiveXpCount);
  updateUI();
}, 1000);

const startPointRush = () => {
  const eventBanner = document.getElementById("eventBanner");
  eventBanner.style.display = "block";
  eventBanner.textContent = `🔥 POINT RUSH! All point gains are multiplied by ${pointRushMultiplier}!`;
  pointRushActive = true;
  setTimeout(() => {
      pointRushActive = false;
      eventBanner.style.display = "none";
      eventBanner.textContent = "";
  }, pointRushDuration);
}

const startXPSurge = () => {
  const xpEventBanner = document.getElementById("xpEventBanner");
  xpEventBanner.style.display = "block";
  xpEventBanner.textContent = `🚀 XP SURGE! All XP gains are multiplied by ${xpSurgeMultiplier}!`;
  xpSurgeActive = true;
  setTimeout(() => {
      xpSurgeActive = false;
      xpEventBanner.style.display = "none";
      xpEventBanner.textContent = "";
  }, xpSurgeDuration);
}

const startGoldenClick = () => {
  const goldenClickBanner = document.getElementById("goldenClickBanner");
  goldenClickBanner.style.display = "block";
  goldenClickBanner.textContent = `✨ GOLDEN CLICK! Your next click is worth a huge bonus!`;
  goldenClickActive = true;
}

const checkRandomEvent = () => {
  const chance = Math.random();
  const goldenClickChance = 0.001 + gameState.goldenDetectorCount * 0.0005; // Base chance + 0.05% per detector
  if (chance < 0.03) {
    startPointRush();
  } else if (chance < 0.05) {
    startXPSurge();
  } else if (chance < 0.05 + goldenClickChance) {
    startGoldenClick();
  }
};

setInterval(checkRandomEvent, 30000);

function saveSlot(slot) {
  localStorage.setItem("clicker_slot" + slot, JSON.stringify(gameState));
  alert("Saved to slot " + slot);
}

function loadSlot(slot) {
  const data = localStorage.getItem("clicker_slot" + slot);
  if (data) {
    const loadedState = JSON.parse(data);
    for (const key in loadedState) {
        if (gameState.hasOwnProperty(key)) {
            gameState[key] = loadedState[key];
        }
    }
    updateUI();
    alert("Loaded slot " + slot);
  } else {
    alert("No save found in slot " + slot);
  }
}

updateUI();