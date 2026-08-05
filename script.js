const categories = [
    {
        number: 1,
        label: "Vullers & Voordelige bloeiers",
        price: 0.50,
        color: "cat1",
        names: ["Aster", "Calendula", "Cosmos", "Korenbloem", "Zinnia Klein", "Zonnehoed"]
    },
    {
        number: 2,
        label: "Basis & Stevige snijbloemen",
        price: 1.00,
        color: "cat2",
        names: ["Dahlia Klein", "Leeuwenbekje", "Statice", "Strobloem", "Zinnia Groot"]
    },
    {
        number: 3,
        label: "Luxe Blikvangers",
        price: 1.50,
        color: "cat3",
        names: ["Dahlia Middelgroot", "Zonnebloem Klein"]
    },
    {
        number: 4,
        label: "Showstoppers & Premium",
        price: 2.00,
        color: "cat4",
        names: ["Amarant", "Dahlia Groot", "Zonnebloem Groot"]
    }
];

// cart: Map of flower name → { name, price, count }
const cart = new Map();

function createButtons() {
    const touchDiv = document.getElementById("touch");

    categories.forEach(cat => {
        const section = document.createElement("div");
        section.className = "category-section";

        const header = document.createElement("div");
        header.className = `category-header ${cat.color}`;
        header.innerHTML = `
            <div class="cat-title">
                <span class="cat-number">Cat. ${cat.number}</span>
                <span class="cat-label">${cat.label}</span>
            </div>
            <span class="cat-price">€${cat.price.toFixed(2)}</span>
        `;
        section.appendChild(header);

        const group = document.createElement("div");
        group.className = "button-group";

        cat.names.forEach(name => {
            const btn = document.createElement("div");
            btn.className = `panelButton ${cat.color}`;
            btn.dataset.name = name;

            const nameSpan = document.createElement("span");
            nameSpan.className = "flower-name";
            nameSpan.textContent = name;

            const badge = document.createElement("span");
            badge.className = "flower-badge";

            btn.append(nameSpan, badge);
            btn.addEventListener("click", () => addToCart(name, cat.price));
            group.appendChild(btn);
        });

        section.appendChild(group);
        touchDiv.appendChild(section);
    });
}

function addToCart(name, price) {
    if (cart.has(name)) {
        cart.get(name).count++;
    } else {
        cart.set(name, { name, price, count: 1 });
    }
    render();
}

function removeFromCart(name) {
    if (!cart.has(name)) return;
    const entry = cart.get(name);
    if (entry.count > 1) {
        entry.count--;
    } else {
        cart.delete(name);
    }
    render();
}

function render() {
    const list = document.getElementById("item-list");
    list.innerHTML = "";

    let total = 0;
    let itemCount = 0;

    if (cart.size === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "Nog niets toegevoegd";
        list.appendChild(empty);
    } else {
        const sorted = [...cart.entries()].sort(([a], [b]) => a.localeCompare(b));
        sorted.forEach(([name, { price, count }]) => {
            const subtotal = price * count;
            total += subtotal;
            itemCount += count;

            const li = document.createElement("li");
            li.className = "item-row";

            const nameSpan = document.createElement("span");
            nameSpan.className = "item-name";
            nameSpan.textContent = name;

            const qtySpan = document.createElement("span");
            qtySpan.className = "item-qty";
            qtySpan.textContent = `×${count}`;

            const priceSpan = document.createElement("span");
            priceSpan.className = "item-subtotal";
            priceSpan.textContent = `€${subtotal.toFixed(2)}`;

            const removeBtn = document.createElement("button");
            removeBtn.className = "btn-remove";
            removeBtn.textContent = "−";
            removeBtn.addEventListener("click", () => removeFromCart(name));

            li.append(nameSpan, qtySpan, priceSpan, removeBtn);
            list.appendChild(li);
        });
    }

    // Update all total displays
    document.querySelectorAll(".total-value").forEach(el => {
        el.textContent = `€${total.toFixed(2)}`;
    });

    // Update item count badge in bottom bar
    const badge = document.getElementById("receipt-item-count");
    badge.textContent = itemCount > 0 ? itemCount : "";
    badge.style.display = itemCount > 0 ? "flex" : "none";

    // Update flower button badges and in-cart state
    document.querySelectorAll(".panelButton").forEach(btn => {
        const entry = cart.get(btn.dataset.name);
        const flowerBadge = btn.querySelector(".flower-badge");
        flowerBadge.textContent = entry ? entry.count : "";
        btn.classList.toggle("in-cart", !!entry);
    });
}

function resetAmount() {
    cart.clear();
    closeReceipt();
    render();
}

function openReceipt() {
    document.getElementById("receipt-overlay").classList.add("open");
}

function closeReceipt() {
    document.getElementById("receipt-overlay").classList.remove("open");
}

// Wire up UI
createButtons();
render();

document.getElementById("receipt-toggle").addEventListener("click", openReceipt);
document.getElementById("close-receipt").addEventListener("click", closeReceipt);
document.getElementById("receipt-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeReceipt();
});
