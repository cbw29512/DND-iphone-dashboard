// Prototype only: localStorage + BroadcastChannel communicate between tabs
// on ONE browser profile. Cross-device sharing requires a real backend.
const KEY = "dnd-flex-prototype-v1";
const CATALOG = [
  { id: "gallery", title: "Monster & NPC Gallery", description: "Portraits, scenes, and animated art." },
  { id: "initiative", title: "Initiative Tracker", description: "Player-safe initiative preview." },
  { id: "map", title: "Battle Map", description: "Map card placeholder." },
  { id: "dice", title: "Dice Roller", description: "Dice display placeholder." },
  { id: "notes", title: "Scene Text", description: "Scene display placeholder." },
  { id: "timer", title: "Encounter Timer", description: "Timer display placeholder." }
];
const DEFAULT = { active: null, index: 0, images: [], revision: 0 };
const channel = "BroadcastChannel" in window ? new BroadcastChannel(KEY) : null;
const dm = document.body.dataset.view === "dm";
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : DEFAULT;
    if (!Array.isArray(parsed.images) || !Number.isInteger(parsed.index)) throw new Error("Invalid saved state");
    return parsed;
  } catch (error) {
    console.error("Unable to load Flex Card prototype state", error);
    return structuredClone(DEFAULT);
  }
}
function save() {
  try {
    state.revision += 1;
    localStorage.setItem(KEY, JSON.stringify(state));
    channel?.postMessage({ revision: state.revision });
    render();
  } catch (error) {
    console.error("Unable to save prototype state", error);
    report("Unable to save. Try smaller images or clear site storage.");
  }
}
function report(message) {
  const el = document.getElementById("status");
  if (el) el.textContent = message;
}
function previewFor(cardId) {
  // Player rendering uses an allowlisted card kind, never arbitrary private card data.
  const card = CATALOG.find(item => item.id === cardId);
  if (!card) return null;
  if (cardId === "gallery") {
    const image = state.images[state.index];
    return image ? { type: "image", src: image.data, alt: image.name } : { type: "text", title: "Gallery", detail: "No images uploaded" };
  }
  return { type: "text", title: card.title, detail: "This card is coming in a future milestone" };
}
function renderPlayer() {
  const root = document.getElementById("player-screen");
  if (!root) return;
  root.replaceChildren();
  const view = previewFor(state.active);
  if (!view) {
    const message = document.createElement("p");
    message.className = "empty";
    message.textContent = "Waiting for the DM to share a card";
    root.append(message);
  } else if (view.type === "image") {
    const image = document.createElement("img");
    image.src = view.src;
    image.alt = view.alt;
    root.append(image);
  } else {
    const wrap = document.createElement("section");
    wrap.className = "player-card";
    const title = document.createElement("h1");
    const detail = document.createElement("p");
    title.textContent = view.title;
    detail.textContent = view.detail;
    wrap.append(title, detail);
    root.append(wrap);
  }
}
function renderDM() {
  const cards = document.getElementById("cards");
  if (!cards) return;
  cards.replaceChildren();
  for (const item of CATALOG) {
    const element = document.createElement("article");
    element.className = "card";
    const heading = document.createElement("h3");
    const description = document.createElement("p");
    const share = document.createElement("button");
    heading.textContent = item.title;
    description.textContent = item.description;
    share.textContent = state.active === item.id ? "On Screen ✓" : "Share to Screen";
    share.onclick = () => { state.active = item.id; save(); };
    element.append(heading, description, share);
    cards.append(element);
  }
  const gallery = document.getElementById("gallery");
  gallery.replaceChildren();
  state.images.forEach((item, index) => {
    const button = document.createElement("button");
    const image = document.createElement("img");
    button.className = "thumb";
    button.setAttribute("aria-current", String(index === state.index));
    button.setAttribute("aria-label", "Select " + item.name);
    image.src = item.data;
    image.alt = "";
    button.append(image);
    button.onclick = () => { state.index = index; save(); };
    gallery.append(button);
  });
}
function render() { dm ? renderDM() : renderPlayer(); }
async function addFiles(files) {
  for (const file of files) {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      report("Unsupported file: " + file.name);
      continue;
    }
    if (file.size > 1024 * 1024) { report("Prototype limit: 1 MB per image"); continue; }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      state.images.push({ name: file.name, data });
      save();
      report(state.images.length + " image(s) loaded. Same-browser preview only.");
    } catch (error) { console.error("Image import failed", error); report("Could not load " + file.name); }
  }
}
if (dm) {
  document.getElementById("media").addEventListener("change", event => addFiles([...event.target.files]));
  document.getElementById("previous").onclick = () => { state.index = Math.max(0, state.index - 1); save(); };
  document.getElementById("next").onclick = () => { state.index = Math.min(state.images.length - 1, state.index + 1); save(); };
  document.getElementById("clear").onclick = () => { state.active = null; save(); };
}
channel?.addEventListener("message", () => { state = load(); render(); });
window.addEventListener("storage", event => { if (event.key === KEY) { state = load(); render(); } });
render();