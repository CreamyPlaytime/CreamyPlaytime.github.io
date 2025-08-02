let points = 0, level = 1, xp = 0, xpNext = 10;
let autoClickers = 0, clickPower = 1, xpBoost = 1;
let autoCost = 50, clickPowerCost = 100, xpBoostCost = 150;
let superClickCount = 0, superClickCost = 1000, superClickPower = 10;
let passiveXpCount = 0, passiveXpCost = 250;
const requiredLevelSuperClick = 5;
const requiredLevelPassiveXp = 3;

const updateUI = () => {
  document.getElementById("points").textContent = points;
  document.getElementById("level").textContent = level;
  document.getElementById("xp").textContent = xp;
  document.getElementById("xpNext").textContent = xpNext;
  document.getElementById("autoCount").textContent = autoClickers;
  document.getElementById("clickPower").textContent = clickPower;
  document.getElementById("xpBoost").textContent = xpBoost;
  document.getElementById("autoCost").textContent = autoCost;
  document.getElementById("clickPowerCost").textContent = clickPowerCost;
  document.getElementById("xpBoostCost").textContent = xpBoostCost;
  document.getElementById("superClickCount").textContent = superClickCount;
  document.getElementById("passiveXpCount").textContent = passiveXpCount;
  const superClickBtn = document.getElementById("superClickBtn");
  const passiveXpBtn = document.getElementById("passiveXpBtn");
  if (level >= requiredLevelPassiveXp) {
    passiveXpBtn.textContent = `Passive XP Gain (${passiveXpCost} pts)`;
    passiveXpBtn.classList.remove("locked");
    passiveXpBtn.disabled = false;
  } else {
    passiveXpBtn.textContent = `Locked (Level ${requiredLevelPassiveXp})`;
    passiveXpBtn.classList.add("locked");
    passiveXpBtn.disabled = true;
  }
  if (level >= requiredLevelSuperClick) {
    superClickBtn.textContent = `Super Clicker (${superClickCost} pts)`;
    superClickBtn.classList.remove("locked");
    superClickBtn.disabled = false;
  } else {
    superClickBtn.textContent = `Locked (Level ${requiredLevelSuperClick})`;
    superClickBtn.classList.add("locked");
    superClickBtn.disabled = true;
  }
};

const gainXP = (amount) => {
  xp += amount;
  if (xp >= xpNext) {
    xp -= xpNext;
    level++;
    xpNext = Math.floor(xpNext * 1.5);
  }
};

const clicker = () => {
  points += clickPower;
  gainXP(xpBoost);
  updateUI();
};

const buyAutoClick = () => {
  if (points >= autoCost) {
    points -= autoCost;
    autoClickers++;
    autoCost = Math.floor(autoCost * 1.5);
    updateUI();
  }
};

const buyClickPower = () => {
  if (points >= clickPowerCost) {
    points -= clickPowerCost;
    clickPower++;
    clickPowerCost = Math.floor(clickPowerCost * 1.75);
    updateUI();
  }
};

const buyXPBoost = () => {
  if (points >= xpBoostCost) {
    points -= xpBoostCost;
    xpBoost++;
    xpBoostCost = Math.floor(xpBoostCost * 1.8);
    updateUI();
  }
};

const buySuperClick = () => {
  if (points >= superClickCost && level >= requiredLevelSuperClick) {
    points -= superClickCost;
    superClickCount++;
    clickPower += superClickPower;
    superClickCost = Math.floor(superClickCost * 2);
    updateUI();
  }
};

const buyPassiveXP = () => {
  if (points >= passiveXpCost && level >= requiredLevelPassiveXp) {
    points -= passiveXpCost;
    passiveXpCount++;
    passiveXpCost = Math.floor(passiveXpCost * 1.6);
    updateUI();
  }
};

setInterval(() => {
  points += autoClickers;
  gainXP(passiveXpCount);
  updateUI();
}, 1000);

function saveSlot(slot) {
  const saveData = {
    points, level, xp, xpNext,
    autoClickers, clickPower, xpBoost,
    autoCost, clickPowerCost, xpBoostCost,
    superClickCount, superClickCost,
    passiveXpCount, passiveXpCost
  };
  localStorage.setItem("clicker_slot" + slot, JSON.stringify(saveData));
  alert("Saved to slot " + slot);
}

function loadSlot(slot) {
  const data = localStorage.getItem("clicker_slot" + slot);
  if (data) {
    const save = JSON.parse(data);
    points = save.points;
    level = save.level;
    xp = save.xp;
    xpNext = save.xpNext;
    autoClickers = save.autoClickers;
    clickPower = save.clickPower;
    xpBoost = save.xpBoost;
    autoCost = save.autoCost;
    clickPowerCost = save.clickPowerCost;
    xpBoostCost = save.xpBoostCost;
    superClickCount = save.superClickCount || 0;
    superClickCost = save.superClickCost || 1000;
    passiveXpCount = save.passiveXpCount || 0;
    passiveXpCost = save.passiveXpCost || 250;
    updateUI();
    alert("Loaded slot " + slot);
  } else {
    alert("No save found in slot " + slot);
  }
}

updateUI();