"""
Wraft Orchestrator — Full Automation Pipeline
Runs the orchestrator for each GitHub issue on its own branch off `dev`.

Usage:
  python3 scripts/run_all_issues.py
"""
import os
import subprocess
import sys

# Add parent dir so we can import the orchestrator
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from orchestrator import build_graph

# ---------------------------------------------------------
# Issue Definitions (from our GitHub Issues audit)
# ---------------------------------------------------------
ISSUES = [
    {
        "branch": "fix/issue-1-pydantic-validation",
        "commit_msg": "fix: add Pydantic validation gates for agent DB writes (#1)",
        "issue_title": "Implement deterministic validation gates for agent database writes",
        "issue_body": (
            "Currently, `backend/services/rag.py` takes raw `fc_args` from the LLM's function_call "
            "response and blindly merges them into `workflow_state` and the `leads` table via "
            "`execute_update_workflow_state`. We need a Pydantic validation layer (using "
            "BaseModel with strict field types) before calling "
            "`db.table('conversations').update(...)` to prevent prompt injection or hallucinated "
            "schema parameters from corrupting the DB. "
            "IMPORTANT: Do NOT rename any existing variables like HARMFUL_PATTERNS. "
            "Do NOT change function signatures of get_rag_response. "
            "Only add a Pydantic BaseModel class for validation and use it inside "
            "execute_update_workflow_state before writing to the database."
        ),
        "issue_labels": ["backend", "security", "p1"],
    },
    {
        "branch": "fix/issue-2-model-agnostic-harness",
        "commit_msg": "refactor: decouple tool execution from Gemini SDK (#2)",
        "issue_title": "Decouple tool execution from Gemini SDK (Model Agnostic Harness)",
        "issue_body": (
            "The tool calling logic in `backend/services/rag.py` is deeply nested inside the Gemini "
            "API response parser (around line 730-770). If the system falls back to Groq/LLaMA-3, "
            "tool calls are completely lost because the Groq path does not parse tool calls at all. "
            "We need a model-agnostic tool parser function (e.g. `extract_tool_calls(response, provider)`) "
            "that can handle both Gemini's `function_call` parts and Groq/OpenAI's "
            "`tool_calls` format on `choices[0].message.tool_calls`. "
            "IMPORTANT: Do NOT remove any existing functionality. Do NOT rename existing variables. "
            "Add new helper functions and integrate them into the existing flow."
        ),
        "issue_labels": ["backend", "architecture", "p2"],
    },
    {
        "branch": "fix/issue-3-structured-observability",
        "commit_msg": "refactor: replace debug_log.txt with structured logging (#3)",
        "issue_title": "Replace local debug_log.txt with structured observability",
        "issue_body": (
            "In `backend/services/rag.py`, there are multiple instances of "
            "`with open('debug_log.txt', 'a', encoding='utf-8') as f: f.write(...)` "
            "which performs synchronous disk I/O on every request. This will crash or slow "
            "down the ASGI server under load. Replace ALL instances of `debug_log.txt` file "
            "writes with proper `logger.debug()` or `logger.info()` calls using Python's "
            "built-in logging module (the logger is already defined at the top of the file). "
            "IMPORTANT: Do NOT change any business logic. Only replace file I/O debug logging "
            "with logger calls. Do NOT rename any variables or change function signatures."
        ),
        "issue_labels": ["backend", "ops", "p2"],
    },
    {
        "branch": "fix/issue-4-action-trigger-ui",
        "commit_msg": "feat: add visual feedback for AI action triggers in chat widget (#4)",
        "issue_title": "Improve UI feedback for Action Triggers (Frontend)",
        "issue_body": (
            "In `frontend/src/app/(dashboard)/dashboard/bots/[botId]/actions/page.tsx`, we have AI Actions "
            "configured, but when the bot triggers them in the chat interface, there is no visual "
            "indicator to the user that a background task (like sending a notification or "
            "calculating a quote) was performed. We need to add toast notifications or inline "
            "status messages in the chat widget component when an action is executed. "
            "Look at the widget chat files under `frontend/src/app/widget/` for the chat UI. "
            "IMPORTANT: Only add new UI feedback components. Do NOT remove existing functionality."
        ),
        "issue_labels": ["frontend", "ux", "p3"],
    },
]

def run_git(cmd: str, cwd: str = ".") -> str:
    """Run a git command and return its output."""
    result = subprocess.run(
        cmd, shell=True, cwd=cwd, capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  ⚠️  Git command failed: {cmd}")
        print(f"     stderr: {result.stderr.strip()}")
    return result.stdout.strip()

def process_issue(issue: dict, app):
    """Process a single issue: branch, orchestrate, commit, push."""
    branch = issue["branch"]
    print(f"\n{'='*60}")
    print(f"📌 Processing: {issue['issue_title'][:60]}...")
    print(f"   Branch: {branch}")
    print(f"{'='*60}")

    # 1. Ensure we are on dev and it's clean
    run_git("git checkout dev")
    run_git("git pull origin dev")

    # 2. Create a fresh branch off dev
    existing = run_git(f"git branch --list {branch}")
    if existing:
        run_git(f"git branch -D {branch}")
    run_git(f"git checkout -b {branch}")
    print(f"  ✅ Created branch: {branch}")

    # 3. Run the orchestrator
    state = {
        "issue_title": issue["issue_title"],
        "issue_body": issue["issue_body"],
        "issue_labels": issue["issue_labels"],
        "retry_count": 0,
    }

    print("  🤖 Running Orchestrator Loop...")
    try:
        for event in app.stream(state):
            pass
    except Exception as e:
        print(f"  ❌ Orchestrator failed: {e}")
        run_git("git checkout dev")
        return False

    # 4. Check if there are changes to commit
    status = run_git("git status --porcelain")
    if not status:
        print("  ⚠️  No files were changed by the orchestrator. Skipping.")
        run_git("git checkout dev")
        return False

    # 5. Stage, commit, and push
    run_git("git add -A")
    run_git(f'git commit -m "{issue["commit_msg"]}"')
    run_git(f"git push origin {branch}")
    print(f"  ✅ Pushed branch: {branch}")
    
    # 6. Switch back to dev
    run_git("git checkout dev")
    return True

def main():
    print("="*60)
    print("🚀 Wraft Automated Issue Resolution Pipeline")
    print("="*60)

    # Build the graph once
    app = build_graph()
    
    results = {}
    for issue in ISSUES:
        success = process_issue(issue, app)
        results[issue["branch"]] = "✅ Success" if success else "❌ Failed/No changes"

    # Summary
    print(f"\n{'='*60}")
    print("📊 SUMMARY")
    print(f"{'='*60}")
    for branch, status in results.items():
        print(f"  {status}  {branch}")
    print(f"\n🎉 All issues processed! Create PRs from these branches into `dev`.")

if __name__ == "__main__":
    main()
