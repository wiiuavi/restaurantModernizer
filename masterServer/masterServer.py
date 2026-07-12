import sqlite3
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware

#uvicorn masterServer:app --reload

app = FastAPI(title="MicroSaaS Menu API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
dbName = "masterMenuDatabase.db"

def getDbConnection():
    dbConn = sqlite3.connect(dbName)
    dbConn.row_factory = sqlite3.Row
    return dbConn


def setupDatabase():
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    
    dbCursor.execute('''
        CREATE TABLE IF NOT EXISTS Restaurants (
            restaurantId INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurantName TEXT NOT NULL
        )
    ''')
    
    dbCursor.execute('''
        CREATE TABLE IF NOT EXISTS MenuItems (
            itemId INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurantId INTEGER,
            itemName TEXT NOT NULL,
            itemDesc TEXT,
            imageUrl TEXT,
            inStock BOOLEAN NOT NULL CHECK (inStock IN (0, 1))
        )
    ''')
    
    dbCursor.execute('''
        CREATE TABLE IF NOT EXISTS Orders (
            orderId INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurantId INTEGER,
            tableNum INTEGER NOT NULL,
            orderStatus TEXT NOT NULL,
            orderTime TEXT NOT NULL
        )
    ''')
    
    dbCursor.execute('''
        CREATE TABLE IF NOT EXISTS OrderItems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orderId INTEGER,
            itemId INTEGER,
            quantity INTEGER NOT NULL,
            specialNotes TEXT
        )
    ''')
    
    dbConn.commit()
    dbConn.close()

setupDatabase()


class ItemUpdateData(BaseModel):
    itemName: Optional[str] = None
    itemDesc: Optional[str] = None
    inStock: Optional[bool] = None

class OrderItemData(BaseModel):
    itemId: int
    quantity: int
    specialNotes: Optional[str] = ""

class NewOrderData(BaseModel):
    restaurantId: int
    tableNum: int
    orderedItems: List[OrderItemData]
    
class NewItemData(BaseModel):
    restaurantId: int
    itemName: str
    itemDesc: Optional[str] = ""
    imageUrl: Optional[str] = ""
    inStock: bool = True


@app.get("/api/menu/{restaurantId}")
def getMenu(restaurantId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    
    dbCursor.execute(
        "SELECT * FROM MenuItems WHERE restaurantId = ?", 
        (restaurantId,)
    )
    menuRows = dbCursor.fetchall()
    dbConn.close()
    
    if not menuRows:
        raise HTTPException(status_code=404, detail="Menu not found or empty.")
    
    return [dict(row) for row in menuRows]


@app.put("/api/item/{itemId}")
def updateMenuItem(itemId: int, updateData: ItemUpdateData):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()

    if updateData.itemName is not None:
        dbCursor.execute("UPDATE MenuItems SET itemName = ? WHERE itemId = ?", (updateData.itemName, itemId))
    if updateData.itemDesc is not None:
        dbCursor.execute("UPDATE MenuItems SET itemDesc = ? WHERE itemId = ?", (updateData.itemDesc, itemId))
    if updateData.inStock is not None:
        dbCursor.execute("UPDATE MenuItems SET inStock = ? WHERE itemId = ?", (int(updateData.inStock), itemId))
        
    dbConn.commit()
    dbConn.close()
    return {"status": "success", "message": "Item updated successfully."}


@app.post("/api/order")
def placeNewOrder(orderData: NewOrderData):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    
    currentTime = datetime.now().isoformat()
    
    dbCursor.execute(
        "INSERT INTO Orders (restaurantId, tableNum, orderStatus, orderTime) VALUES (?, ?, ?, ?)",
        (orderData.restaurantId, orderData.tableNum, "Received", currentTime)
    )
    newOrderId = dbCursor.lastrowid
    
    for item in orderData.orderedItems:
        dbCursor.execute(
            "INSERT INTO OrderItems (orderId, itemId, quantity, specialNotes) VALUES (?, ?, ?, ?)",
            (newOrderId, item.itemId, item.quantity, item.specialNotes)
        )
        
    dbConn.commit()
    dbConn.close()
    
    return {"status": "success", "orderId": newOrderId}


@app.get("/api/queue/{restaurantId}")
def getOrderQueue(restaurantId: int):
	#admin endpoint for kitchen to see orders
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute(
        "SELECT * FROM Orders WHERE restaurantId = ? AND orderStatus != 'Completed' ORDER BY orderTime ASC",
        (restaurantId,)
    )
    activeOrders = dbCursor.fetchall()
    
    formattedQueue = []
    
    for orderRow in activeOrders:
        orderDict = dict(orderRow)
        dbCursor.execute(
            """
            SELECT OrderItems.quantity, OrderItems.specialNotes, MenuItems.itemName 
            FROM OrderItems 
            JOIN MenuItems ON OrderItems.itemId = MenuItems.itemId 
            WHERE OrderItems.orderId = ?
            """, 
            (orderDict["orderId"],)
        )
        itemsInOrder = dbCursor.fetchall()
        orderDict["items"] = [dict(item) for item in itemsInOrder]
        formattedQueue.append(orderDict)
        
    dbConn.close()
    return formattedQueue

@app.put("/api/order/{orderId}/complete")
def completeOrder(orderId: int):
    """Admin endpoint to mark an order as cooked/delivered."""
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    
    dbCursor.execute(
        "UPDATE Orders SET orderStatus = 'Completed' WHERE orderId = ?", 
        (orderId,)
    )
    
    dbConn.commit()
    dbConn.close()
    return {"status": "success", "message": "Order marked as completed."}


@app.post("/api/item")
def createMenuItem(itemData: NewItemData):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    
    dbCursor.execute(
        """
        INSERT INTO MenuItems (restaurantId, itemName, itemDesc, imageUrl, inStock)
        VALUES (?, ?, ?, ?, ?)
        """,
        (itemData.restaurantId, itemData.itemName, itemData.itemDesc, itemData.imageUrl, int(itemData.inStock))
    )
    newItemId = dbCursor.lastrowid
    
    dbConn.commit()
    dbConn.close()
    return {"status": "success", "itemId": newItemId}


@app.delete("/api/item/{itemId}")
def deleteMenuItem(itemId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    
    dbCursor.execute("DELETE FROM MenuItems WHERE itemId = ?", (itemId,))
    
    dbConn.commit()
    dbConn.close()
    return {"status": "success", "message": "Item deleted from database entirely."}


@app.get("/api/orders/all/{restaurantId}")
def getAllOrders(restaurantId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    
    dbCursor.execute("SELECT * FROM Orders WHERE restaurantId = ? ORDER BY orderId DESC", (restaurantId,))
    allOrders = dbCursor.fetchall()
    
    formattedOrders = []
    for orderRow in allOrders:
        orderDict = dict(orderRow)
        dbCursor.execute(
            """
            SELECT OrderItems.quantity, OrderItems.specialNotes, MenuItems.itemName 
            FROM OrderItems 
            JOIN MenuItems ON OrderItems.itemId = MenuItems.itemId 
            WHERE OrderItems.orderId = ?
            """, 
            (orderDict["orderId"],)
        )
        itemsInOrder = dbCursor.fetchall()
        orderDict["items"] = [dict(item) for item in itemsInOrder]
        formattedOrders.append(orderDict)
        
    dbConn.close()
    return formattedOrders


@app.delete("/api/order/{orderId}")
def deleteOrder(orderId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    
    dbCursor.execute("DELETE FROM Orders WHERE orderId = ?", (orderId,))
    dbCursor.execute("DELETE FROM OrderItems WHERE orderId = ?", (orderId,))
    
    dbConn.commit()
    dbConn.close()
    return {"status": "success", "message": "Order purged from records."}