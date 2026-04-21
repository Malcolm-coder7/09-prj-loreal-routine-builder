// DOM elements
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const searchBar = document.getElementById("searchBar");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectionsBtn = document.getElementById("clearSelections");
const rtlToggle = document.getElementById("rtlToggle");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

// State
let allProducts = [];
let filteredProducts = [];
let selectedProducts = [];
let chatHistory = [];

// --- LocalStorage helpers ---
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}
function loadSelectedProducts() {
  const data = localStorage.getItem("selectedProducts");
  selectedProducts = data ? JSON.parse(data) : [];
}
function saveChatHistory() {
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
}
function loadChatHistory() {
  const data = localStorage.getItem("chatHistory");
  chatHistory = data ? JSON.parse(data) : [];
}

// --- RTL Support ---
rtlToggle.addEventListener("change", function () {
  document.body.dir = rtlToggle.checked ? "rtl" : "ltr";
  document.body.classList.toggle("rtl-mode", rtlToggle.checked);
});

// --- Load products ---
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  applyFilters();
}

// --- Filtering ---
function applyFilters() {
  const search = searchBar.value.trim().toLowerCase();
  const cat = categoryFilter.value;
  filteredProducts = allProducts.filter((p) => {
    const matchesCat = !cat || p.category === cat;
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search) ||
      p.brand.toLowerCase().includes(search) ||
      (p.description && p.description.toLowerCase().includes(search));
    return matchesCat && matchesSearch;
  });
  renderProducts();
}

searchBar.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", applyFilters);

// --- Render products ---
function renderProducts() {
  if (!filteredProducts.length) {
    productsContainer.innerHTML = `<div class="placeholder-message">No products found.</div>`;
    return;
  }
  productsContainer.innerHTML = filteredProducts
    .map((product) => {
      const selected = selectedProducts.some((p) => p.id === product.id);
      return `
      <div class="product-card${selected ? " selected" : ""}" data-id="${product.id}">
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
          <button class="desc-toggle" data-id="${product.id}">Details</button>
          <div class="product-desc" style="display:none;">${product.description}</div>
        </div>
      </div>
      `;
    })
    .join("");
}

// --- Product selection ---
productsContainer.addEventListener("click", function (e) {
  // Toggle description
  if (e.target.classList.contains("desc-toggle")) {
    const card = e.target.closest(".product-card");
    const desc = card.querySelector(".product-desc");
    desc.style.display = desc.style.display === "none" ? "block" : "none";
    e.target.textContent = desc.style.display === "block" ? "Hide" : "Details";
    return;
  }
  // Select/unselect product
  const card = e.target.closest(".product-card");
  if (!card) return;
  const id = Number(card.dataset.id);
  const prod = allProducts.find((p) => p.id === id);
  const idx = selectedProducts.findIndex((p) => p.id === id);
  if (idx === -1) {
    selectedProducts.push(prod);
  } else {
    selectedProducts.splice(idx, 1);
  }
  saveSelectedProducts();
  renderProducts();
  renderSelectedProducts();
});

// --- Selected products UI ---
function renderSelectedProducts() {
  if (!selectedProducts.length) {
    selectedProductsList.innerHTML = `<span style="color:#888">No products selected.</span>`;
    clearSelectionsBtn.style.display = "none";
    return;
  }
  clearSelectionsBtn.style.display = "inline-block";
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (p) => `
      <span class="selected-product-pill">
        ${p.name}
        <button class="remove-product" data-id="${p.id}" title="Remove">&times;</button>
      </span>
    `,
    )
    .join("");
}

selectedProductsList.addEventListener("click", function (e) {
  if (e.target.classList.contains("remove-product")) {
    const id = Number(e.target.dataset.id);
    selectedProducts = selectedProducts.filter((p) => p.id !== id);
    saveSelectedProducts();
    renderProducts();
    renderSelectedProducts();
  }
});

clearSelectionsBtn.addEventListener("click", function () {
  selectedProducts = [];
  saveSelectedProducts();
  renderProducts();
  renderSelectedProducts();
});

