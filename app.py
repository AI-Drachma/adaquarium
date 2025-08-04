import os
import asyncio
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import mimetypes
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from blockfrost import BlockFrostApi, ApiUrls, ApiError
from dotenv import load_dotenv
from datetime import datetime
import uvicorn


load_dotenv()

# Set up proper MIME types
mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('video/mp4', '.mp4')

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/resources", StaticFiles(directory="resources"), name="resources")
templates = Jinja2Templates(directory="templates")
clients = set()

BLOCKFROST_API_KEY = os.getenv("BLOCKFROST_API_KEY")
if not BLOCKFROST_API_KEY:
    print("❌ WARNING: BLOCKFROST_API_KEY not found in environment variables")
    print("   Please set BLOCKFROST_API_KEY in your Render dashboard")
    api = None
else:
    api = BlockFrostApi(project_id=BLOCKFROST_API_KEY, base_url=ApiUrls.preprod.value)

# Determine sea creature type
def classify_creature(ada_amount):
    if ada_amount < 100:
        return "shrimp"
    elif ada_amount < 1000:
        return "crab"
    elif ada_amount < 3000:
        return "octopus"
    elif ada_amount < 10000:
        return "fish"
    elif ada_amount < 40000:
        return "tuna"
    elif ada_amount < 100000:
        return "dolphin"
    elif ada_amount < 300000:
        return "shark"
    else:
        return "whale"

# Fetch address info with ADA
async def fetch_address_info(address):
    if not api:
        return {"address": address, "ada": 100, "type": "fish"}  # Default fallback
    try:
        info = api.address(address)
        ada = 0
        for a in info.amount:
            if a.unit == 'lovelace':
                ada += int(a.quantity)
        ada = ada / 1_000_000
        return {"address": address, "ada": ada, "type": classify_creature(ada)}
    except ApiError as e:
        print(f"Error fetching address {address}: {e}")
        return None

# Disabled automatic polling since we're using search mode only
# @app.on_event("startup")
# async def start_polling():
#     print("🟢 Polling started")
#     asyncio.create_task(poll_chain())

latest_block_data = None

async def poll_chain():
    global latest_block_data
    last_sent_height = None

    while True:
        try:
            latest_block = api.block_latest()
            current_height = latest_block.height
        except Exception as e:
            print("❌ Failed to fetch latest block:", e)
            await asyncio.sleep(10)
            continue

        if last_sent_height is None or current_height > last_sent_height:
            blocks_data = []
            for height in range(current_height - 2, current_height + 1):
                try:
                    block = api.block(height)
                    print(f"📦 Processing block {height}")
                    txs = api.block_transactions(block.hash)
                    address_tx_map = {}
                    for tx in txs:
                        try:
                            utxos = api.transaction_utxos(tx)
                            # Calculate total output more safely
                            total_output = 0
                            for o in utxos.outputs:
                                for amount in o.amount:
                                    if amount.unit == 'lovelace':
                                        total_output += int(amount.quantity)
                            total_output = total_output / 1_000_000
                            
                            for i in utxos.inputs:
                                if i.address not in address_tx_map:
                                    address_tx_map[i.address] = {"tx_id": tx, "amount": total_output}
                        except:
                            continue
                    creatures = []
                    for addr in list(address_tx_map.keys())[:5]:
                        info = await fetch_address_info(addr)
                        if info:
                            info['y'] = int(10 + 80 * os.urandom(1)[0] / 255)
                            info['transaction_id'] = address_tx_map[addr]["tx_id"]
                            info['amount_transferred'] = address_tx_map[addr]["amount"]
                            creatures.append(info)
                    blocks_data.append({"height": height, "creatures": creatures})
                except Exception as e:
                    print("❌ Error during block parsing:", e)

            if blocks_data:
                latest_block_data = blocks_data[-1]
                for ws in clients.copy():
                    try:
                        await ws.send_json({"blocks": blocks_data})
                    except:
                        clients.remove(ws)

            last_sent_height = current_height

        await asyncio.sleep(10)

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    print("🔌 WebSocket connected")
    try:
        while True:
            await ws.receive_text()
    except:
        clients.remove(ws)

@app.api_route("/", methods=["GET", "HEAD"])
async def homepage(request: Request):
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        print(f"Error rendering homepage: {e}")
        return HTMLResponse(f"<h1>Error loading page: {e}</h1><p>Check server logs for details.</p>")

@app.get("/latest")
async def latest_block():
    if not api:
        return {"height": 3744495}  # Fallback block number
    try:
        # Get the actual latest block from Blockfrost API
        latest_block = api.block_latest()
        return {"height": latest_block.height}
    except Exception as e:
        print(f"❌ Error fetching latest block from API: {e}")
        # Return the cached data if available, otherwise empty
        return latest_block_data if latest_block_data else {}

