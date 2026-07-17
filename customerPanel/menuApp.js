const urlParams = new URLSearchParams(window.location.search);
const restaurantId = parseInt(urlParams.get('restaurantId')) || 1; 
const tableNum = parseInt(urlParams.get('tableNum')) || 1; 
const apiBaseUrl = "http://127.0.0.1:8000/api";
let shoppingCart = [];

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tableDisplay").innerText = `Table: ${tableNum}`;
    fetch(`${apiBaseUrl}/menu/${restaurantId}`)
        .then(res => res.json())
        .then(menu => {
            document.getElementById("restaurantName").innerText = "Menu";
            const grid = document.getElementById("menuGrid");
            grid.innerHTML = "";
            menu.forEach(item => {
                const isStock = item.inStock === 1;
                const priceFmt = item.price ? `$${item.price.toFixed(2)}` : 'N/A';
                
                const imageHtml = item.imageUrl ? 
                    `<img src="${item.imageUrl}" alt="${item.itemName}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px; margin-bottom: 10px;">` 
                    : '';

                grid.innerHTML += `
                    <div class="menuItem">
                        ${imageHtml}
                        <div>
                            <h3 class="itemTitle">${item.itemName}</h3>
                            <p class="itemPrice">${priceFmt}</p>
                            <p class="itemDescription">${item.itemDesc || ''}</p>
                        </div>
                        ${isStock ? `<button class="addToCartButton" onclick="addItemToCart(${item.itemId}, '${item.itemName}', ${item.price})">Add to Order</button>` : `<span class="outOfStockText">Out of Stock</span>`}
                    </div>`;
            });
        });
});

function addItemToCart(itemId, itemName, price) {
    const existing = shoppingCart.find(i => i.itemId === itemId);
    if(existing) existing.quantity++;
    else shoppingCart.push({ itemId, itemName, price, quantity: 1, specialNotes: "" });
    updateCartUI();
}
window.addItemToCart = addItemToCart;

function updateCartUI() {
    const list = document.getElementById("cartItemsList");
    let total = 0;
    list.innerHTML = "";
    
    if (shoppingCart.length === 0) {
        list.innerHTML = "<p>Cart is empty.</p>";
        document.getElementById("cartTotalDisplay").innerText = "Total: $0.00";
        return;
    }

    shoppingCart.forEach((item, index) => {
        const lineTotal = item.price * item.quantity;
        total += lineTotal;
        list.innerHTML += `
            <div class="cartItemRow">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${item.itemName}</strong>
                    <span>$${lineTotal.toFixed(2)} <button class="removeBtn" onclick="removeCartItem(${index})">X</button></span>
                </div>
                <div class="cartInputRow">
                    <div class="qtyControlRow">
                        <button class="qtyAdjustBtn" onclick="modifyCartQuantity(${index}, -1)">-</button>
                        <span class="qtyLabel">${item.quantity}</span>
                        <button class="qtyAdjustBtn" onclick="modifyCartQuantity(${index}, 1)">+</button>
                    </div>
                    <input type="text" class="cartInput" style="flex: 1;" placeholder="Add notes..." value="${item.specialNotes}" onchange="updateCartNotes(${index}, this.value)">
                </div>
            </div>`;
    });
    document.getElementById("cartTotalDisplay").innerText = `Total: $${total.toFixed(2)}`;
}

function modifyCartQuantity(index, amount) {
    const newQty = shoppingCart[index].quantity + amount;
    if (newQty > 0) {
        shoppingCart[index].quantity = newQty;
    }
    updateCartUI();
}
window.modifyCartQuantity = modifyCartQuantity;

function updateCartNotes(index, newNote) {
    shoppingCart[index].specialNotes = newNote;
}
window.updateCartNotes = updateCartNotes;

function removeCartItem(index) {
    shoppingCart.splice(index, 1);
    updateCartUI();
}
window.removeCartItem = removeCartItem;

function sendOrderToServer() {
    if(!shoppingCart.length) return alert("Cart empty");
    const payload = { restaurantId, tableNum, orderedItems: shoppingCart };

    fetch(`${apiBaseUrl}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).then(res => res.json()).then(data => {
        if(data.status === "success") {
            document.getElementById("menuView").classList.add("hiddenView");
            document.getElementById("confirmationView").classList.remove("hiddenView");
            
            const receiptDiv = document.getElementById("receiptItems");
            let finalTotal = 0;
            shoppingCart.forEach(i => {
                finalTotal += (i.price * i.quantity);
                receiptDiv.innerHTML += `<div class="receiptLine"><span>${i.quantity}x ${i.itemName}</span> <span>$${(i.price * i.quantity).toFixed(2)}</span></div>`;
            });
            document.getElementById("receiptTotal").innerText = `Total: $${finalTotal.toFixed(2)}`;
        }
    });
}
window.sendOrderToServer = sendOrderToServer;