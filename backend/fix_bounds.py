import re
import glob

files = glob.glob("routers/*.py")
for f in files:
    with open(f, "r") as file:
        content = file.read()
    
    # We want to replace patterns like:
    # new_bot = insert_res.data[0]
    # with:
    # if not insert_res.data: raise HTTPException(status_code=500, detail="Database operation failed")
    # new_bot = insert_res.data[0]
    
    # Let's just do targeted string replacements for safety
    replacements = [
        ("new_bot = insert_res.data[0]", "if not insert_res.data: raise HTTPException(status_code=500, detail='Failed to create bot')\n    new_bot = insert_res.data[0]"),
        ("new_bot = bot_res.data[0]", "if not bot_res.data: raise HTTPException(status_code=500, detail='Failed to fetch bot')\n        new_bot = bot_res.data[0]"),
        ("new_source = insert_res.data[0]", "if not insert_res.data: raise HTTPException(status_code=500, detail='Failed to create source')\n    new_source = insert_res.data[0]"),
        ("return insert_res.data[0]", "if not insert_res.data: raise HTTPException(status_code=500, detail='Failed to insert data')\n        return insert_res.data[0]"),
        ("return upd_res.data[0]", "if not upd_res.data: raise HTTPException(status_code=404, detail='Not found')\n    return upd_res.data[0]"),
        ("data = insert_res.data[0]", "if not insert_res.data: raise HTTPException(status_code=500, detail='Failed to insert')\n    data = insert_res.data[0]"),
        ("data = res.data[0]", "if not res.data: raise HTTPException(status_code=404, detail='Not found')\n    data = res.data[0]"),
        ("return res.data[0]", "if not res.data: raise HTTPException(status_code=404, detail='Not found')\n    return res.data[0]"),
        ("qa_id = existing_qa.data[0][\"id\"]", "qa_id = existing_qa.data[0][\"id\"]"), # handled by if block already
        ("qa_id = inserted_qa.data[0][\"id\"]", "if not inserted_qa.data: raise HTTPException(status_code=500, detail='Failed to insert QA')\n            qa_id = inserted_qa.data[0][\"id\"]"),
        ("source = source_res.data[0]", "source = source_res.data[0]") # handled by if block
    ]
    
    new_content = content
    for old, new in replacements:
        if "if not" not in old: # just a precaution
            new_content = new_content.replace(old, new)
            
    if new_content != content:
        if "HTTPException" not in new_content:
             new_content = "from fastapi import HTTPException\n" + new_content
        with open(f, "w") as file:
            file.write(new_content)
        print(f"Fixed {f}")
        
