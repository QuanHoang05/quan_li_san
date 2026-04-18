
import requests
import json

def test_court_final():
    base_url = "http://localhost:8000/api/v1"
    
    # 1. Create a court with Vietnamese type
    court_data = {
        "name": "Sân Cầu Lông 1",
        "type": "Cầu lông",
        "price_per_hour": 120000.0,
        "deposit_price": 40000.0
    }
    
    print("Testing CREATE with Vietnamese type...")
    try:
        resp = requests.post(f"{base_url}/courts", json=court_data)
        if resp.status_code != 200:
            print(f"CREATE FAILED: {resp.text}")
            return
        
        court_id = resp.json()["id"]
        print(f"Created court ID: {court_id}")
        
        # 2. Update the court with different Vietnamese type
        update_data = {
            "name": "Sân Pickleball 1",
            "type": "Pickleball",
            "price_per_hour": 180000.0,
            "deposit_price": 60000.0
        }
        print("\nTesting UPDATE with new values...")
        resp = requests.put(f"{base_url}/courts/{court_id}", json=update_data)
        if resp.status_code != 200:
            print(f"UPDATE FAILED: {resp.text}")
            return
        
        updated_court = resp.json()
        print(f"Updated court: {updated_court}")
        
        # Verify values
        if (updated_court["type"] == "Pickleball" and 
            updated_court["deposit_price"] == 60000.0 and 
            updated_court["price_per_hour"] == 180000.0):
            print("VERIFICATION SUCCESS: All fields saved correctly.")
        else:
            print("VERIFICATION FAILED: Data mismatch.")

        # 3. Test Delete
        print("\nTesting DELETE...")
        resp = requests.delete(f"{base_url}/courts/{court_id}")
        if resp.status_code == 200:
            print("DELETE SUCCESS")
        else:
            print(f"DELETE FAILED: {resp.text}")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    test_court_final()
