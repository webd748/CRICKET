const state = {
  global: {
    wallet: 10000,
    squadSize: 11,
    minBasePrice: 500,
  },
  teams: [],
  players: [],
  activePlayerIndex: -1,
};

const el = {
  walletInput: document.querySelector('#walletInput'),
  squadSizeInput: document.querySelector('#squadSizeInput'),
  minBaseInput: document.querySelector('#minBaseInput'),
  teamNameInput: document.querySelector('#teamNameInput'),
  addTeamBtn: document.querySelector('#addTeamBtn'),
  applyGlobalsBtn: document.querySelector('#applyGlobalsBtn'),
  loadDemoBtn: document.querySelector('#loadDemoBtn'),
  teamsPillList: document.querySelector('#teamsPillList'),
  globalBadge: document.querySelector('#globalBadge'),
  activePlayerCard: document.querySelector('#activePlayerCard'),
  winningTeamSelect: document.querySelector('#winningTeamSelect'),
  soldPriceInput: document.querySelector('#soldPriceInput'),
  validationPanel: document.querySelector('#validationPanel'),
  markSoldBtn: document.querySelector('#markSoldBtn'),
  markUnsoldBtn: document.querySelector('#markUnsoldBtn'),
  nextPlayerBtn: document.querySelector('#nextPlayerBtn'),
  playerPoolStats: document.querySelector('#playerPoolStats'),
  playerPoolList: document.querySelector('#playerPoolList'),
  teamsLeaderboard: document.querySelector('#teamsLeaderboard'),
  unsoldList: document.querySelector('#unsoldList'),
  toast: document.querySelector('#toast'),
  tabs: document.querySelectorAll('.tab'),
  tabPanels: document.querySelectorAll('.tab-panel'),
};

const roles = ['Batsman', 'Bowler', 'All-Rounder', 'WK'];

function teamInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

boot();

async function boot() {
  await loadPlayers();
  bindEvents();
  seedTeams();
  setNextAvailablePlayer();
  render();
}

function bindEvents() {
  el.addTeamBtn.addEventListener('click', addTeamFromInput);
  el.applyGlobalsBtn.addEventListener('click', applyGlobalSettings);
  el.loadDemoBtn.addEventListener('click', seedTeams);
  el.markSoldBtn.addEventListener('click', handleMarkSold);
  el.markUnsoldBtn.addEventListener('click', handleMarkUnsold);
  el.nextPlayerBtn.addEventListener('click', () => {
    setNextAvailablePlayer(true);
    render();
  });
  el.winningTeamSelect.addEventListener('change', renderValidation);
  el.soldPriceInput.addEventListener('input', renderValidation);

  el.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      el.tabs.forEach((x) => x.classList.remove('active'));
      tab.classList.add('active');
      el.tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === tab.dataset.tab));
    });
  });
}

async function loadPlayers() {
  const response = await fetch('./players.json');
  const data = await response.json();
  state.players = data.map((player, index) => ({
    id: index + 1,
    ...player,
    status: 'unsold',
    soldToTeamId: null,
    soldPrice: null,
  }));
}

function seedTeams() {
  const names = ['Mumbai Indians', 'CSK', 'RCB', 'Delhi Capitals'];
  const existing = new Set(state.teams.map((team) => team.name.toLowerCase()));
  names.forEach((name) => {
    if (!existing.has(name.toLowerCase())) state.teams.push(createTeam(name));
  });
  render();
}

function createTeam(name) {
  const hue = Math.floor(Math.random() * 360);
  return {
    id: crypto.randomUUID(),
    name,
    color: `hsl(${hue} 75% 72%)`,
    logo: teamInitials(name),
    walletRemaining: state.global.wallet,
    players: [],
  };
}

function addTeamFromInput() {
  const name = el.teamNameInput.value.trim();
  if (!name) return toast('Please enter a team name.');
  state.teams.push(createTeam(name));
  el.teamNameInput.value = '';
  render();
}

function applyGlobalSettings() {
  state.global.wallet = Number(el.walletInput.value) || 10000;
  state.global.squadSize = Number(el.squadSizeInput.value) || 11;
  state.global.minBasePrice = Number(el.minBaseInput.value) || 500;

  state.teams = state.teams.map((team) => {
    const spent = team.players.reduce((sum, player) => sum + player.soldPrice, 0);
    const nextRemaining = Math.max(state.global.wallet - spent, 0);
    return { ...team, walletRemaining: nextRemaining };
  });

  toast('Global settings applied.');
  render();
}

function currentPlayer() {
  return state.players[state.activePlayerIndex] ?? null;
}

