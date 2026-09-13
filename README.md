~ Restaraunt Modernizer

 A very lightweight program that can manage 3 panels to provide the user a full digital restaraunt.

---

~ Installation/admin usage

- Install Docker Engine + Docker Compose on the machine.

- Clone the project, then enter it:
  
  ```
  git clone https://github.com/wiiuavi/restaurantModernizer.git
  cd restaurantModernizer
  ```

- Create a .env file in the project root:
  
  ```
  DEMO_MODE=false
  ADMIN_PIN=6767
  CHEF_PIN=6767
  RESTAURANT_NAME=My Restaurant
  THEME_PRIMARY=~42aef5
  THEME_SECONDARY=~6fd29d
  THEME_BACKGROUND=~111417
  ```
  
  - *The pin can consist of numbers, letters and symbols. The theme represent a default darktheme.*

- Start the thing:
  
  ```
  sudo docker compose -f docker-compose.oracle.yml up -d --build
  ```

- Open TCP port 80 in the host firewall. The app will be available at:
  
  - `/menu/?restaurantId=1&tableNum=1`
  - `/kitchen/?restaurantId=1`
  - `/management/?restaurantId=1`
  - `/demo/`

- Log into the management panel using ADMIN_PIN. Add/edit menu items, prices, descriptions, tags, images, and orders there. Changes are stored in Dockers named restaurant_data volume and survive normal rebuilds/recreates.

- To enable demo mode, change .env:
  
  ```
  DEMO_MODE=true
  ```
  
  Then recreate the container:
  
  ```
  sudo docker compose -f docker-compose.oracle.yml up -d --force-recreate
  ```

- To update the application source later:
  
  ```
  git pull
  sudo docker compose -f docker-compose.oracle.yml up -d --build
  ```
  
  Do not run `docker compose down -v` , this **WILL erase** the saved database.

- To edit the UI directly:
  
  - Customer menu: `customerPanel/`
  - Kitchen panel: `kitchenPanel/`
  - Management panel: `managementPanel/`
  - Landing/demo page: `demopage/`
  - API/database server: `masterServer/masterServer.py`
  
  After, run the build command again.

~ Usage

- The Digital Menu (e.g.`/menu/?restaurantId=1&tableNum=1`) allows users to order items, adding items to their cart and being able to change the number of item or adding any notes. Items can be searched for by name, or filtered through by tag.
  
  - *In demo mode, special notes can not be made.*
  
  - *This program will **NOT** handle payments, merely inform the user of the cost.*
  
  - *The URL for the menu will differ across tables. use* `tableNum=1000` *to avoid confusion with real orders*

- The Kitchen panel (e.g. `/kitchen/?restaurantId=1`) allows a quick way to see orders, their notes, and time since order. Clicking on an item can cross it off, maybe as a way to show the item has been prepared. Ingredients can also quickly be marked out of stock. Orders can also be completed, removing them from dashboard.
  
  - *This page requires a pin, default to chef123*
  
  - *In demo mode, the pin is set to "demo"*
- The Management panel (tbh deserves its own page)(e.g. `/management/?restaurantId=1`) acts as a master control. It allows for the addition/removal/editing of items, their prices, desc, tags and image, orders and tags. It also provides data of orders, commonly bought items and other insights, shows previously logged orders, and  where you can get the PDF that shows the QR codes for x tables.
  - *Items require a name, but a description, price, tags and image remain optional.*
  - *Tags can be used to make item filtering easier. They can be used to show allergens or dietary needs (e.g. vegan, halal ect), and can have an associated image*
  - *Items can have multiple tags*
  - *This page requires a pin, default to admin123*
  - *In demo mode, the pin is "demo", and only inputs can be editing/making orders with existing items.*

---

~ Notes

~~ Todos

- add options for diff currencies

- add shortcut buttons for cart/menu (avoid long scrolling to the bottom)

- table 0 for testing

- limits for bogus orders (e.g. 1000 fries)

- warning for alcohols

- colour for text (make displaying offers easier)

~~ Misc

All work done by me, AI was used for code completions, debugging and heavy influence on the docker compose file. The soup icon is the *beetroot soup* asset from minecraft. W marktext for making writing md way too easy

Demo hosted at `http://79.72.72.162/demo/` on an oracle VPS. 
