const urlParams = new URLSearchParams(window.location.search);
const restaurantId = parseInt(urlParams.get('restaurantId')) || 1; 
const apiBaseUrl = "/api";

let activeAdminAuth = "";
let masterMenuArray = [];
let masterTagsArray = [];
let localManualCart = [];
let globalOrdersList = [];
let activeEditOrderId = null;
let activeInspectedTagId = null;

function verifyManagementPassword() {
    const attemptedPin = document.getElementById("managementPasswordInput").value;
    
    fetch(`${apiBaseUrl}/auth/admin`, { headers: { "adminAuth": attemptedPin } })
        .then(res => {
            if(res.ok) {
                activeAdminAuth = attemptedPin;
                document.getElementById("passwordOverlay").classList.add("hiddenView");
                document.getElementById("managementDashboardContent").classList.remove("hiddenView");
                switchTab('posTillSection');
                refreshManagementDashboard();
                setInterval(loadAllHistoricalOrders, 7000);
            } else {
                document.getElementById("errorMessage").innerText = "Invalid PIN.";
            }
        })
        .catch(err => {
            console.error(err);
            document.getElementById("errorMessage").innerText = "Connection failed! Ensure the Python server is running and you are accessing via http://localhost:8000.";
        });
}
window.verifyManagementPassword = verifyManagementPassword;

function switchTab(sectionId) {
    const sections = ['posTillSection', 'menuManagementSection', 'tagManagementSection', 'historicalOrdersSection'];
    sections.forEach(id => {
        document.getElementById(id).classList.add('hiddenView');
        const tabBtn = document.getElementById(`tab_${id}`);
        if(tabBtn) tabBtn.classList.remove('activeTab');
    });
    document.getElementById(sectionId).classList.remove('hiddenView');
    const activeBtn = document.getElementById(`tab_${sectionId}`);
    if(activeBtn) activeBtn.classList.add('activeTab');
}
window.switchTab = switchTab;

function renderTagIcon(url) {
    return url ? `<img src="${url}" class="tagIconImg" alt="tag">` : '';
}

function refreshManagementDashboard() {
    loadMasterMenu();
    loadMasterTags();
    loadAllHistoricalOrders();
}

function loadMasterMenu() {
    fetch(`${apiBaseUrl}/menu/${restaurantId}`)
        .then(res => res.json())
        .then(menuData => {
            masterMenuArray = menuData;
            renderMenuControlList();
            populateManualOrderDropdown();
            populateInspectionItemDropdown();
            renderFormTagsContainer();
        })
        .catch(err => console.error(err));
}

function loadMasterTags() {
    fetch(`${apiBaseUrl}/tags/${restaurantId}`)
        .then(res => res.json())
        .then(tags => {
            masterTagsArray = tags;
            renderTagsControlList();
            renderFormTagsContainer();
            if (activeInspectedTagId !== null) {
                inspectTag(activeInspectedTagId);
            }
        })
        .catch(err => console.error(err));
}

function renderTagsControlList() {
    const container = document.getElementById("tagItemsControlList");
    container.innerHTML = "";
    
    if (masterTagsArray.length === 0) {
        container.innerHTML = "<p>No custom tags created.</p>";
        return;
    }

    masterTagsArray.forEach(tag => {
        const row = document.createElement("div");
        row.className = "databaseRow";
        row.style.cursor = "pointer";
        row.onclick = (e) => {
            if(e.target.tagName !== "BUTTON") {
                inspectTag(tag.tagId);
            }
        };
        row.innerHTML = `
            <div>
                <strong>${renderTagIcon(tag.tagIcon)} ${tag.tagName}</strong>
            </div>
            <button class="actionBtn redBtn" style="padding:4px 8px; font-size:0.8rem;" onclick="deleteTag(${tag.tagId})">Delete</button>
        `;
        container.appendChild(row);
    });
}

function renderFormTagsContainer() {
    const container = document.getElementById("formTagsContainer");
    if (!container) return;
    container.innerHTML = "";

    if (masterTagsArray.length === 0) {
        container.innerHTML = "<span style='font-size: 0.9rem; color: var(--mutedTextColor);'>Create tags in the Tag Editor first.</span>";
        return;
    }

    masterTagsArray.forEach(tag => {
        container.innerHTML += `
            <label class="formTagCheckboxLabel">
                <input type="checkbox" name="itemFormTags" value="${tag.tagId}">
                <span>${renderTagIcon(tag.tagIcon)} ${tag.tagName}</span>
            </label>
        `;
    });
}

