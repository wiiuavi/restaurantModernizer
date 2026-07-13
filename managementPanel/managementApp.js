const urlParams = new URLSearchParams(window.location.search);
const restaurantId = parseInt(urlParams.get('restaurantId')) || 1; 
const apiBaseUrl = "http://127.0.0.1:8000/api";
const hardcodedPassword = "admin";

let masterMenuArray = [];
let localManualCart = [];

function verifyManagementPassword() {
    if (document.getElementById("managementPasswordInput").value === hardcodedPassword) {
        document.getElementById("passwordOverlay").classList.add("hiddenView");
        document.getElementById("managementDashboardContent").classList.remove("hiddenView");
        refreshManagementDashboard();
        setInterval(loadAllHistoricalOrders, 7000);
    } else {
        document.getElementById("errorMessage").innerText = "Invalid PIN.";
    }
}
window.verifyManagementPassword = verifyManagementPassword;

function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.classList.toggle("hiddenView");
}
window.toggleSection = toggleSection;

function refreshManagementDashboard() {
    loadMasterMenu();
    loadAllHistoricalOrders();
}

function loadMasterMenu() {
    fetch(`${apiBaseUrl}/menu/${restaurantId}`)
        .then(res => res.json())
        .then(menuData => {
            masterMenuArray = menuData;
            renderMenuControlList();
            populateManualOrderDropdown();
        })
        .catch(err => console.error("Menu fetch failed:", err));
}

function renderMenuControlList() {
    const container = document.getElementById("managementMenuContainer");
    container.innerHTML = "";

    masterMenuArray.forEach(item => {
        const priceStr = item.price ? `$${item.price.toFixed(2)}` : 'No Price (OOS)';
        const row = document.createElement("div");
        row.className = "databaseRow";
        row.innerHTML = `
            <div class="itemDetails">
                <strong>${item.itemName}</strong>
                <span class="itemPriceTag">${priceStr}</span>
                <span style="font-size: 0.85rem; color:#7f8c8d;">${item.itemDesc || 'No desc'}</span>
            </div>
            <div style="display:flex; gap:5px; flex-direction:column;">
                <button class="actionBtn blueBtn" style="padding:5px;" onclick="loadItemIntoEditor(${item.itemId})">Edit</button>
                <button class="actionBtn redBtn" style="padding:5px;" onclick="completelyPurgeItem(${item.itemId})">Delete</button>
            </div>
        `;
        container.appendChild(row);
    });
}

function loadItemIntoEditor(itemId) {
    const item = masterMenuArray.find(i => i.itemId === itemId);
    if (!item) return;

    document.getElementById("editorTitle").innerText = `Editing: ${item.itemName}`;
    document.getElementById("editingItemId").value = item.itemId;
    document.getElementById("itemNameInput").value = item.itemName;
    document.getElementById("itemPriceInput").value = item.price || "";
    document.getElementById("itemDescInput").value = item.itemDesc || "";
    document.getElementById("itemImageInput").value = item.imageUrl || "";

    document.getElementById("saveItemBtn").innerText = "Update Item";
    document.getElementById("cancelEditBtn").classList.remove("hiddenView");
    
    document.getElementById("menuManagementSection").classList.remove("hiddenView");
}
window.loadItemIntoEditor = loadItemIntoEditor;

function resetItemForm() {
    document.getElementById("editorTitle").innerText = "Create New Item";
    document.getElementById("editingItemId").value = "";
    document.getElementById("itemNameInput").value = "";
    document.getElementById("itemPriceInput").value = "";
    document.getElementById("itemDescInput").value = "";
    document.getElementById("itemImageInput").value = "";
    document.getElementById("saveItemBtn").innerText = "Save to Database";
    document.getElementById("cancelEditBtn").classList.add("hiddenView");
}
window.resetItemForm = resetItemForm;

