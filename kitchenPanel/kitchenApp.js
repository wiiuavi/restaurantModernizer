const urlParams = new URLSearchParams(window.location.search);
const restaurantId = parseInt(urlParams.get('restaurantId')) || 1; 
const apiBaseUrl = "/api";

let activeChefAuth = "";

function verifyKitchenPassword() {
    const attemptedPin = document.getElementById("kitchenPasswordInput").value;
    
    fetch(`${apiBaseUrl}/auth/chef`, { headers: { "chefAuth": attemptedPin } })
        .then(res => {
            if(res.ok) {
                activeChefAuth = attemptedPin;
                document.getElementById("passwordOverlay").classList.add("hiddenView");
                document.getElementById("kitchenDashboardContent").classList.remove("hiddenView");
                loadOrderQueue();
                loadMenuDrawer();
                setInterval(loadOrderQueue, 5000);
            } else {
                document.getElementById("errorMessage").innerText = "Invalid Access.";
            }
        })
        .catch(err => console.error(err));
}
window.verifyKitchenPassword = verifyKitchenPassword;

function toggleMenuDrawer() {
    document.getElementById("menuDrawer").classList.toggle("hiddenView");
}
window.toggleMenuDrawer = toggleMenuDrawer;

function loadMenuDrawer() {
    fetch(`${apiBaseUrl}/menu/${restaurantId}`)
        .then(res => res.json())
        .then(items => {
            const container = document.getElementById("kitchenMenuContainer");
            container.innerHTML = "";
            items.forEach(item => {
                const isStock = item.inStock === 1;
                container.innerHTML += `
                    <div class="kitchenItemCard">
                        <span>${item.itemName}</span>
                        <button class="actionBtn ${isStock ? 'redBtn' : 'greenBtn'}" onclick="toggleItemStock(${item.itemId}, ${isStock})">
                            ${isStock ? 'Make OOS' : 'Make In Stock'}
                        </button>
                    </div>`;
            });
        });
}

function toggleItemStock(itemId, currentStock) {
    fetch(`${apiBaseUrl}/item/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "adminAuth": activeChefAuth },
        body: JSON.stringify({ inStock: !currentStock })
    }).then(() => loadMenuDrawer());
}
window.toggleItemStock = toggleItemStock;

function loadOrderQueue() {
    fetch(`${apiBaseUrl}/queue/${restaurantId}`, { headers: { "chefAuth": activeChefAuth } })
        .then(res => res.json())
        .then(orders => {
            const container = document.getElementById("kitchenQueueContainer");
            container.innerHTML = "";
            if(orders.length === 0) { container.innerHTML = "No active tickets."; return; }

            const currentTimeMs = new Date().getTime();

            orders.forEach(order => {
                let itemsHtml = "";
                order.items.forEach(item => {
                    const struckClass = item.isCooked ? "struckThrough" : "";
                    itemsHtml += `
                        <div class="ticketItem ${struckClass}" onclick="toggleCookedStatus(${item.orderItemId}, ${!item.isCooked})">
                            ${item.quantity}x ${item.itemName} 
                            ${item.specialNotes ? `<span class="notes">Note: ${item.specialNotes}</span>` : ''}
                        </div>`;
                });

                const orderTimeMs = new Date(order.orderTime).getTime();
                const diffMins = Math.floor((currentTimeMs - orderTimeMs) / 60000);
                const timeString = diffMins <= 0 ? "Just now" : `Ordered ${diffMins} min ago`;

                container.innerHTML += `
                    <div class="orderCard">
                        <div class="orderHeader">
                            <span>Table ${order.tableNum}</span>
                            <span class="timerText">${timeString}</span>
                            <span>#${order.orderId}</span>
                        </div>
                        <div>${itemsHtml}</div>
                        <button class="actionBtn greenBtn" style="width:100%; margin-top:15px;" onclick="completeOrder(${order.orderId})">Send / Complete</button>
                    </div>`;
            });
        });
}

function toggleCookedStatus(orderItemId, nextCookedState) {
    fetch(`${apiBaseUrl}/orderitem/${orderItemId}/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "chefAuth": activeChefAuth },
        body: JSON.stringify({ isCooked: nextCookedState })
    }).then(() => loadOrderQueue());
}
window.toggleCookedStatus = toggleCookedStatus;

function completeOrder(orderId) {
    fetch(`${apiBaseUrl}/order/${orderId}/complete`, { 
        method: "PUT",
        headers: { "chefAuth": activeChefAuth }
    }).then(() => loadOrderQueue());
}
window.completeOrder = completeOrder;