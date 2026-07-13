const urlParams = new URLSearchParams(window.location.search);
const restaurantId = parseInt(urlParams.get('restaurantId')) || 1; 

const apiBaseUrl = "http://127.0.0.1:8000/api";
let masterMenuArray = [];
let localManualCart = [];

document.addEventListener("DOMContentLoaded", () => {
    refreshManagementDashboard();
});

function refreshManagementDashboard() {
    loadMasterMenu();
    loadAllHistoricalOrders();
}

function loadMasterMenu() {
    fetch(`${apiBaseUrl}/menu/${restaurantId}`)
        .then(response => {
            if (!response.ok) throw new Error("Could not fetch menu.");
            return response.json();
        })
        .then(menuData => {
            masterMenuArray = menuData;
            renderMenuControlList();
            populateManualOrderDropdown();
        })
        .catch(error => {
            console.error("Menu fetch failed:", error);
            document.getElementById("managementMenuContainer").innerText = "Error loading menu fields.";
        });
}

function renderMenuControlList() {
    const container = document.getElementById("managementMenuContainer");
    container.innerHTML = "";

    masterMenuArray.forEach(item => {
        const row = document.createElement("div");
        row.className = "databaseRow";
        row.innerHTML = `
            <div>
                <strong>${item.itemName}</strong> <small>(ID: ${item.itemId})</small>
                <div style="font-size: 0.85rem; color:#7f8c8d;">${item.itemDesc || 'No desc'}</div>
            </div>
            <button class="actionButton buttonRed" onclick="completelyPurgeItem(${item.itemId})">Delete Item</button>
        `;
        container.appendChild(row);
    });
}

function submitNewItemToMenu() {
    const nameInput = document.getElementById("newItemName");
    const descInput = document.getElementById("newItemDesc");

    if (!nameInput.value.trim()) {
        alert("Please specify an item name.");
        return;
    }

    const payload = {
        restaurantId: restaurantId,
        itemName: nameInput.value,
        itemDesc: descInput.value,
        imageUrl: "",
        inStock: true
    };

    fetch(`${apiBaseUrl}/item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(() => {
        nameInput.value = "";
        descInput.value = "";
        loadMasterMenu();
    })
    .catch(error => console.error("Error creating item:", error));
}
window.submitNewItemToMenu = submitNewItemToMenu;

function completelyPurgeItem(itemId) {
    if (!confirm("Are you entirely sure you want to delete this item from the database?")) return;

    fetch(`${apiBaseUrl}/item/${itemId}`, { method: "DELETE" })
        .then(response => response.json())
        .then(() => loadMasterMenu())
        .catch(error => console.error("Error deleting item:", error));
}
window.completelyPurgeItem = completelyPurgeItem;

function populateManualOrderDropdown() {
    const selector = document.getElementById("manualItemSelector");
    selector.innerHTML = "";
    
    masterMenuArray.forEach(item => {
        const option = document.createElement("option");
        option.value = item.itemId;
        option.innerText = item.itemName;
        selector.appendChild(option);
    });
}

function addSelectedToManualCart() {
    const selector = document.getElementById("manualItemSelector");
    const quantityInput = document.getElementById("manualItemQuantity");
    const notesInput = document.getElementById("manualItemNotes");

    if (!selector.value) return;

    const itemId = parseInt(selector.value);
    const matchedItem = masterMenuArray.find(item => item.itemId === itemId);

    localManualCart.push({
        itemId: itemId,
        itemName: matchedItem.itemName,
        quantity: parseInt(quantityInput.value) || 1,
        specialNotes: notesInput.value
    });

    notesInput.value = "";
    updateManualCartUI();
}
window.addSelectedToManualCart = addSelectedToManualCart;

function updateManualCartUI() {
    const preview = document.getElementById("manualCartPreview");
    if (localManualCart.length === 0) {
        preview.innerHTML = "Cart empty.";
        return;
    }

    let html = "";
    localManualCart.forEach((item, index) => {
        html += `<div>${item.quantity}x ${item.itemName} ${item.specialNotes ? `(${item.specialNotes})` : ''}</div>`;
    });
    preview.innerHTML = html;
}

function submitManualCartAsOrder() {
    const tableInput = document.getElementById("manualTableNum");
    const tableNum = parseInt(tableInput.value);

    if (!tableNum || localManualCart.length === 0) {
        alert("Please define a table number and add items to the cart.");
        return;
    }

    const payload = {
        restaurantId: restaurantId,
        tableNum: tableNum,
        orderedItems: localManualCart.map(item => ({
            itemId: item.itemId,
            quantity: item.quantity,
            specialNotes: item.specialNotes
        }))
    };

    fetch(`${apiBaseUrl}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(() => {
        localManualCart = [];
        tableInput.value = "";
        updateManualCartUI();
        loadAllHistoricalOrders();
    })
    .catch(error => console.error("Error submitting manual order:", error));
}
window.submitManualCartAsOrder = submitManualCartAsOrder;

function loadAllHistoricalOrders() {
    fetch(`${apiBaseUrl}/orders/all/${restaurantId}`)
        .then(response => response.json())
        .then(allOrders => {
            renderAllOrdersList(allOrders);
        })
        .catch(error => console.error("Error tracking order lists:", error));
}

function renderAllOrdersList(allOrders) {
    const container = document.getElementById("managementOrdersContainer");
    container.innerHTML = "";

    if (allOrders.length === 0) {
        container.innerHTML = "<p>No logs exist.</p>";
        return;
    }

    allOrders.forEach(order => {
        const card = document.createElement("div");
        card.className = "managementOrderCard";

        let linesHtml = "";
        order.items.forEach(item => {
            linesHtml += `<div>• ${item.itemName} x${item.quantity} <i>${item.specialNotes || ''}</i></div>`;
        });

        card.innerHTML = `
            <div class="orderTitleRow">
                <span>Order #${order.orderId} (Table ${order.tableNum})</span>
                <span style="color:#2980b9;">[${order.orderStatus}]</span>
            </div>
            <div style="margin-bottom: 12px;">${linesHtml}</div>
            <button class="actionButton buttonRed" style="padding:4px 8px; font-size:0.8rem;" onclick="cancelAndPurgeOrder(${order.orderId})">
                Void/Delete Order
            </button>
        `;
        container.appendChild(card);
    });
}

setInterval(loadAllHistoricalOrders, 7000);

function cancelAndPurgeOrder(orderId) {
    if (!confirm("Void this transaction row entirely from records?")) return;

    fetch(`${apiBaseUrl}/order/${orderId}`, { method: "DELETE" })
        .then(response => response.json())
        .then(() => loadAllHistoricalOrders())
        .catch(error => console.error("Error purging transaction details:", error));
}
window.cancelAndPurgeOrder = cancelAndPurgeOrder;