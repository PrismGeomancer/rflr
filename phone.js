// The walkthrough is independent of the wallet/app module, including file previews.
(() => {
  const screen = document.querySelector("#phone-screen");
  const steps = [...document.querySelectorAll("[data-step]")];
  const playback = document.querySelector("#phone-playback");
  const progress = document.querySelector("#phone-progress");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let index = 0,
    paused = true,
    visible = false,
    timer;
  let data = {
    title: "The community pot",
    prize: "5 SOL",
    price: "0.05",
    capacity: "250",
    entries: "184",
    cost: "0.25",
    odds: "2.65%",
    id: "",
    completedId: "",
    winner: "CwG8…6mWb",
    winningEntry: 13,
    completedEntries: 80,
    completedPrize: "5 SOL",
    wallet: "Connect a Solana wallet",
  };
  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function render() {
    const d = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, esc(v)]),
    );
    const live = [data.id, data.id, data.id, data.completedId];
    const actions = [
      "create",
      live[1] ? "share" : "create",
      live[2] ? "detail" : "browse",
      live[3] ? "receipt" : "about",
    ];
    const labels = [
      "Create your pool",
      live[1] ? "Share raffle" : "Start a pool",
      live[2] ? "View entries & odds" : "Explore raffles",
      live[3] ? "Inspect draw receipt" : "How draws work",
    ];
    const screens = [
      `<div class="phone-screen-title">Your pool.<br>Your rules.</div><div class="phone-label">RAFFLE NAME</div><div class="phone-field">${d.title}</div><div class="phone-label">PRIZE</div><div class="phone-field">${d.prize}</div><div class="phone-label">ENTRY PRICE</div><div class="phone-field">${d.price} SOL</div><div class="phone-label">MAXIMUM ENTRIES</div><div class="phone-field">${d.capacity} spots</div>`,
      `<div class="phone-screen-title">A pool worth<br>passing around.</div><div class="phone-share">${d.title.toUpperCase()}<br>IS OPEN.</div><div class="phone-url">raffler / ${d.id}</div><p class="phone-caption">One link for the whole community.</p><div class="phone-stat"><span>SOL prize</span><b>${d.prize}</b></div><div class="phone-stat"><span>Entry</span><b>${d.price} SOL</b></div>`,
      `<div class="phone-wallet">${d.wallet}</div><div class="phone-prize">${d.prize}<small>${d.title.toUpperCase()}</small></div><div class="phone-stat"><span>New entries</span><b>5</b></div><div class="phone-stat"><span>Total cost</span><b>${d.cost} SOL</b></div><div class="phone-stat"><span>Current pool</span><b>${d.entries} entries</b></div><div class="phone-stat"><span>Estimated odds</span><b>${d.odds}</b></div>`,
      `<div class="phone-screen-title">One winner.<br>One receipt.</div><div class="phone-prize">${d.completedPrize}<small>WINNER · ${d.winner}</small></div><div class="phone-receipt">RAFFLE ${d.completedId}<br>WINNING ENTRY #${d.winningEntry}<br>TOTAL ENTRIES ${d.completedEntries}<br>DRAW RECORD</div>`,
    ];
    screen.innerHTML = `<div class="phone-brand"><img class="phone-logo" src="./assets/logo.png" width="156" height="52" alt="RAFFLER"></div>${screens[index]}<button type="button" class="phone-cta" data-action="${actions[index]}" data-id="${index === 3 ? d.completedId || "" : d.id || ""}">${labels[index]}</button>`;
    screen.dataset.screen = String(index);
    steps.forEach((b, i) => {
      b.classList.toggle("selected", i === index);
      b.setAttribute("aria-pressed", String(i === index));
    });
    progress.textContent = `${index + 1} / 4`;
    playback.textContent = paused ? "Play tour" : "Pause tour";
    playback.setAttribute("aria-pressed", String(paused));
  }
  function schedule() {
    clearInterval(timer);
    if (!paused && visible && !document.hidden)
      timer = setInterval(() => {
        if (document.activeElement?.closest("#phone-screen")) return;
        index = (index + 1) % 4;
        render();
      }, 4000);
  }
  function select(n) {
    index = n;
    paused = true;
    render();
    schedule();
  }
  steps.forEach((b, i) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      select(i);
    }),
  );
  playback.addEventListener("click", () => {
    paused = !paused;
    if (!paused) {
      index = (index + 1) % 4;
      screen.scrollIntoView({
        block: "center",
        behavior: reduceMotion.matches ? "instant" : "smooth",
      });
    }
    render();
    schedule();
  });
  document
    .querySelector("#phone-next")
    .addEventListener("click", () => select((index + 1) % 4));
  screen.addEventListener("click", (e) => {
    if (e.target.closest("button")) {
      paused = true;
      render();
      schedule();
    }
  });
  document.addEventListener("visibilitychange", schedule);
  reduceMotion.addEventListener("change", (e) => {
    if (e.matches) {
      paused = true;
      render();
      schedule();
    }
  });
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    },
    { threshold: 0.05 },
  ).observe(screen);
  window.addEventListener("raffler:phone-data", (e) => {
    data = { ...data, ...e.detail };
    render();
  });
  render();
})();
