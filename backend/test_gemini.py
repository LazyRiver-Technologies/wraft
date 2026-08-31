import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client()

models_to_test = ["gemini-3.7-flash", "gemini-2.5-flash"]

for model_name in models_to_test:
    try:
        print(f"Testing model: {model_name}")
        response = client.models.generate_content(
            model=model_name,
            contents="Say hello!"
        )
        print(f"Success with {model_name}: {response.text}")
    except Exception as e:
        print(f"Error with {model_name}: {e}")