function renderMenuControlList() {
    const container = document.getElementById("managementMenuContainer");
    container.innerHTML = "";

    masterMenuArray.forEach(item => {
        const priceStr = item.price ? `$${item.price.toFixed(2)}` : 'No Price (OOS)';
        const row = document.createElement("div");
        row.className = "databaseRow";
        
        let tagsHtml = "";
        if (item.itemTags && item.itemTags.length > 0) {
            tagsHtml = "<div style='display:flex; flex-wrap:wrap; gap:4px;'>";
            item.itemTags.forEach(t => {
                tagsHtml += `<span class="itemTagConfigBadge">${renderTagIcon(t.tagIcon)} ${t.tagName}</span>`;
            });
            tagsHtml += "</div>";
        }

        row.innerHTML = `
            <div class="itemDetails">
                <strong>${item.itemName}</strong>
                <span class="itemPriceTag">${priceStr}</span>
                <span style="font-size: 0.85rem; color:#7f8c8d;">${item.itemDesc || ''}</span>
                ${tagsHtml}
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

    const checkboxes = document.getElementsByName("itemFormTags");
    checkboxes.forEach(cb => {
        const tagId = parseInt(cb.value);
        cb.checked = item.itemTags && item.itemTags.some(t => t.tagId === tagId);
    });

    document.getElementById("saveItemBtn").innerText = "Update Item";
    document.getElementById("cancelEditBtn").classList.remove("hiddenView");
    switchTab('menuManagementSection');
}
window.loadItemIntoEditor = loadItemIntoEditor;

function resetItemForm() {
    document.getElementById("editorTitle").innerText = "Create New Item";
    document.getElementById("editingItemId").value = "";
    document.getElementById("itemNameInput").value = "";
    document.getElementById("itemPriceInput").value = "";
    document.getElementById("itemDescInput").value = "";
    document.getElementById("itemImageInput").value = "";
    
    const checkboxes = document.getElementsByName("itemFormTags");
    checkboxes.forEach(cb => cb.checked = false);

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

    const checkboxes = document.getElementsByName("itemFormTags");
    const checkedTagIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) checkedTagIds.push(parseInt(cb.value));
    });

    const payload = {
        restaurantId: restaurantId,
        itemName: nameInput,
        itemDesc: descInput,
        imageUrl: imageInput,
        price: priceInput,
        inStock: true,
        tagIds: checkedTagIds
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

function submitNewTag() {
    const tagName = document.getElementById("newTagName").value.trim();
    const tagIcon = document.getElementById("newTagIcon").value.trim();
    if (!tagName) return alert("Please specify a tag name.");

    const payload = {
        restaurantId: restaurantId,
        tagName: tagName,
        tagIcon: tagIcon
    };

    fetch(`${apiBaseUrl}/tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "adminAuth": activeAdminAuth },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(() => {
        document.getElementById("newTagName").value = "";
        document.getElementById("newTagIcon").value = "";
        loadMasterTags();
    })
    .catch(err => console.error(err));
}
window.submitNewTag = submitNewTag;

function deleteTag(tagId) {
    if (!confirm("Are you sure you want to delete this tag? All item assignments will be removed.")) return;
    fetch(`${apiBaseUrl}/tag/${tagId}`, {
        method: "DELETE",
        headers: { "adminAuth": activeAdminAuth }
    })
    .then(() => {
        if(activeInspectedTagId === tagId) {
            closeTagModal();
        }
        loadMasterTags();
        loadMasterMenu();
    })
    .catch(err => console.error(err));
}
window.deleteTag = deleteTag;

function inspectTag(tagId) {
    activeInspectedTagId = tagId;
    const tag = masterTagsArray.find(t => t.tagId === tagId);
    if (!tag) return;

    document.getElementById("inspectedTagName").innerHTML = `Tag Editor: ${renderTagIcon(tag.tagIcon)} ${tag.tagName}`;
    document.getElementById("tagInspectionModal").classList.remove("hiddenView");

    const assignedContainer = document.getElementById("inspectedTagItemsList");
    assignedContainer.innerHTML = "";

    const assignedItems = masterMenuArray.filter(item => 
        item.itemTags && item.itemTags.some(t => t.tagId === tagId)
    );

    if (assignedItems.length === 0) {
        assignedContainer.innerHTML = "<p style='font-size:0.9rem; color:var(--textColor);'>No items assigned to this tag.</p>";
    } else {
        assignedItems.forEach(item => {
            assignedContainer.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; background:#fff; padding:6px 10px; border-radius:4px; border:1px solid var(--borderColor);">
                    <span style="font-size:0.95rem;">${item.itemName}</span>
                    <button class="actionBtn redBtn" style="padding:2px 6px; font-size:0.75rem;" onclick="submitItemTagRemoval(${item.itemId}, ${tagId})">Remove</button>
                </div>
            `;
        });
    }

    const select = document.getElementById("tagAssignItemSelector");
    select.innerHTML = "";
    
    const unassignedItems = masterMenuArray.filter(item => 
        !item.itemTags || !item.itemTags.some(t => t.tagId === tagId)
    );

    if(unassignedItems.length === 0) {
        select.innerHTML = "<option value=''>All items assigned</option>";
    } else {
        unassignedItems.forEach(item => {
            select.innerHTML += `<option value="${item.itemId}">${item.itemName}</option>`;
        });
    }
}
window.inspectTag = inspectTag;

function closeTagModal() {
    activeInspectedTagId = null;
    document.getElementById("tagInspectionModal").classList.add("hiddenView");
}
window.closeTagModal = closeTagModal;

function submitItemTagAssignment() {
    const select = document.getElementById("tagAssignItemSelector");
    const itemId = parseInt(select.value);
    if(!itemId || !activeInspectedTagId) return;

    fetch(`${apiBaseUrl}/itemtag/assign?itemId=${itemId}&tagId=${activeInspectedTagId}`, {
        method: "POST",
        headers: { "adminAuth": activeAdminAuth }
    })
    .then(() => {
        loadMasterMenu();
    })
    .catch(err => console.error(err));
}
window.submitItemTagAssignment = submitItemTagAssignment;

function submitItemTagRemoval(itemId, tagId) {
    fetch(`${apiBaseUrl}/itemtag/remove?itemId=${itemId}&tagId=${tagId}`, {
        method: "POST",
        headers: { "adminAuth": activeAdminAuth }
    })
    .then(() => {
        loadMasterMenu();
    })
    .catch(err => console.error(err));
}
window.submitItemTagRemoval = submitItemTagRemoval;

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

function populateInspectionItemDropdown() {
    const select = document.getElementById("tagAssignItemSelector");
    if (!select) return;
    select.innerHTML = "";
    masterMenuArray.forEach(item => {
        select.innerHTML += `<option value="${item.itemId}">${item.itemName}</option>`;
    });
}

function adjustMainQtyInput(amount) {
    const qtyInput = document.getElementById("manualItemQuantity");
    let currentQty = parseInt(qtyInput.value) || 1;
    currentQty += amount;
    if (currentQty < 1) currentQty = 1;
    qtyInput.value = currentQty;
}
window.adjustMainQtyInput = adjustMainQtyInput;

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
            <div style="display:flex; gap: 10px; align-items: center;">
                <div class="qtyControlRow">
                    <button class="qtyAdjustBtn" onclick="modifyManualCartQuantity(${index}, -1)">-</button>
                    <span class="qtyLabel">${item.quantity}</span>
                    <button class="qtyAdjustBtn" onclick="modifyManualCartQuantity(${index}, 1)">+</button>
                </div>
                <input type="text" class="formInput" style="flex: 1; margin: 0; padding: 10px; font-size: 1rem;" placeholder="Add notes..." value="${item.specialNotes || ''}" onchange="updateCartItemNote(${index}, this.value)">
            </div>
        </div>`;
    });
    
    preview.innerHTML = html;
    document.getElementById("manualCartTotal").innerText = `Total: $${total.toFixed(2)}`;
}

function modifyManualCartQuantity(index, amount) {
    const newQty = localManualCart[index].quantity + amount;
    if (newQty > 0) {
        localManualCart[index].quantity = newQty;
    }
    updateManualCartUI();
}
window.modifyManualCartQuantity = modifyManualCartQuantity;

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
    switchTab('posTillSection');
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