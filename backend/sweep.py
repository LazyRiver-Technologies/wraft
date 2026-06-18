import glob

files = glob.glob("routers/*.py") + glob.glob("services/*.py")
for f in files:
    with open(f) as file:
        lines = file.readlines()
        for i, line in enumerate(lines):
            if "data[0]" in line:
                print(f"--- {f}:{i+1} ---")
                print("".join(lines[max(0, i-2):i+1]))