function setNextAvailablePlayer(loopFromStart = false) {
  if (!state.players.length) {
    state.activePlayerIndex = -1;
    return;
  }

  const start = loopFromStart ? 0 : Math.max(0, state.activePlayerIndex + 1);
  const nextIndex = state.players.findIndex((player, idx) => idx >= start && player.status === 'unsold');
  if (nextIndex >= 0) {
    state.activePlayerIndex = nextIndex;
    return;
  }

  const fallbackIndex = state.players.findIndex((player) => player.status === 'unsold');
  state.activePlayerIndex = fallbackIndex;
}

function handleMarkSold() {
  const player = currentPlayer();
  if (!player) return;
  if (player.status !== 'unsold') return toast('Only unsold players can be sold.');

  const teamId = el.winningTeamSelect.value;
  const soldPrice = Number(el.soldPriceInput.value);
  const verdict = validateBid(teamId, soldPrice);

  if (!verdict.ok) {
    toast(verdict.message);
    renderValidation();
    return;
  }

  const team = state.teams.find((t) => t.id === teamId);
  player.status = 'sold';
  player.soldToTeamId = teamId;
  player.soldPrice = soldPrice;

  team.walletRemaining -= soldPrice;
  team.players.push({ id: player.id, name: player.name, role: player.role, soldPrice });

  launchConfetti(team.color);
  toast(`${player.name} sold to ${team.name} for ₹${soldPrice.toLocaleString()}`);

  el.soldPriceInput.value = '';
  setNextAvailablePlayer();
  render();
}

function handleMarkUnsold() {
  const player = currentPlayer();
  if (!player) return;
  player.status = 'passed';
  toast(`${player.name} marked as passed.`);
  setNextAvailablePlayer();
  render();
}

function validateBid(teamId, soldPrice) {
  const team = state.teams.find((x) => x.id === teamId);
  const player = currentPlayer();
  if (!team) return { ok: false, message: 'Select a winning team.' };
  if (!Number.isFinite(soldPrice) || soldPrice <= 0) return { ok: false, message: 'Enter a valid sold price.' };
  if (player && soldPrice < player.basePrice) {
    return { ok: false, message: `Sold price cannot be below base price (₹${player.basePrice.toLocaleString()}).` };
  }

  const slotsLeft = state.global.squadSize - team.players.length;
  if (slotsLeft <= 0) return { ok: false, message: `${team.name} has no open squad slots.` };
  if (team.walletRemaining < soldPrice) return { ok: false, message: `${team.name} does not have enough balance.` };

  const balanceAfter = team.walletRemaining - soldPrice;
  const requiredReserve = (slotsLeft - 1) * state.global.minBasePrice;
  if (balanceAfter < requiredReserve) {
    return {
      ok: false,
      message: `Max bid rule failed. ${team.name} must keep ₹${requiredReserve.toLocaleString()} for remaining slots.`,
    };
  }

  return { ok: true, message: `${team.name} can bid up to ₹${maxAllowableBid(team).toLocaleString()}.` };
}

function maxAllowableBid(team) {
  const slotsLeft = state.global.squadSize - team.players.length;
  if (slotsLeft <= 0) return 0;
  const reserve = (slotsLeft - 1) * state.global.minBasePrice;
  return Math.max(team.walletRemaining - reserve, 0);
}

function render() {
  renderGlobalBadge();
  renderTeamPills();
  renderWinningTeamOptions();
  renderActivePlayer();
  renderValidation();
  renderPlayerPool();
  renderLeaderboard();
  renderUnsoldPlayers();
}

function renderGlobalBadge() {
  el.globalBadge.textContent = `Wallet ₹${state.global.wallet.toLocaleString()} • Squad ${state.global.squadSize} • Min Base ₹${state.global.minBasePrice}`;
}

function renderTeamPills() {
  el.teamsPillList.innerHTML = state.teams
    .map((team) => `<span class="team-pill" style="background:${team.color}"><strong>${team.logo}</strong>&nbsp;${team.name}</span>`)
    .join('');
}

function renderWinningTeamOptions() {
  const prev = el.winningTeamSelect.value;
  el.winningTeamSelect.innerHTML = `<option value="">Select team</option>${state.teams
    .map((team) => `<option value="${team.id}">${team.name}</option>`)
    .join('')}`;
  if ([...el.winningTeamSelect.options].some((opt) => opt.value === prev)) {
    el.winningTeamSelect.value = prev;
  }
}

