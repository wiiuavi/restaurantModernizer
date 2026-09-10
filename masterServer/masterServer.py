import sqlite3
import os
import io
import shutil
import tempfile
from datetime import datetime
import atexit
from pathlib import Path
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

load_dotenv(dotenv_path=PROJECT_ROOT / ".env")

demoMode = os.getenv("DEMO_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}
adminPin = "demo" if demoMode else os.getenv("ADMIN_PIN", "admin123")
chefPin = "demo" if demoMode else os.getenv("CHEF_PIN", "chef123")
restaurantName = os.getenv("RESTAURANT_NAME", "MicroSaaS Menu")
if demoMode:
    restaurantName = f"{restaurantName} (DEMO MODE)"
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

configuredDatabaseName = os.getenv("DATABASE_NAME", "masterMenuDatabase.db").strip()
configuredDatabasePath = Path(configuredDatabaseName)
dbPath = configuredDatabasePath if configuredDatabasePath.is_absolute() else BASE_DIR / configuredDatabasePath
runtimeDbPath = dbPath

def ensureRuntimeDbPath():
    global runtimeDbPath
    dbPath.parent.mkdir(parents=True, exist_ok=True)
    try:
        testConn = sqlite3.connect(str(dbPath), timeout=10.0)
        testConn.execute("CREATE TABLE IF NOT EXISTS __sqlite_write_probe (id INTEGER)")
        testConn.execute("DROP TABLE __sqlite_write_probe")
        testConn.rollback()
        testConn.close()
        runtimeDbPath = dbPath
    except sqlite3.OperationalError:
        tempDbFolder = Path(tempfile.gettempdir()) / "restaurantModernizer"
        tempDbFolder.mkdir(parents=True, exist_ok=True)
        runtimeDbPath = tempDbFolder / dbPath.name
        if dbPath.exists() and not runtimeDbPath.exists():
            shutil.copy2(dbPath, runtimeDbPath)

def syncRuntimeDbBack():
    if runtimeDbPath != dbPath and runtimeDbPath.exists():
        try:
            shutil.copy2(runtimeDbPath, dbPath)
        except PermissionError:
            pass

ensureRuntimeDbPath()
atexit.register(syncRuntimeDbBack)

def getDbConnection():
    dbConn = sqlite3.connect(str(runtimeDbPath), timeout=10.0)
    try:
        dbConn.execute("PRAGMA journal_mode=WAL;")
    except sqlite3.OperationalError:
        pass
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

def requireEditableMode():
    if demoMode:
        raise HTTPException(status_code=403, detail="This action is unavailable in demo mode.")

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
        "themeBackground": themeBackground,
        "demoMode": demoMode
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

@app.put("/api/item/{itemId}", dependencies=[Depends(requireAdmin), Depends(requireEditableMode)])
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
            (newOrderId, item.itemId, item.quantity, "" if demoMode else item.specialNotes)
        )
    dbConn.commit()
    dbConn.close()
    return {"status": "success", "orderId": newOrderId}

@app.put("/api/order/{orderId}", dependencies=[Depends(requireAdmin), Depends(requireEditableMode)])
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
        if demoMode:
            for item in orderDict["items"]:
                item["specialNotes"] = ""
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

