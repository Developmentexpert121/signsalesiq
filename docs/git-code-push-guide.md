# Git Code Push Guide

A practical guide for pushing code changes to a Git repository using the Git command line.

---

## 1. Prerequisites

Before pushing code, make sure:

- **Git is installed** — verify with `git --version`
- **You have a configured identity:**
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"
  ```
- **You have access** to the remote repository (HTTPS credentials, SSH key, or a personal access token).

---

## 2. Check the Current State

Before making changes, see what's going on in your working tree.

```bash
git status            # Files changed, staged, untracked
git branch            # Current branch (marked with *)
git log --oneline -5  # Last 5 commits
```

---

## 3. Create or Switch to a Branch

Always work on a feature branch — never push directly to `main` unless that's your team's convention.

```bash
# Create and switch to a new branch
git checkout -b feature/my-change

# Or switch to an existing branch
git checkout feature/my-change
```

---

## 4. Stage Your Changes

Tell Git which files you want to include in the next commit.

```bash
git add path/to/file.ts        # Stage a single file
git add src/                   # Stage everything in a folder
git add .                      # Stage all changes in the current directory
git add -p                     # Interactively choose hunks to stage
```

Verify what's staged:

```bash
git status
git diff --staged
```

---

## 5. Commit Your Changes

Group related changes into a single commit with a clear, descriptive message.

```bash
git commit -m "Fix login redirect after session expiry"
```

For longer messages with a body:

```bash
git commit
# Opens your editor — write a short subject line, blank line, then details
```

**Good commit message guidelines:**
- Subject line under 72 characters, written in the imperative ("Fix bug" not "Fixed bug")
- Explain *why*, not just *what*
- Reference issue/ticket numbers when relevant (e.g., `Fixes #142`)

---

## 6. Pull the Latest Remote Changes

Before pushing, sync with the remote to avoid conflicts.

```bash
git pull --rebase origin main
```

If conflicts appear:
1. Open the conflicted files — Git marks them with `<<<<<<<`, `=======`, `>>>>>>>`.
2. Edit to resolve, then:
   ```bash
   git add <resolved-files>
   git rebase --continue
   ```
3. To abort the rebase: `git rebase --abort`

---

## 7. Push to the Remote

Send your commits to the remote repository.

```bash
# First push of a new branch — sets upstream tracking
git push -u origin feature/my-change

# Subsequent pushes
git push
```

---

## 8. Open a Pull Request

After pushing, open a pull request (PR) or merge request (MR) in your hosting platform (GitHub, GitLab, Bitbucket, etc.):

1. Visit the repository in your browser
2. Click **"Compare & pull request"** (or equivalent)
3. Add a description, reviewers, and labels
4. Submit the PR

---

## 9. Common Commands Cheat Sheet

| Action | Command |
|---|---|
| See changes | `git status` / `git diff` |
| Discard unstaged changes in a file | `git checkout -- <file>` |
| Unstage a file | `git restore --staged <file>` |
| Amend the last commit | `git commit --amend` |
| View remote URLs | `git remote -v` |
| Add a remote | `git remote add origin <url>` |
| Fetch without merging | `git fetch` |
| See commit history | `git log --oneline --graph --all` |
| Delete a local branch | `git branch -d <branch>` |
| Delete a remote branch | `git push origin --delete <branch>` |

---

## 10. Troubleshooting

**"Updates were rejected because the remote contains work you do not have locally"**
→ Run `git pull --rebase origin <branch>` and push again.

**"Permission denied (publickey)"**
→ Your SSH key isn't set up. Add your public key to your Git host, or switch to HTTPS.

**Pushed the wrong commit**
→ Use `git revert <commit-sha>` to create a new commit that undoes it (safe).
→ Avoid `git push --force` on shared branches; use `--force-with-lease` if you must.

**Accidentally committed secrets**
→ Rotate the secret immediately. Then remove from history with `git filter-repo` or BFG Repo-Cleaner, and force-push (after coordinating with your team).

---

## 11. Recommended Daily Workflow

```bash
git checkout main
git pull
git checkout -b feature/my-change
# ... edit files ...
git add .
git commit -m "Short, clear message"
git pull --rebase origin main
git push -u origin feature/my-change
# Open a PR in your Git host
```

That's it — happy pushing!
