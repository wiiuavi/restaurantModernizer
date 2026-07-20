import sqlite3
import os
from datetime import datetime
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

adminPin = os.getenv("ADMIN_PIN", "admin123")
chefPin = os.getenv("CHEF_PIN", "chef123")
restaurantName = os.getenv("RESTAURANT_NAME", "MicroSaaS Menu")
themePrimary = os.getenv("THEME_PRIMARY", "#0275d8")
themeSecondary = os.getenv("THEME_SECONDARY", "#5cb85c")
themeBackground = os.getenv("THEME_BACKGROUND", "#f9f9f9")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dbName = "masterMenuDatabase.db"

def getDbConnection():
    dbConn = sqlite3.connect(dbName, timeout=10.0)
    dbConn.execute("PRAGMA journal_mode=WAL;")
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
            price REAL,
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
            specialNotes TEXT,
            isCooked BOOLEAN NOT NULL DEFAULT 0
        )
    ''')
    dbCursor.execute('''
        CREATE TABLE IF NOT EXISTS Tags (
            tagId INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurantId INTEGER,
            tagName TEXT NOT NULL,
            tagIcon TEXT
        )
    ''')
    dbCursor.execute('''
        CREATE TABLE IF NOT EXISTS ItemTags (
            itemId INTEGER,
            tagId INTEGER,
            PRIMARY KEY (itemId, tagId)
        )
    ''')
    dbConn.commit()
    dbConn.close()

setupDatabase()

def requireAdmin(adminAuth: str = Header(None)):
    if adminAuth != adminPin:
        raise HTTPException(status_code=401)

def requireChef(chefAuth: str = Header(None)):
    if chefAuth != chefPin:
        raise HTTPException(status_code=401)

class ItemUpdateData(BaseModel):
    itemName: Optional[str] = None
    itemDesc: Optional[str] = None
    imageUrl: Optional[str] = None
    price: Optional[float] = None
    inStock: Optional[bool] = None
    tagIds: Optional[List[int]] = None

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
    price: Optional[float] = None
    inStock: bool = True
    tagIds: Optional[List[int]] = []

class ToggleCookedData(BaseModel):
    isCooked: bool

class NewTagData(BaseModel):
    restaurantId: int
    tagName: str
    tagIcon: Optional[str] = ""

@app.get("/api/config")
def getPublicConfig():
    return {
        "restaurantName": restaurantName,
        "themePrimary": themePrimary,
        "themeSecondary": themeSecondary,
        "themeBackground": themeBackground
    }

@app.get("/api/auth/admin", dependencies=[Depends(requireAdmin)])
def checkAdminAuth():
    return {"status": "success"}

@app.get("/api/auth/chef", dependencies=[Depends(requireChef)])
def checkChefAuth():
    return {"status": "success"}

@app.get("/api/menu/{restaurantId}")
def getMenu(restaurantId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("SELECT * FROM MenuItems WHERE restaurantId = ?", (restaurantId,))
    menuRows = dbCursor.fetchall()
    itemsList = []
    for row in menuRows:
        itemDict = dict(row)
        dbCursor.execute("""
            SELECT Tags.tagId, Tags.tagName, Tags.tagIcon 
            FROM ItemTags 
            JOIN Tags ON ItemTags.tagId = Tags.tagId 
            WHERE ItemTags.itemId = ?
        """, (itemDict["itemId"],))
        itemDict["itemTags"] = [dict(r) for r in dbCursor.fetchall()]
        itemsList.append(itemDict)
    dbConn.close()
    return itemsList

@app.put("/api/item/{itemId}", dependencies=[Depends(requireAdmin)])
def updateMenuItem(itemId: int, updateData: ItemUpdateData):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    if updateData.itemName is not None:
        dbCursor.execute("UPDATE MenuItems SET itemName = ? WHERE itemId = ?", (updateData.itemName, itemId))
    if updateData.itemDesc is not None:
        dbCursor.execute("UPDATE MenuItems SET itemDesc = ? WHERE itemId = ?", (updateData.itemDesc, itemId))
    if updateData.imageUrl is not None:
        dbCursor.execute("UPDATE MenuItems SET imageUrl = ? WHERE itemId = ?", (updateData.imageUrl, itemId))
    if updateData.price is not None:
        dbCursor.execute("UPDATE MenuItems SET price = ? WHERE itemId = ?", (updateData.price, itemId))
    if updateData.inStock is not None:
        dbCursor.execute("UPDATE MenuItems SET inStock = ? WHERE itemId = ?", (int(updateData.inStock), itemId))
    dbCursor.execute("SELECT price FROM MenuItems WHERE itemId = ?", (itemId,))
    currentPrice = dbCursor.fetchone()["price"]
    if currentPrice is None or currentPrice <= 0:
        dbCursor.execute("UPDATE MenuItems SET inStock = 0 WHERE itemId = ?", (itemId,))
    if updateData.tagIds is not None:
        dbCursor.execute("DELETE FROM ItemTags WHERE itemId = ?", (itemId,))
        for tagId in updateData.tagIds:
            dbCursor.execute("INSERT INTO ItemTags (itemId, tagId) VALUES (?, ?)", (itemId, tagId))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

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
            "INSERT INTO OrderItems (orderId, itemId, quantity, specialNotes, isCooked) VALUES (?, ?, ?, ?, 0)",
            (newOrderId, item.itemId, item.quantity, item.specialNotes)
        )
    dbConn.commit()
    dbConn.close()
    return {"status": "success", "orderId": newOrderId}

@app.put("/api/order/{orderId}", dependencies=[Depends(requireAdmin)])
def updateExistingOrder(orderId: int, updateData: NewOrderData):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("DELETE FROM OrderItems WHERE orderId = ?", (orderId,))
    for item in updateData.orderedItems:
        dbCursor.execute(
            "INSERT INTO OrderItems (orderId, itemId, quantity, specialNotes, isCooked) VALUES (?, ?, ?, ?, 0)",
            (orderId, item.itemId, item.quantity, item.specialNotes)
        )
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.get("/api/queue/{restaurantId}", dependencies=[Depends(requireChef)])
def getOrderQueue(restaurantId: int):
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
            SELECT OrderItems.id as orderItemId, OrderItems.quantity, OrderItems.specialNotes, OrderItems.isCooked, MenuItems.itemName 
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

@app.put("/api/orderitem/{orderItemId}/toggle", dependencies=[Depends(requireChef)])
def toggleOrderItemCooked(orderItemId: int, toggleData: ToggleCookedData):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("UPDATE OrderItems SET isCooked = ? WHERE id = ?", (int(toggleData.isCooked), orderItemId))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.put("/api/order/{orderId}/complete", dependencies=[Depends(requireChef)])
def completeOrder(orderId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("UPDATE Orders SET orderStatus = 'Completed' WHERE orderId = ?", (orderId,))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.post("/api/item", dependencies=[Depends(requireAdmin)])
def createMenuItem(itemData: NewItemData):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    finalStock = itemData.inStock
    if itemData.price is None or itemData.price <= 0:
        finalStock = False
    dbCursor.execute(
        """
        INSERT INTO MenuItems (restaurantId, itemName, itemDesc, imageUrl, price, inStock)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (itemData.restaurantId, itemData.itemName, itemData.itemDesc, itemData.imageUrl, itemData.price, int(finalStock))
    )
    newItemId = dbCursor.lastrowid
    if itemData.tagIds:
        for tagId in itemData.tagIds:
            dbCursor.execute("INSERT INTO ItemTags (itemId, tagId) VALUES (?, ?)", (newItemId, tagId))
    dbConn.commit()
    dbConn.close()
    return {"status": "success", "itemId": newItemId}

@app.delete("/api/item/{itemId}", dependencies=[Depends(requireAdmin)])
def deleteMenuItem(itemId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("DELETE FROM MenuItems WHERE itemId = ?", (itemId,))
    dbCursor.execute("DELETE FROM ItemTags WHERE itemId = ?", (itemId,))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.get("/api/orders/all/{restaurantId}", dependencies=[Depends(requireAdmin)])
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
            SELECT OrderItems.quantity, OrderItems.specialNotes, MenuItems.itemName, MenuItems.price, MenuItems.itemId 
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

@app.delete("/api/order/{orderId}", dependencies=[Depends(requireAdmin)])
def deleteOrder(orderId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("DELETE FROM Orders WHERE orderId = ?", (orderId,))
    dbCursor.execute("DELETE FROM OrderItems WHERE orderId = ?", (orderId,))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.get("/api/tags/{restaurantId}")
def getTags(restaurantId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("SELECT * FROM Tags WHERE restaurantId = ?", (restaurantId,))
    tagRows = dbCursor.fetchall()
    dbConn.close()
    return [dict(row) for row in tagRows]

@app.post("/api/tag", dependencies=[Depends(requireAdmin)])
def createTag(tagData: NewTagData):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute(
        "INSERT INTO Tags (restaurantId, tagName, tagIcon) VALUES (?, ?, ?)",
        (tagData.restaurantId, tagData.tagName, tagData.tagIcon)
    )
    newTagId = dbCursor.lastrowid
    dbConn.commit()
    dbConn.close()
    return {"status": "success", "tagId": newTagId}

@app.delete("/api/tag/{tagId}", dependencies=[Depends(requireAdmin)])
def deleteTag(tagId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("DELETE FROM Tags WHERE tagId = ?", (tagId,))
    dbCursor.execute("DELETE FROM ItemTags WHERE tagId = ?", (tagId,))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.post("/api/itemtag/assign", dependencies=[Depends(requireAdmin)])
def assignItemTag(itemId: int, tagId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("INSERT OR IGNORE INTO ItemTags (itemId, tagId) VALUES (?, ?)", (itemId, tagId))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.post("/api/itemtag/remove", dependencies=[Depends(requireAdmin)])
def removeItemTag(itemId: int, tagId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("DELETE FROM ItemTags WHERE itemId = ? AND tagId = ?", (itemId, tagId))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

app.mount("/menu", StaticFiles(directory="../customerPanel", html=True), name="customer")
app.mount("/kitchen", StaticFiles(directory="../kitchenPanel", html=True), name="kitchen")
app.mount("/management", StaticFiles(directory="../managementPanel", html=True), name="management")

if __name__ == "__main__":
    import uvicorn
    hostIp = os.getenv("HOST_IP", "0.0.0.0")
    portNum = int(os.getenv("PORT", "8000"))
    uvicorn.run("masterServer:app", host=hostIp, port=portNum, reload=True)

#uvicorn masterServer:app --reload