@app.put("/api/order/{orderId}/completePos", dependencies=[Depends(requireAdmin)])
def completeOrderPos(orderId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("UPDATE Orders SET orderStatus = 'Completed' WHERE orderId = ?", (orderId,))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.post("/api/item", dependencies=[Depends(requireAdmin), Depends(requireEditableMode)])
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

@app.delete("/api/item/{itemId}", dependencies=[Depends(requireAdmin), Depends(requireEditableMode)])
def deleteMenuItem(itemId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("DELETE FROM MenuItems WHERE itemId = ?", (itemId,))
    dbCursor.execute("DELETE FROM ItemTags WHERE itemId = ?", (itemId,))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.get("/api/orders/all/{restaurantId}", dependencies=[Depends(requireAdmin)])
def getAllOrders(restaurantId: int, startDate: Optional[str] = None, endDate: Optional[str] = None):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    
    query = "SELECT * FROM Orders WHERE restaurantId = ?"
    params = [restaurantId]
    
    if startDate:
        query += " AND orderTime >= ?"
        params.append(startDate)
    if endDate:
        query += " AND orderTime <= ?"
        params.append(endDate + "T23:59:59")
        
    query += " ORDER BY orderId DESC"
    dbCursor.execute(query, tuple(params))
    
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
        if demoMode:
            for item in orderDict["items"]:
                item["specialNotes"] = ""
        formattedOrders.append(orderDict)
    dbConn.close()
    return formattedOrders

@app.delete("/api/order/{orderId}", dependencies=[Depends(requireAdmin), Depends(requireEditableMode)])
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

@app.post("/api/tag", dependencies=[Depends(requireAdmin), Depends(requireEditableMode)])
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

@app.delete("/api/tag/{tagId}", dependencies=[Depends(requireAdmin), Depends(requireEditableMode)])
def deleteTag(tagId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("DELETE FROM Tags WHERE tagId = ?", (tagId,))
    dbCursor.execute("DELETE FROM ItemTags WHERE tagId = ?", (tagId,))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.post("/api/itemtag/assign", dependencies=[Depends(requireAdmin), Depends(requireEditableMode)])
def assignItemTag(itemId: int, tagId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("INSERT OR IGNORE INTO ItemTags (itemId, tagId) VALUES (?, ?)", (itemId, tagId))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.post("/api/itemtag/remove", dependencies=[Depends(requireAdmin), Depends(requireEditableMode)])
def removeItemTag(itemId: int, tagId: int):
    dbConn = getDbConnection()
    dbCursor = dbConn.cursor()
    dbCursor.execute("DELETE FROM ItemTags WHERE itemId = ? AND tagId = ?", (itemId, tagId))
    dbConn.commit()
    dbConn.close()
    return {"status": "success"}

@app.get("/api/qr/pdf")
def generateQrPdf(restaurantId: int = 1, tableCount: int = 10, baseUrl: Optional[str] = None):
    if tableCount < 1:
        tableCount = 1
    if not baseUrl or baseUrl.strip() == "":
        baseUrl = f"http://localhost:8000/menu/?restaurantId={restaurantId}&tableNum="

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.barcode import qr
        from reportlab.graphics import renderPDF
        from reportlab.lib import colors

        pdfBuffer = io.BytesIO()
        pdfCanvas = canvas.Canvas(pdfBuffer, pagesize=letter)
        pageWidth, pageHeight = letter

        for currentTable in range(1, tableCount + 1):
            if "tableNum=" in baseUrl:
                tableUrl = f"{baseUrl}{currentTable}"
            elif baseUrl.endswith("/"):
                tableUrl = f"{baseUrl}?restaurantId={restaurantId}&tableNum={currentTable}"
            else:
                tableUrl = f"{baseUrl}&tableNum={currentTable}"

            pdfCanvas.setFillColor(colors.HexColor(themePrimary if themePrimary else "#0275d8"))
            pdfCanvas.rect(0, pageHeight - 90, pageWidth, 90, fill=True, stroke=False)
            
            pdfCanvas.setFillColor(colors.white)
            pdfCanvas.setFont("Helvetica-Bold", 26)
            pdfCanvas.drawCentredString(pageWidth / 2, pageHeight - 55, restaurantName)

            pdfCanvas.setFillColor(colors.HexColor("#2c3e50"))
            pdfCanvas.setFont("Helvetica-Bold", 38)
            pdfCanvas.drawCentredString(pageWidth / 2, pageHeight - 170, f"Table {currentTable}")

            pdfCanvas.setFont("Helvetica", 16)
            pdfCanvas.setFillColor(colors.HexColor("#7f8c8d"))
            pdfCanvas.drawCentredString(pageWidth / 2, pageHeight - 210, "Scan QR Code to View Menu & Order")

            qrWidget = qr.QrCodeWidget(tableUrl)
            bounds = qrWidget.getBounds()
            w = bounds[2] - bounds[0]
            h = bounds[3] - bounds[1]
            qrSize = 280
            drawing = Drawing(qrSize, qrSize, transform=[qrSize / w, 0, 0, qrSize / h, 0, 0])
            drawing.add(qrWidget)

            renderPDF.draw(drawing, pdfCanvas, (pageWidth - qrSize) / 2, pageHeight - 520)

            pdfCanvas.setFont("Helvetica-Oblique", 12)
            pdfCanvas.setFillColor(colors.HexColor("#95a5a6"))
            pdfCanvas.drawCentredString(pageWidth / 2, 90, f"Table #{currentTable} • {restaurantName}")
            pdfCanvas.drawCentredString(pageWidth / 2, 70, f"Page {currentTable} of {tableCount}")

            pdfCanvas.showPage()

        pdfCanvas.save()
        pdfBuffer.seek(0)
        return Response(content=pdfBuffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": "inline; filename=table_qr_codes.pdf"})
    except Exception as pdfError:
        htmlContent = f"""<!DOCTYPE html>
<html>
<head>
    <title>Table QR Codes Print View</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f6f9; }}
        .page {{ width: 100vw; height: 100vh; page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; padding: 40px; text-align: center; background: #fff; }}
        .header {{ background: {themePrimary}; color: white; width: 100%; padding: 25px 0; font-size: 32px; font-weight: bold; margin-bottom: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
        .tableName {{ font-size: 54px; font-weight: bold; color: #2c3e50; margin-bottom: 10px; }}
        .subTitle {{ font-size: 22px; color: #7f8c8d; margin-bottom: 40px; }}
        canvas {{ margin: 20px 0; border: 12px solid #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 12px; }}
        .footer {{ font-size: 16px; color: #95a5a6; margin-top: 40px; font-style: italic; }}
        @media print {{ body {{ background: none; }} .page {{ page-break-after: always; height: 100vh; box-shadow: none; padding: 0; }} }}
    </style>
</head>
<body>
    <div id="pagesContainer"></div>
    <script>
        const tableCount = {tableCount};
        const baseUrl = "{baseUrl}";
        const restaurantId = {restaurantId};
        const container = document.getElementById("pagesContainer");

        for (let i = 1; i <= tableCount; i++) {{
            let url = baseUrl;
            if (url.includes("tableNum=")) {{
                url += i;
            }} else if (url.endsWith("/")) {{
                url += "?restaurantId=" + restaurantId + "&tableNum=" + i;
            }} else {{
                url += "&tableNum=" + i;
            }}

            const pageDiv = document.createElement("div");
            pageDiv.className = "page";
            pageDiv.innerHTML = `
                <div class="header">{restaurantName}</div>
                <div class="tableName">Table ${{i}}</div>
                <div class="subTitle">Scan QR Code to View Menu & Order</div>
                <canvas id="qrCanvas_${{i}}"></canvas>
                <div class="footer">Table #${{i}} • Page ${{i}} of ${{tableCount}}</div>
            `;
            container.appendChild(pageDiv);

            setTimeout(() => {{
                QRCode.toCanvas(document.getElementById(`qrCanvas_${{i}}`), url, {{ width: 300, margin: 2 }}, function (error) {{
                    if (error) console.error(error);
                }});
            }}, 50);
        }}
    </script>
</body>
</html>"""
        return Response(content=htmlContent, media_type="text/html")

app.mount("/menu", StaticFiles(directory=PROJECT_ROOT / "customerPanel", html=True), name="customer")
app.mount("/kitchen", StaticFiles(directory=PROJECT_ROOT / "kitchenPanel", html=True), name="kitchen")
app.mount("/management", StaticFiles(directory=PROJECT_ROOT / "managementPanel", html=True), name="management")

if __name__ == "__main__":
    import uvicorn
    hostIp = os.getenv("HOST_IP", "0.0.0.0")
    portNum = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=hostIp, port=portNum)
