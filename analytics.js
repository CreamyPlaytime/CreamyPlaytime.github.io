// Simulated Live Analytics (hook this up to Umami API or use fake counters for flex)
let fakeClicks = 0;
setInterval(() => {
  fakeClicks += Math.floor(Math.random() * 5); // Simulate clicks
  document.getElementById('totalClicks').textContent = fakeClicks;
}, 3000);

// Simulate Active Visitors
setInterval(() => {
  const activeVisitors = Math.floor(Math.random() * 10) + 1;
  document.getElementById('liveVisitors').textContent = activeVisitors;
}, 5000);

// Simulate Top Referrer
const referrers = ['YouTube', '5Mods', 'Direct', 'GitHub', 'Discord'];
setInterval(() => {
  const randomReferrer = referrers[Math.floor(Math.random() * referrers.length)];
  document.getElementById('topReferrer').textContent = randomReferrer;
}, 10000);