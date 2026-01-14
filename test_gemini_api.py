import requests
import json

# Your API key
API_KEY = "AIzaSyDwxP9c6LFGUxApU6OD7f6OJyBA1VvIAQk"

# Test the API with a simple request
def test_gemini_api():
    # Try different API versions and model names
    test_configs = [
        ("v1beta", "gemini-2.0-flash-exp"),
        ("v1", "gemini-2.0-flash-exp"),
        ("v1beta", "gemini-exp-1206"),
        ("v1", "gemini-exp-1206"),
    ]
    
    for api_version, model in test_configs:
        print(f"\n{'='*60}")
        print(f"Testing: {api_version} / {model}")
        print('='*60)
        
        url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model}:generateContent?key={API_KEY}"
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": "Hello! Can you respond with a simple greeting?"
                }]
            }]
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            print(f"Status Code: {response.status_code}")
            
            if response.ok:
                data = response.json()
                print("✅ Success! This configuration works.")
                
                # Extract the text response
                if 'candidates' in data and len(data['candidates']) > 0:
                    text = data['candidates'][0]['content']['parts'][0]['text']
                    print(f"\n📝 AI Response:")
                    print(text)
                    print(f"\n✅ Use: API={api_version}, Model={model}")
                    return (api_version, model)
            else:
                error_msg = response.json().get('error', {}).get('message', 'Unknown error')
                print(f"❌ Failed: {error_msg[:100]}...")
                
        except Exception as e:
            print(f"❌ Exception: {e}")
    
    print("\n❌ None of the configurations worked!")
    return None

if __name__ == "__main__":
    test_gemini_api()