// --- Routine Generation & Chat ---
function renderChat() {
  chatWindow.innerHTML = chatHistory
    .map((msg) => {
      if (msg.role === "user") {
        return `<div class="chat-msg user-msg"><b>You:</b> ${msg.content}</div>`;
      } else {
        // Add links/citations if present
        return `<div class="chat-msg assistant-msg"><b>Assistant:</b> ${msg.content}</div>`;
      }
    })
    .join("");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// --- OpenAI API call ---
async function sendToOpenAI(messages) {
  // Compose prompt with selected products
  const systemPrompt = {
    role: "system",
    content:
      "You are a skincare and beauty routine expert. Use the selected products to generate a personalized routine. Include real-world info, links, and cite sources if relevant. Reply in a friendly, clear way.",
  };
  const userProducts = selectedProducts
    .map((p) => `- ${p.name} (${p.brand})`)
    .join("\n");
  const userPrompt = {
    role: "user",
    content: `Selected products:\n${userProducts}\n\n${messages[messages.length - 1].content}`,
  };
  const fullMessages = [systemPrompt, ...messages.slice(1, -1), userPrompt];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer YOUR_OPENAI_API_KEY`, // Replace with your key or use secrets.js
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: fullMessages,
    }),
  });
  const data = await res.json();
  return (
    data.choices?.[0]?.message?.content ||
    "Sorry, I couldn't generate a routine."
  );
}

// --- Generate Routine Button ---
generateRoutineBtn.addEventListener("click", async function () {
  if (!selectedProducts.length) {
    alert("Please select at least one product.");
    return;
  }
  const userMsg = {
    role: "user",
    content: "Generate a routine for my selected products.",
  };
  chatHistory.push(userMsg);
  renderChat();
  saveChatHistory();
  generateRoutineBtn.disabled = true;
  const assistantMsg = { role: "assistant", content: "<em>Thinking...</em>" };
  chatHistory.push(assistantMsg);
  renderChat();
  try {
    const reply = await sendToOpenAI(chatHistory.slice(-2));
    chatHistory[chatHistory.length - 1].content = reply;
    renderChat();
    saveChatHistory();
  } catch (e) {
    chatHistory[chatHistory.length - 1].content = "Sorry, there was an error.";
    renderChat();
  }
  generateRoutineBtn.disabled = false;
});

// --- Chat follow-up ---
chatForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const msg = userInput.value.trim();
  if (!msg) return;
  chatHistory.push({ role: "user", content: msg });
  renderChat();
  saveChatHistory();
  userInput.value = "";
  const assistantMsg = { role: "assistant", content: "<em>Thinking...</em>" };
  chatHistory.push(assistantMsg);
  renderChat();
  try {
    const reply = await sendToOpenAI(chatHistory.slice(-2));
    chatHistory[chatHistory.length - 1].content = reply;
    renderChat();
    saveChatHistory();
  } catch (e) {
    chatHistory[chatHistory.length - 1].content = "Sorry, there was an error.";
    renderChat();
  }
});

// --- On load ---
function init() {
  loadSelectedProducts();
  loadChatHistory();
  renderSelectedProducts();
  renderChat();
  loadProducts();
  // Restore RTL
  if (document.body.dir === "rtl") rtlToggle.checked = true;
}
init();

// --- Style for selected product pill ---
const style = document.createElement("style");
style.textContent = `
.selected-product-pill {
  display: inline-flex;
  align-items: center;
  background: #f0f0f0;
  border-radius: 16px;
  padding: 4px 10px 4px 14px;
  margin: 2px 4px 2px 0;
  font-size: 15px;
}
.selected-product-pill button {
  background: none;
  border: none;
  color: #c00;
  font-size: 18px;
  margin-left: 6px;
  cursor: pointer;
}
.product-card.selected {
  border: 2px solid #007bff;
  background: #eaf4ff;
}
.chat-msg.user-msg {
  text-align: right;
  margin: 8px 0;
}
.chat-msg.assistant-msg {
  text-align: left;
  margin: 8px 0;
}
.rtl-mode .products-grid, .rtl-mode .selected-products, .rtl-mode .chatbox {
  direction: rtl;
}
`;
document.head.appendChild(style);
