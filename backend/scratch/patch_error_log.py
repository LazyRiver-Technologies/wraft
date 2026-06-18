import os
import sys

filepath = 'routers/onboarding.py'
with open(filepath, 'r') as f:
    content = f.read()

replacement = """
    except Exception as e:
        import traceback
        with open('error_log.txt', 'a') as ef:
            ef.write(traceback.format_exc() + "\\n")
        if "23505" in str(e) or "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="A bot with this URL slug already exists. Please choose another.")
        raise HTTPException(status_code=500, detail=f"An error occurred during setup: {str(e)}")
"""

target = """
    except Exception as e:
        import traceback
        traceback.print_exc()
        if "23505" in str(e) or "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="A bot with this URL slug already exists. Please choose another.")
        raise HTTPException(status_code=500, detail=f"An error occurred during setup: {str(e)}")
"""

if target in content:
    with open(filepath, 'w') as f:
        f.write(content.replace(target, replacement))
    print("Patched successfully")
else:
    print("Target not found")
