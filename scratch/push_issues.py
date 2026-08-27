import os
import re
import urllib.request
import urllib.parse
import json

# Configuration
# Replace these or set them as environment variables
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_OWNER = "LazyRiver-Technologies" # Derived from workspace CorpusName
REPO_NAME = "wraft"

ISSUES_FILE = "/Users/siddhanthsadashivraikar/.gemini/antigravity-ide/brain/9fd2f8ce-ab3c-48bc-9015-6e4da6b78a65/github_issues.md"

def parse_issues(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Split content by Issue headers
    issue_sections = re.split(r'### Issue #\d+:\s*', content)[1:]
    
    parsed_issues = []
    for section in issue_sections:
        lines = section.strip().split("\n")
        title = lines[0].strip()
        
        labels = []
        description_lines = []
        capture_desc = False
        
        for line in lines[1:]:
            if line.startswith("**Labels:**"):
                # Extract labels like `backend`, `security` -> ['backend', 'security']
                labels_raw = re.findall(r'`([^`]+)`', line)
                labels = [l.strip() for l in labels_raw]
            elif line.startswith("**Description:**"):
                capture_desc = True
            elif capture_desc:
                description_lines.append(line)
        
        parsed_issues.append({
            "title": title,
            "labels": labels,
            "body": "\n".join(description_lines).strip()
        })
    
    return parsed_issues

def create_github_issue(token, owner, repo, issue):
    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
    }
    
    data = json.dumps({
        "title": issue["title"],
        "body": issue["body"],
        "labels": issue["labels"]
    }).encode("utf-8")
    
    import ssl
    context = ssl._create_unverified_context()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=context) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            print(f"✅ Created issue: {issue['title']} -> {res_data.get('html_url')}")
    except urllib.error.HTTPError as e:
        print(f"❌ Failed to create issue: {issue['title']}. Error: {e.code} - {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"❌ Error occurred: {e}")

def main():
    if not GITHUB_TOKEN:
        print("❌ Error: GITHUB_TOKEN environment variable not set.")
        print("Please run: export GITHUB_TOKEN='your_personal_access_token'")
        return
        
    print(f"Parsing issues from {ISSUES_FILE}...")
    issues = parse_issues(ISSUES_FILE)
    print(f"Found {len(issues)} issues. Pushing to GitHub ({REPO_OWNER}/{REPO_NAME})...")
    
    for issue in issues:
        create_github_issue(GITHUB_TOKEN, REPO_OWNER, REPO_NAME, issue)

if __name__ == "__main__":
    main()