function renderActivePlayer() {
  const player = currentPlayer();
  if (!player) {
    el.activePlayerCard.innerHTML = '<h2>No players left for live auction.</h2><p class="muted">Re-auction passed players from the Unsold tab.</p>';
    return;
  }

  el.activePlayerCard.innerHTML = `
    <h2>Active Player</h2>
    <div class="player-hero">
      <img src="${player.imageUrl}" alt="${player.name}" />
      <div class="player-details">
        <h2>${player.name}</h2>
        <div>
          <span class="badge">${player.role}</span>
          <span class="badge">Base ₹${player.basePrice.toLocaleString()}</span>
        </div>
        <p class="stat">Status: <strong class="status-${player.status}">${player.status.toUpperCase()}</strong></p>
        <p class="muted">Use the controls to mark as sold or passed. Team validation is enforced before sale.</p>
      </div>
    </div>
  `;

  if (!el.soldPriceInput.value) {
    el.soldPriceInput.value = String(player.basePrice);
  }
}

function renderValidation() {
  const teamId = el.winningTeamSelect.value;
  const soldPrice = Number(el.soldPriceInput.value);
  if (!teamId || !soldPrice) {
    el.validationPanel.className = 'validation-panel';
    el.validationPanel.textContent = 'Select a team and sale price to run validation checks.';
    return;
  }

  const verdict = validateBid(teamId, soldPrice);
  el.validationPanel.className = `validation-panel ${verdict.ok ? 'ok' : 'error'}`;
  el.validationPanel.textContent = verdict.message;
}

function renderPlayerPool() {
  const sold = state.players.filter((x) => x.status === 'sold').length;
  const passed = state.players.filter((x) => x.status === 'passed').length;
  const unsold = state.players.filter((x) => x.status === 'unsold').length;

  el.playerPoolStats.textContent = `Total: ${state.players.length} • Sold: ${sold} • Open: ${unsold} • Passed: ${passed}`;

  el.playerPoolList.innerHTML = state.players
    .map((player) => {
      const soldTeam = state.teams.find((team) => team.id === player.soldToTeamId);
      const statusText =
        player.status === 'sold'
          ? `SOLD to ${soldTeam?.name ?? ''} for ₹${player.soldPrice?.toLocaleString()}`
          : player.status === 'passed'
            ? 'UNSOLD (PASSED)'
            : 'AVAILABLE';
      return `
        <article class="player-item">
          <h4>${player.name}</h4>
          <div class="muted">${player.role} • Base ₹${player.basePrice.toLocaleString()}</div>
          <div class="status-${player.status}">${statusText}</div>
        </article>
      `;
    })
    .join('');
}

function renderLeaderboard() {
  el.teamsLeaderboard.innerHTML = state.teams
    .map((team) => {
      const maxBid = maxAllowableBid(team);
      const roleCount = roles
        .map((role) => `${role}: ${team.players.filter((player) => player.role === role).length}`)
        .join(' • ');
      const roster =
        team.players.length > 0
          ? team.players
              .map((player) => `<li>${player.name} (${player.role}) - ₹${player.soldPrice.toLocaleString()}</li>`)
              .join('')
          : '<li class="muted">No players bought yet.</li>';

      return `
      <article class="card team-card">
        <header>
          <h3><span class="team-color-dot" style="background:${team.color}"></span>${team.logo} · ${team.name}</h3>
          <strong>${team.players.length}/${state.global.squadSize}</strong>
        </header>
        <p>Funds Remaining: <strong>₹${team.walletRemaining.toLocaleString()}</strong></p>
        <p>Max Allowable Bid: <strong>₹${maxBid.toLocaleString()}</strong></p>
        <p class="muted">${roleCount}</p>
        <details>
          <summary>Squad List</summary>
          <ul>${roster}</ul>
        </details>
      </article>`;
    })
    .join('');
}

function renderUnsoldPlayers() {
  const passedPlayers = state.players.filter((player) => player.status === 'passed');
  if (!passedPlayers.length) {
    el.unsoldList.innerHTML = '<p class="muted">No passed players yet.</p>';
    return;
  }

  el.unsoldList.innerHTML = passedPlayers
    .map(
      (player) => `
      <div class="unsold-row">
        <span>${player.name} • ${player.role} • Base ₹${player.basePrice.toLocaleString()}</span>
        <button data-player-id="${player.id}" class="ghost">Re-Auction</button>
      </div>`,
    )
    .join('');

  el.unsoldList.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const player = state.players.find((p) => p.id === Number(btn.dataset.playerId));
      if (!player) return;
      player.status = 'unsold';
      state.activePlayerIndex = state.players.findIndex((p) => p.id === player.id);
      toast(`${player.name} added back to auction queue.`);
      render();
    });
  });
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.toast.classList.remove('show'), 2000);
}

function launchConfetti(color) {
  const count = 40;
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = i % 3 === 0 ? color : i % 2 ? '#7dd3fc' : '#f9a8d4';
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.append(piece);
    setTimeout(() => piece.remove(), 2200);
  }
}