function submitItemForm() {
    const editId = document.getElementById("editingItemId").value;
    const nameInput = document.getElementById("itemNameInput").value;
    const priceInput = parseFloat(document.getElementById("itemPriceInput").value) || null;
    const descInput = document.getElementById("itemDescInput").value;
    const imageInput = document.getElementById("itemImageInput").value;

    if (!nameInput.trim()) return alert("Please specify an item name.");

    const payload = {
        restaurantId: restaurantId,
        itemName: nameInput,
        itemDesc: descInput,
        imageUrl: imageInput,
        price: priceInput,
        inStock: true
    };

    if (editId) {
        fetch(`${apiBaseUrl}/item/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(() => {
            resetItemForm();
            loadMasterMenu();
        });
    } else {
        fetch(`${apiBaseUrl}/item`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(() => {
            resetItemForm();
            loadMasterMenu();
        });
    }
}
window.submitItemForm = submitItemForm;

function completelyPurgeItem(itemId) {
    if (!confirm("Delete this item from the database forever?")) return;
    fetch(`${apiBaseUrl}/item/${itemId}`, { method: "DELETE" })
        .then(() => loadMasterMenu());
}
window.completelyPurgeItem = completelyPurgeItem;

function populateManualOrderDropdown() {
    const selector = document.getElementById("manualItemSelector");
    selector.innerHTML = "";
    
    // Only allow ring up items that have a price
    const availableItems = masterMenuArray.filter(item => item.price && item.price > 0);
    
    availableItems.forEach(item => {
        const option = document.createElement("option");
        option.value = item.itemId;
        option.innerText = `${item.itemName} ($${item.price.toFixed(2)})`;
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
        price: matchedItem.price,
        quantity: parseInt(quantityInput.value) || 1,
        specialNotes: notesInput.value
    });

    notesInput.value = "";
    quantityInput.value = "1";
    updateManualCartUI();
}
window.addSelectedToManualCart = addSelectedToManualCart;

function updateManualCartUI() {
    const preview = document.getElementById("manualCartPreview");
    let total = 0;
    
    if (localManualCart.length === 0) {
        preview.innerHTML = "Cart empty.";
        document.getElementById("manualCartTotal").innerText = "Total: $0.00";
        return;
    }

    let html = "";
    localManualCart.forEach((item, index) => {
        const lineTotal = item.price * item.quantity;
        total += lineTotal;
        html += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${item.quantity}x ${item.itemName} <i>${item.specialNotes ? `(${item.specialNotes})` : ''}</i></span>
            <span>$${lineTotal.toFixed(2)} <button onclick="removeFromManualCart(${index})" style="color:red; cursor:pointer; border:none; background:none;">X</button></span>
        </div>`;
    });
    
    preview.innerHTML = html;
    document.getElementById("manualCartTotal").innerText = `Total: $${total.toFixed(2)}`;
}

function removeFromManualCart(index) {
    localManualCart.splice(index, 1);
    updateManualCartUI();
}
window.removeFromManualCart = removeFromManualCart;

function submitManualCartAsOrder() {
    const tableInput = document.getElementById("manualTableNum");
    const tableNum = parseInt(tableInput.value);

    if (!tableNum || localManualCart.length === 0) {
        alert("Define a table number and add items.");
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
    }).then(() => {
        localManualCart = [];
        tableInput.value = "";
        updateManualCartUI();
        loadAllHistoricalOrders();
        alert("Order sent to kitchen!");
    });
}
window.submitManualCartAsOrder = submitManualCartAsOrder;

function loadAllHistoricalOrders() {
    fetch(`${apiBaseUrl}/orders/all/${restaurantId}`)
        .then(res => res.json())
        .then(allOrders => renderAllOrdersList(allOrders));
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
        let orderTotal = 0;
        
        order.items.forEach(item => {
            const itemPrice = item.price || 0;
            const lineTotal = itemPrice * item.quantity;
            orderTotal += lineTotal;
            linesHtml += `<div>• ${item.quantity}x ${item.itemName} ($${lineTotal.toFixed(2)}) <i style="color:#7f8c8d;">${item.specialNotes || ''}</i></div>`;
        });

        card.innerHTML = `
            <div class="orderTitleRow">
                <span>Order #${order.orderId} (Table ${order.tableNum})</span>
                <span>$${orderTotal.toFixed(2)} | <span style="color:#2980b9;">${order.orderStatus}</span></span>
            </div>
            <div style="margin-bottom: 12px;">${linesHtml}</div>
            <button class="actionBtn redBtn" style="padding:4px 8px; font-size:0.8rem;" onclick="cancelAndPurgeOrder(${order.orderId})">Void Order</button>
        `;
        container.appendChild(card);
    });
}

function cancelAndPurgeOrder(orderId) {
    if (!confirm("Void this transaction entirely?")) return;
    fetch(`${apiBaseUrl}/order/${orderId}`, { method: "DELETE" })
        .then(() => loadAllHistoricalOrders());
}
window.cancelAndPurgeOrder = cancelAndPurgeOrder;