const urlParams = new URLSearchParams(window.location.search);
const restaurantId = parseInt(urlParams.get('restaurantId')) || 1; 

const apiBaseUrl = "http://127.0.0.1:8000/api";
const hardcodedAdminPassword = "password123";

function verifyAdminPassword() {
    const enteredPassword = document.getElementById("adminPasswordInput").value;
    const errorTextElement = document.getElementById("errorMessage");

    if (enteredPassword === hardcodedAdminPassword) {
        document.getElementById("passwordOverlay").classList.add("hiddenView");
        document.getElementById("adminDashboardContent").classList.remove("hiddenView");
        
        startAdminDashboard();
    } else {
        errorTextElement.innerText = "Invalid Password. Access Denied.";
    }
}
window.verifyAdminPassword = verifyAdminPassword;

function startAdminDashboard() {
    loadMenuManagement();
    loadOrderQueue();
    
    setInterval(loadOrderQueue, 5000);
}

function loadMenuManagement() {
    fetch(`${apiBaseUrl}/menu/${restaurantId}`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to load menu fields.");
            return response.json();
        })
        .then(menuItems => {
            renderMenuManagement(menuItems);
        })
        .catch(error => {
            console.error("Error fetching admin menu items:", error);
            document.getElementById("adminMenuContainer").innerText = "Failed to load interactive menu options.";
        });
}

function renderMenuManagement(menuItems) {
    const container = document.getElementById("adminMenuContainer");
    container.innerHTML = "";

    menuItems.forEach(item => {
        const itemCard = document.createElement("div");
        itemCard.className = "adminItemCard";

        const isItemInStock = item.inStock === 1 || item.inStock === true;
        
        itemCard.innerHTML = `
            <div>
                <strong>${item.itemName}</strong>
            </div>
            <div>
                <span class="stockStatusText ${isItemInStock ? 'inStockLabel' : 'outOfStockLabel'}">
                    ${isItemInStock ? 'In Stock' : 'Out of Stock'}
                </span>
                <button class="toggleButton ${isItemInStock ? 'buttonRed' : 'buttonGreen'}" 
                        onclick="toggleItemAvailability(${item.itemId}, ${isItemInStock})">
                    ${isItemInStock ? 'Make OOS' : 'Make Available'}
                </button>
            </div>
        `;
        container.appendChild(itemCard);
    });
}

function toggleItemAvailability(itemId, currentStockStatus) {
    const newStockStatus = !currentStockStatus;

    const payload = {
        inStock: newStockStatus
    };

    fetch(`${apiBaseUrl}/item/${itemId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            loadMenuManagement();
        } else {
            alert("Error altering database item status.");
        }
    })
    .catch(error => {
        console.error("Error updating menu visibility configuration:", error);
    });
}
window.toggleItemAvailability = toggleItemAvailability;

function loadOrderQueue() {
    fetch(`${apiBaseUrl}/queue/${restaurantId}`)
        .then(response => {
            if (!response.ok) throw new Error("Queue endpoint unreachable.");
            return response.json();
        })
        .then(queueData => {
            renderOrderQueue(queueData);
        })
        .catch(error => {
            console.error("Queue loop error:", error);
        });
}

function renderOrderQueue(activeOrders) {
    const container = document.getElementById("adminQueueContainer");
    container.innerHTML = "";

    if (activeOrders.length === 0) {
        container.innerHTML = "<p>No active orders incoming.</p>";
        return;
    }

    activeOrders.forEach(order => {
        const orderCard = document.createElement("div");
        orderCard.className = "orderQueueCard";

        let orderItemsListHtml = "";
        order.items.forEach(orderedItem => {
            orderItemsListHtml += `
                <div class="orderItemLine">
                    • <strong>${orderedItem.itemName}</strong> x ${orderedItem.quantity}
                    ${orderedItem.specialNotes ? `<div class="itemNotesText">"${orderedItem.specialNotes}"</div>` : ''}
                </div>
            `;
        });

        // Added a button row at the bottom of the card template
        orderCard.innerHTML = `
            <div class="orderHeaderRow">
                <span>Order #${order.orderId} (Table ${order.tableNum})</span>
                <span>${order.orderStatus}</span>
            </div>
            <div class="orderBodyContainer">
                ${orderItemsListHtml}
            </div>
            <div style="margin-top: 15px; text-align: right;">
                <button class="toggleButton buttonGreen" onclick="markOrderAsComplete(${order.orderId})">
                    Complete Order
                </button>
            </div>
        `;
        container.appendChild(orderCard);
    });
}

function markOrderAsComplete(orderId) {
    fetch(`${apiBaseUrl}/order/${orderId}/complete`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            loadOrderQueue();
        } else {
            alert("Failed to update order status.");
        }
    })
    .catch(error => {
        console.error("Error completing order:", error);
    });
}
window.markOrderAsComplete = markOrderAsComplete;