@app.get("/block/{height}")
async def get_block(height: int):
    if not api:
        return {"error": "API not configured - please set BLOCKFROST_API_KEY"}
    try:
        block = api.block(height)
        print(f"📦 Querying block {height}")
        txs = api.block_transactions(block.hash)
        print(f"Found {len(txs)} transactions in block {height}")
        
        address_tx_map = {}
        for tx in txs:
            try:
                utxos = api.transaction_utxos(tx)
                # Calculate total output more safely
                total_output = 0
                for o in utxos.outputs:
                    for amount in o.amount:
                        if amount.unit == 'lovelace':
                            total_output += int(amount.quantity)
                total_output = total_output / 1_000_000
                
                # Collect sender and receiver addresses separately
                sender_addresses = set()
                receiver_addresses = set()
                
                for i in utxos.inputs:
                    sender_addresses.add(i.address)
                for o in utxos.outputs:
                    receiver_addresses.add(o.address)
                
                # Store addresses with their role (sender/receiver) and counterparty info
                sender_list = list(sender_addresses)
                receiver_list = list(receiver_addresses)
                
                # Process all addresses and track their roles
                all_addresses = sender_addresses.union(receiver_addresses)
                
                for addr in all_addresses:
                    if addr not in address_tx_map:
                        address_tx_map[addr] = {
                            "tx_id": tx,
                            "amount": total_output,
                            "roles": [],
                            "sent_to": [],
                            "received_from": []
                        }
                    
                    # Check if this address only transacts with itself
                    sent_to_others = [r for r in receiver_list if r != addr]
                    received_from_others = [s for s in sender_list if s != addr]
                    
                    # Special case: only self-transactions
                    if addr in sender_addresses and addr in receiver_addresses and not sent_to_others and not received_from_others:
                        if "self" not in address_tx_map[addr]["roles"]:
                            address_tx_map[addr]["roles"].append("self")
                    else:
                        # Add sender role and recipients
                        if addr in sender_addresses and sent_to_others:
                            if "sender" not in address_tx_map[addr]["roles"]:
                                address_tx_map[addr]["roles"].append("sender")
                            # Add receivers as "sent to" (excluding self)
                            for receiver_addr in sent_to_others:
                                if receiver_addr not in address_tx_map[addr]["sent_to"]:
                                    address_tx_map[addr]["sent_to"].append(receiver_addr)
                        
                        # Add receiver role and senders (only if receiving from different addresses)
                        if addr in receiver_addresses and received_from_others:
                            if "receiver" not in address_tx_map[addr]["roles"]:
                                address_tx_map[addr]["roles"].append("receiver")
                            # Add senders as "received from" (excluding self)
                            for sender_addr in received_from_others:
                                if sender_addr not in address_tx_map[addr]["received_from"]:
                                    address_tx_map[addr]["received_from"].append(sender_addr)
            except Exception as tx_error:
                print(f"Error processing transaction {tx}: {tx_error}")
                continue
                
        print(f"Found {len(address_tx_map)} unique addresses")
        creatures = []
        for addr in list(address_tx_map.keys()):
            info = await fetch_address_info(addr)
            if info:
                info['y'] = int(10 + 80 * os.urandom(1)[0] / 255)
                info['transaction_id'] = address_tx_map[addr]["tx_id"]
                info['amount_transferred'] = address_tx_map[addr]["amount"]
                
                # Set role based on what roles this address has
                roles = address_tx_map[addr]["roles"]
                if len(roles) == 1:
                    info['role'] = roles[0]
                elif len(roles) > 1:
                    info['role'] = "/".join(sorted(roles))  # "receiver/sender" or "sender/receiver"
                else:
                    info['role'] = "unknown"
                
                # Get info about addresses they sent to
                sent_to_info = []
                for sent_addr in address_tx_map[addr]["sent_to"][:3]:  # Limit to first 3
                    sent_data = await fetch_address_info(sent_addr)
                    if sent_data:
                        sent_to_info.append({
                            'address': sent_addr,
                            'ada': sent_data['ada'],
                            'type': sent_data['type']
                        })
                info['sent_to_info'] = sent_to_info
                
                # Get info about addresses they received from
                received_from_info = []
                for received_addr in address_tx_map[addr]["received_from"][:3]:  # Limit to first 3
                    received_data = await fetch_address_info(received_addr)
                    if received_data:
                        received_from_info.append({
                            'address': received_addr,
                            'ada': received_data['ada'],
                            'type': received_data['type']
                        })
                info['received_from_info'] = received_from_info
                
                creatures.append(info)
        
        print(f"Created {len(creatures)} creatures:")
        for creature in creatures:
            print(f"  - {creature['type']} with {creature['ada']:.2f} ADA ({creature['role']})")
        return {"height": height, "creatures": creatures}
    except Exception as e:
        print(f"❌ Error querying block {height}:", e)
        return {"error": f"Block {height} not found"}

# Alternative route for serving images if static mounting fails on some platforms
@app.get("/img/{filename}")
async def serve_image_fallback(filename: str):
    """Fallback image serving endpoint"""
    import os
    from fastapi.responses import FileResponse
    
    file_path = os.path.join("resources", "images", filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    else:
        return {"error": f"Image {filename} not found"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
