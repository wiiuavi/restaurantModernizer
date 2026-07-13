const urlParams = new URLSearchParams(window.location.search);
const restaurantId = parseInt(urlParams.get('restaurantId')) || 1; 
const tableNum = parseInt(urlParams.get('tableNum')) || 1; 

const apiBaseUrl = "http://127.0.0.1:8000/api";
let shoppingCart = [];

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tableDisplay").innerText = `Table: ${tableNum}`;
    loadMenuData();
});

function loadMenuData() {
    fetch(`${apiBaseUrl}/menu/${restaurantId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch menu data.");
            }
            return response.json();
        })
        .then(menuData => {
            document.getElementById("restaurantName").innerText = "Welcome to Our Restaurant";
            displayMenu(menuData);
        })
        .catch(error => {
            console.error("Error:", error);
            document.getElementById("restaurantName").innerText = "Menu Temporarily Unavailable";
        });
}

function displayMenu(menuItems) {
    const menuGrid = document.getElementById("menuGrid");
    menuGrid.innerHTML = ""; 

    menuItems.forEach(item => {
        const itemCard = document.createElement("div");
        itemCard.className = "menuItem";

        const isItemInStock = item.inStock === 1 || item.inStock === true;

        itemCard.innerHTML = `
            <div>
                <h3 class="itemTitle">${item.itemName}</h3>
                <p class="itemDescription">${item.itemDesc || ''}</p>
            </div>
            ${isItemInStock 
                ? `<button class="addToCartButton" onclick="addItemToCart(${item.itemId}, '${item.itemName}')">Add to Order</button>` 
                : `<span class="outOfStockText">Out of Stock</span>`
            }
        `;
        menuGrid.appendChild(itemCard);
    });
}

function addItemToCart(itemId, itemName) {
    const existingItem = shoppingCart.find(cartItem => cartItem.itemId === itemId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        shoppingCart.push({
            itemId: itemId,
            itemName: itemName,
            quantity: 1,
            specialNotes: ""
        });
    }
    updateCartUI();
}

// Explicitly bind functions to the window scope so the dynamically generated HTML event handlers can reference them
window.addItemToCart = addItemToCart;

function updateCartNote(itemId, noteText) {
    const targetItem = shoppingCart.find(cartItem => cartItem.itemId === itemId);
    if (targetItem) {
        targetItem.specialNotes = noteText;
    }
}

window.updateCartNote = updateCartNote;

function updateCartUI() {
    const cartItemsList = document.getElementById("cartItemsList");
    cartItemsList.innerHTML = "";

    if (shoppingCart.length === 0) {
        cartItemsList.innerHTML = "<p>Your cart is empty.</p>";
        return;
    }

    shoppingCart.forEach(cartItem => {
        const cartRow = document.createElement("div");
        cartRow.className = "cartItemRow";
        cartRow.innerHTML = `
            <div style="width: 100%;">
                <strong>${cartItem.itemName} (x${cartItem.quantity})</strong>
                <input type="text" 
                       class="notesInput" 
                       placeholder="Add special notes (e.g., no onions)..." 
                       value="${cartItem.specialNotes}"
                       onchange="updateCartNote(${cartItem.itemId}, this.value)">
            </div>
        `;
        cartItemsList.appendChild(cartRow);
    });
}

function sendOrderToServer() {
    if (shoppingCart.length === 0) {
        alert("Please add items to your cart before ordering.");
        return;
    }

    const cleanedItems = shoppingCart.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        specialNotes: item.specialNotes
    }));

    const orderPayload = {
        restaurantId: restaurantId,
        tableNum: tableNum,
        orderedItems: cleanedItems
    };

    fetch(`${apiBaseUrl}/order`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(orderPayload)
    })
    .then(response => response.json())
    .then(responseData => {
        if (responseData.status === "success") {
            alert(`Order placed successfully! Order ID: ${responseData.orderId}`);
            shoppingCart = []; 
            updateCartUI();
        } else {
            alert("Something went wrong placing your order.");
        }
    })
    .catch(error => {
        console.error("Error submitting order:", error);
        alert("Failed to reach server. Please try again.");
    });
}

window.sendOrderToServer = sendOrderToServer;