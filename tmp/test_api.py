
import requests
import json

def test_court_crud():
    base_url = "http://localhost:8000/api/v1"
    
    # 1. Create a court
    court_data = {
        "name": "Test Court 1",
        "type": "Cầu Lông",
        "price_per_hour": 150000.0,
        "deposit_price": 50000.0
    }
    
    print("Testing CREATE...")
    try:
        resp = requests.post(f"{base_url}/courts", json=court_data)
        print(f"CREATE status: {resp.status_code}")
        print(f"CREATE response: {resp.text}")
        if resp.status_code != 200:
            print("CREATE FAILED")
            return
        
        court_id = resp.json()["id"]
        
        # 2. Update the court
        update_data = {
            "name": "Test Court 1 Updated",
            "type": "Pickleball",
            "price_per_hour": 200000.0,
            "deposit_price": 70000.0
        }
        print("\nTesting UPDATE...")
        resp = requests.put(f"{base_url}/courts/{court_id}", json=update_data)
        print(f"UPDATE status: {resp.status_code}")
        print(f"UPDATE response: {resp.text}")
        
        # 3. Get all courts to verify update
        print("\nTesting GET ALL...")
        resp = requests.get(f"{base_url}/courts")
        courts = resp.json()
        found = False
        for c in courts:
            if c["id"] == court_id:
                print(f"Found court: {c}")
                if c["deposit_price"] == 70000.0:
                    print("DEPOSIT PRICE SAVED CORRECTLY")
                else:
                    print(f"DEPOSIT PRICE MISMATCH: expected 70000.0, got {c.get('deposit_price')}")
                found = True
        if not found:
            print("Court not found in GET ALL")

        # 4. Delete the court
        print("\nTesting DELETE...")
        resp = requests.delete(f"{base_url}/courts/{court_id}")
        print(f"DELETE status: {resp.status_code}")
        print(f"DELETE response: {resp.text}")
        
        # 5. Verify it's gone (soft delete)
        resp = requests.get(f"{base_url}/courts")
        courts = resp.json()
        if any(c["id"] == court_id for c in courts):
            print("ERROR: Court still present after soft delete")
        else:
            print("Soft delete verified (not in active list)")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    test_court_crud()
