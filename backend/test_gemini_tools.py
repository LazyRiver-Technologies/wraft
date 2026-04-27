import google.generativeai as genai

tool = {
    "name": "notify_owner",
    "description": "Notify the business owner",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "reason": {
                "type": "STRING",
                "description": "Why owner needs to be notified"
            }
        },
        "required": ["reason"]
    }
}

try:
    from google.generativeai.types import content_types
    lib = content_types.to_function_library([tool])
    print("SUCCESS with OBJECT/STRING")
except Exception as e:
    print(f"FAILED with OBJECT/STRING: {e}")

tool2 = {
    "name": "notify_owner",
    "description": "Notify the business owner",
    "parameters": {
        "type": content_types.Type.OBJECT,
        "properties": {
            "reason": {
                "type": content_types.Type.STRING,
                "description": "Why owner needs to be notified"
            }
        },
        "required": ["reason"]
    }
}
try:
    lib = content_types.to_function_library([tool2])
    print("SUCCESS with content_types.Type")
except Exception as e:
    print(f"FAILED with content_types.Type: {e}")
