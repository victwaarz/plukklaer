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
    },
    {
        number: 5,
        label: "Overige",
        color: "cat5",
        priceLabel: "Variërend",
        items: [{ name: "Appelsap", price: 8.00 }]
    }
];

const ORDER_HISTORY_STORAGE_KEY = "plukklaer-order-history";

// cart: Map of flower name → { name, price, count }
const cart = new Map();
let currentCheckoutSnapshot = null;
let currentHistoryDayKey = getDayKey(new Date());

function formatCurrency(amount) {
    return `€${Number(amount).toFixed(2)}`;
}

function formatFlowerCount(count) {
    return `${count} ${count === 1 ? "bloem" : "bloemen"}`;
}

function getDayKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDayLabel(dayKey) {
    const [year, month, day] = dayKey.split("-").map(Number);
    const label = new Date(year, month - 1, day).toLocaleDateString("nl-BE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatOrderTime(isoString) {
    return new Date(isoString).toLocaleTimeString("nl-BE", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatEmailDate(dayKey) {
    const [year, month, day] = dayKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("nl-BE", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function buildCartSnapshot() {
    const items = [...cart.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name, price, count }) => ({
            name,
            price,
            count,
            subtotal: Number((price * count).toFixed(2))
        }));

    const total = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    const itemCount = items.reduce((sum, item) => sum + item.count, 0);

    return { items, total, itemCount };
}

function readOrderHistory() {
    const rawValue = localStorage.getItem(ORDER_HISTORY_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : {};
}

function writeOrderHistory(history) {
    localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function getHistoryDayKeys(history, includeToday = false) {
    const dayKeys = Object.keys(history);

    if (includeToday) {
        dayKeys.push(getDayKey(new Date()));
    }

    return [...new Set(dayKeys)].sort();
}

function getHistoryDayBucket(history, dayKey) {
    const storedBucket = history[dayKey];
    const orders = Array.isArray(storedBucket?.orders)
        ? [...storedBucket.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [];

    return {
        date: dayKey,
        orderCount: orders.length,
        totalRevenue: Number(orders.reduce((sum, order) => sum + Number(order.total), 0).toFixed(2)),
        totalItems: orders.reduce((sum, order) => sum + Number(order.itemCount), 0),
        orders
    };
}

function refreshHistoryOverviewIfOpen(preferredDayKey = currentHistoryDayKey) {
    if (!document.getElementById("history-overlay").classList.contains("open")) return;
    renderHistoryOverview(preferredDayKey);
}

function buildHistoryEmail(dayKey = currentHistoryDayKey) {
    const history = readOrderHistory();
    const dayBucket = getHistoryDayBucket(history, dayKey);
    const formattedDate = formatEmailDate(dayKey);
    const subject = `Dagoverzicht ${formattedDate}`;
    const lines = [
        `Dagoverzicht voor ${formattedDate}`,
        "",
        `Bestellingen: ${dayBucket.orderCount}`,
        `Bloemen: ${dayBucket.totalItems}`,
        `Omzet: ${formatCurrency(dayBucket.totalRevenue)}`,
        ""
    ];

    if (dayBucket.orders.length === 0) {
        lines.push("Er zijn geen bestellingen opgeslagen voor deze dag.");
    } else {
        dayBucket.orders.forEach((order, index) => {
            lines.push(
                `Bestelling ${dayBucket.orderCount - index} - ${formatOrderTime(order.createdAt)} - ${formatCurrency(order.total)}`
            );

            (order.items ?? []).forEach(item => {
                lines.push(`- ${item.name} x${item.count}`);
            });

            lines.push("");
        });
    }

    return {
        subject,
        body: lines.join("\n").trim()
    };
}

function storeCompletedOrder(snapshot) {
    const now = new Date();
    const dayKey = getDayKey(now);
    const history = readOrderHistory();
    const dayBucket = history[dayKey] ?? {
        date: dayKey,
        orderCount: 0,
        totalRevenue: 0,
        totalItems: 0,
        orders: []
    };

    const order = {
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `order-${now.getTime()}`,
        createdAt: now.toISOString(),
        total: snapshot.total,
        itemCount: snapshot.itemCount,
        items: snapshot.items
    };

    dayBucket.orders.push(order);
    dayBucket.orderCount += 1;
    dayBucket.totalRevenue = Number((dayBucket.totalRevenue + order.total).toFixed(2));
    dayBucket.totalItems += order.itemCount;

    history[dayKey] = dayBucket;
    writeOrderHistory(history);
    refreshHistoryOverviewIfOpen(dayKey);

    return { dayKey, orderId: order.id };
}

function restoreCart(snapshot) {
    cart.clear();

    snapshot.items.forEach(({ name, price, count }) => {
        cart.set(name, { name, price, count });
    });
}

function clearCheckoutState() {
    currentCheckoutSnapshot = null;
}

function createButtons() {
    const touchDiv = document.getElementById("touch");

    categories.forEach(cat => {
        const section = document.createElement("div");
        section.className = "category-section";

        const header = document.createElement("div");
        header.className = `category-header ${cat.color}`;
        const priceText = Number.isFinite(cat.price)
            ? `€${cat.price.toFixed(2)}`
            : cat.priceLabel ?? "";

        header.innerHTML = `
            <div class="cat-title">
                <span class="cat-number">Cat. ${cat.number}</span>
                <span class="cat-label">${cat.label}</span>
            </div>
            <span class="cat-price">${priceText}</span>
        `;
        section.appendChild(header);

        const group = document.createElement("div");
        group.className = "button-group";

        const items = Array.isArray(cat.items)
            ? cat.items
            : cat.names.map(name => ({ name, price: cat.price }));

        items.forEach(({ name, price }) => {
            const btn = document.createElement("div");
            btn.className = `panelButton ${cat.color}`;
            btn.dataset.name = name;

            const nameSpan = document.createElement("span");
            nameSpan.className = "flower-name";
            nameSpan.textContent = name;

            const badge = document.createElement("span");
            badge.className = "flower-badge";

            btn.append(nameSpan, badge);
            btn.addEventListener("click", () => addToCart(name, price));
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

    const { items, total, itemCount } = buildCartSnapshot();

    if (items.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "Nog niets toegevoegd";
        list.appendChild(empty);
    } else {
        items.forEach(({ name, count, subtotal }) => {
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
            priceSpan.textContent = formatCurrency(subtotal);

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
        el.textContent = formatCurrency(total);
    });

    // Update item count badge in bottom bar
    const badge = document.getElementById("receipt-item-count");
    badge.textContent = itemCount > 0 ? itemCount : "";
    badge.style.display = itemCount > 0 ? "flex" : "none";

    document.getElementById("checkout-button").disabled = items.length === 0;

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

function renderHistoryOverview(selectedDayKey = currentHistoryDayKey) {
    const history = readOrderHistory();
    const availableDayKeys = getHistoryDayKeys(history, true);
    const fallbackDayKey = availableDayKeys[availableDayKeys.length - 1] ?? getDayKey(new Date());

    currentHistoryDayKey = availableDayKeys.includes(selectedDayKey) ? selectedDayKey : fallbackDayKey;

    const currentIndex = availableDayKeys.indexOf(currentHistoryDayKey);
    const dayBucket = getHistoryDayBucket(history, currentHistoryDayKey);
    const orderList = document.getElementById("history-order-list");

    document.getElementById("history-date-label").textContent = formatDayLabel(currentHistoryDayKey);
    document.getElementById("history-order-count").textContent = String(dayBucket.orderCount);
    document.getElementById("history-total-items").textContent = String(dayBucket.totalItems);
    document.getElementById("history-total-revenue").textContent = formatCurrency(dayBucket.totalRevenue);
    document.getElementById("history-prev-day").disabled = currentIndex <= 0;
    document.getElementById("history-next-day").disabled = currentIndex === -1 || currentIndex >= availableDayKeys.length - 1;

    orderList.innerHTML = "";

    if (dayBucket.orders.length === 0) {
        const empty = document.createElement("li");
        empty.className = "history-empty-state";
        empty.textContent = "Nog geen bestellingen opgeslagen op deze dag.";
        orderList.appendChild(empty);
        return;
    }

    dayBucket.orders.forEach((order, index) => {
        const orderCard = document.createElement("li");
        orderCard.className = "history-order-card";

        const orderHead = document.createElement("div");
        orderHead.className = "history-order-head";

        const orderTitleWrap = document.createElement("div");

        const orderTitle = document.createElement("strong");
        orderTitle.className = "history-order-title";
        orderTitle.textContent = `Bestelling ${dayBucket.orderCount - index}`;

        const orderMeta = document.createElement("span");
        orderMeta.className = "history-order-meta";
        orderMeta.textContent = `${formatOrderTime(order.createdAt)} · ${formatFlowerCount(order.itemCount)}`;

        orderTitleWrap.append(orderTitle, orderMeta);

        const orderTotal = document.createElement("span");
        orderTotal.className = "history-order-total";
        orderTotal.textContent = formatCurrency(order.total);

        orderHead.append(orderTitleWrap, orderTotal);

        const itemList = document.createElement("ul");
        itemList.className = "history-order-items";

        (order.items ?? []).forEach(item => {
            const itemRow = document.createElement("li");
            itemRow.className = "history-order-item";

            const itemName = document.createElement("span");
            itemName.className = "history-order-item-name";
            itemName.textContent = item.name;

            const itemCount = document.createElement("span");
            itemCount.className = "history-order-item-count";
            itemCount.textContent = `×${item.count}`;

            itemRow.append(itemName, itemCount);
            itemList.appendChild(itemRow);
        });

        orderCard.append(orderHead, itemList);
        orderList.appendChild(orderCard);
    });
}

function openHistoryOverlay() {
    currentHistoryDayKey = getDayKey(new Date());
    closeReceipt();
    renderHistoryOverview();
    document.getElementById("history-overlay").classList.add("open");
}

function closeHistoryOverlay() {
    document.getElementById("history-overlay").classList.remove("open");
}

function navigateHistoryDay(step) {
    const history = readOrderHistory();
    const availableDayKeys = getHistoryDayKeys(history, true);
    const currentIndex = availableDayKeys.indexOf(currentHistoryDayKey);
    const nextDayKey = availableDayKeys[currentIndex + step];

    if (!nextDayKey) return;

    currentHistoryDayKey = nextDayKey;
    renderHistoryOverview();
}

function emailHistoryOverview() {
    const { subject, body } = buildHistoryEmail();
    const mailtoUrl = `mailto:info@plukklaer.be?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
}

function openCheckoutOverlay(total) {
    document.getElementById("checkout-amount").textContent = formatCurrency(total);
    document.getElementById("checkout-overlay").classList.add("open");
}

function closeCheckoutOverlay(resetState = true) {
    document.getElementById("checkout-overlay").classList.remove("open");

    if (resetState) {
        clearCheckoutState();
    }
}

function editCheckoutOrder() {
    if (!currentCheckoutSnapshot) return;

    restoreCart(currentCheckoutSnapshot);
    closeCheckoutOverlay();
    openReceipt();
    render();
}

function checkout() {
    const snapshot = buildCartSnapshot();
    if (snapshot.items.length === 0) return;

    currentCheckoutSnapshot = snapshot;
    openCheckoutOverlay(snapshot.total);
    closeReceipt();
    render();
}

function completeCheckoutOrder() {
    if (!currentCheckoutSnapshot) return;

    storeCompletedOrder(currentCheckoutSnapshot);
    cart.clear();
    closeCheckoutOverlay();
    closeReceipt();
    render();
}

// Wire up UI
createButtons();
render();

document.getElementById("receipt-toggle").addEventListener("click", openReceipt);
document.getElementById("close-receipt").addEventListener("click", closeReceipt);
document.getElementById("checkout-button").addEventListener("click", checkout);
document.getElementById("edit-checkout").addEventListener("click", editCheckoutOrder);
document.getElementById("close-checkout").addEventListener("click", completeCheckoutOrder);
document.getElementById("history-toggle").addEventListener("click", openHistoryOverlay);
document.getElementById("close-history").addEventListener("click", closeHistoryOverlay);
document.getElementById("history-email-button").addEventListener("click", emailHistoryOverview);
document.getElementById("history-prev-day").addEventListener("click", () => navigateHistoryDay(-1));
document.getElementById("history-next-day").addEventListener("click", () => navigateHistoryDay(1));
document.getElementById("receipt-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeReceipt();
});
document.getElementById("checkout-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeCheckoutOverlay();
});
