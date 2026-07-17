const urlParams = new URLSearchParams(window.location.search);
const restaurantId = parseInt(urlParams.get('restaurantId')) || 1; 
const apiBaseUrl = "http://127.0.0.1:8000/api";
const hardcodedPassword = "admin";

let activeAdminAuth = "";
let masterMenuArray = [];
let localManualCart = [];
let globalOrdersList = [];
let activeEditOrderId = null;

function verifyManagementPassword() {
    const attemptedPin = document.getElementById("managementPasswordInput").value;
    
    fetch(`${apiBaseUrl}/auth/admin`, { headers: { "adminAuth": attemptedPin } })
        .then(res => {
            if(res.ok) {
                activeAdminAuth = attemptedPin;
                document.getElementById("passwordOverlay").classList.add("hiddenView");
                document.getElementById("managementDashboardContent").classList.remove("hiddenView");
                refreshManagementDashboard();
                setInterval(loadAllHistoricalOrders, 7000);
            } else {
                document.getElementById("errorMessage").innerText = "Invalid PIN.";
            }
        })
        .catch(err => console.error(err));
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
        .catch(err => console.error(err));
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
                <span style="font-size: 0.85rem; color:#7f8c8d;">${item.itemDesc || ''}</span>
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

    if (!nameInput.trim()) return alert("Specify an item name.");

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
            headers: { "Content-Type": "application/json", "adminAuth": activeAdminAuth },
            body: JSON.stringify(payload)
        }).then(() => {
            resetItemForm();
            loadMasterMenu();
        });
    } else {
        fetch(`${apiBaseUrl}/item`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "adminAuth": activeAdminAuth },
            body: JSON.stringify(payload)
        }).then(() => {
            resetItemForm();
            loadMasterMenu();
        });
    }
}
window.submitItemForm = submitItemForm;

function completelyPurgeItem(itemId) {
    if (!confirm("Delete this item?")) return;
    fetch(`${apiBaseUrl}/item/${itemId}`, { 
        method: "DELETE",
        headers: { "adminAuth": activeAdminAuth }
    }).then(() => loadMasterMenu());
}
window.completelyPurgeItem = completelyPurgeItem;

function populateManualOrderDropdown() {
    const selector = document.getElementById("manualItemSelector");
    selector.innerHTML = "";
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
        html += `
        <div style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong>${item.itemName}</strong>
                <span>$${lineTotal.toFixed(2)} <button onclick="removeFromManualCart(${index})" style="color:red; cursor:pointer; border:none; background:none; font-weight:bold; font-size:1rem;">X</button></span>
            </div>
            <div style="display:flex; gap: 10px;">
                <input type="number" class="formInput" style="width: 60px; margin: 0; padding: 6px;" value="${item.quantity}" onchange="updateCartItemQuantity(${index}, this.value)">
                <input type="text" class="formInput" style="flex: 1; margin: 0; padding: 6px;" placeholder="Add notes..." value="${item.specialNotes || ''}" onchange="updateCartItemNote(${index}, this.value)">
            </div>
        </div>`;
    });
    
    preview.innerHTML = html;
    document.getElementById("manualCartTotal").innerText = `Total: $${total.toFixed(2)}`;
}

function updateCartItemQuantity(index, newQuantity) {
    const qty = parseInt(newQuantity);
    if (qty > 0) {
        localManualCart[index].quantity = qty;
    } else {
        localManualCart[index].quantity = 1;
    }
    updateManualCartUI();
}
window.updateCartItemQuantity = updateCartItemQuantity;

function updateCartItemNote(index, newNoteText) {
    localManualCart[index].specialNotes = newNoteText;
}
window.updateCartItemNote = updateCartItemNote;

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

    if(activeEditOrderId) {
        fetch(`${apiBaseUrl}/order/${activeEditOrderId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "adminAuth": activeAdminAuth },
            body: JSON.stringify(payload)
        }).then(() => {
            cancelOrderEdit();
            loadAllHistoricalOrders();
        });
    } else {
        fetch(`${apiBaseUrl}/order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(() => {
            localManualCart = [];
            tableInput.value = "";
            updateManualCartUI();
            loadAllHistoricalOrders();
        });
    }
}
window.submitManualCartAsOrder = submitManualCartAsOrder;

function loadAllHistoricalOrders() {
    fetch(`${apiBaseUrl}/orders/all/${restaurantId}`, { headers: { "adminAuth": activeAdminAuth } })
        .then(res => res.json())
        .then(allOrders => {
            globalOrdersList = allOrders;
            renderAllOrdersList(allOrders);
        });
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
            <div style="display:flex; gap:10px;">
                <button class="actionBtn blueBtn" style="padding:4px 8px; font-size:0.8rem;" onclick="loadOrderIntoEditor(${order.orderId})">Edit Order</button>
                <button class="actionBtn redBtn" style="padding:4px 8px; font-size:0.8rem;" onclick="cancelAndPurgeOrder(${order.orderId})">Void Order</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function cancelAndPurgeOrder(orderId) {
    if (!confirm("Void this transaction entirely?")) return;
    fetch(`${apiBaseUrl}/order/${orderId}`, { 
        method: "DELETE",
        headers: { "adminAuth": activeAdminAuth }
    }).then(() => loadAllHistoricalOrders());
}
window.cancelAndPurgeOrder = cancelAndPurgeOrder;

function loadOrderIntoEditor(orderId) {
    const targetOrder = globalOrdersList.find(o => o.orderId === orderId);
    if (!targetOrder) return;
    
    activeEditOrderId = orderId;
    document.getElementById("tillSectionTitle").innerText = `Editing Order #${orderId}`;
    
    const tableInput = document.getElementById("manualTableNum");
    tableInput.value = targetOrder.tableNum;
    tableInput.disabled = true;
    
    localManualCart = targetOrder.items.map(item => ({
        itemId: item.itemId,
        itemName: item.itemName,
        price: item.price,
        quantity: item.quantity,
        specialNotes: item.specialNotes
    }));
    
    updateManualCartUI();
    document.getElementById("submitCartBtn").innerText = "Update Existing Order";
    document.getElementById("cancelEditCartBtn").classList.remove("hiddenView");
}
window.loadOrderIntoEditor = loadOrderIntoEditor;

function cancelOrderEdit() {
    activeEditOrderId = null;
    localManualCart = [];
    document.getElementById("tillSectionTitle").innerText = "Active Till / Ring-Up";
    
    const tableInput = document.getElementById("manualTableNum");
    tableInput.value = "";
    tableInput.disabled = false;
    
    document.getElementById("submitCartBtn").innerText = "Submit Order to Kitchen";
    document.getElementById("cancelEditCartBtn").classList.add("hiddenView");
    updateManualCartUI();
}
window.cancelOrderEdit = cancelOrderEdit;