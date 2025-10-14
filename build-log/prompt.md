# Session Summary Generator

This prompt generates session summaries for development sessions to track progress, technical decisions, and outcomes.

## Instructions

Write a summary of the session to a file named `build-log/YYYY-MM-DD.md` (e.g., `build-log/2025-10-14.md`).

If a file for today's date already exists, append to it with a new session section.

Get the user's email address using `git config user.email` and include it in the session header.

## Placeholder Definitions

Replace the following placeholders with actual content:
- `<session_title/>` - Brief descriptive title of what was accomplished (e.g., "Implement User Authentication", "Fix Database Migration Issues")
- `<user_email/>` - The user's email from git config (retrieved via `git config user.email`)
- `<summary/>` - Detailed summary covering what was done, why, and the outcome
- `<prompt/>` - The original prompt(s) or request(s) that initiated the work

## Summary Template

Follow this structure:

<example>
# <session_title/>

**Author**: <user_email/>

## Summary

<summary/>

## Changes Made

- **Files Modified**: List key files that were changed
- **Files Created**: List new files added
- **Files Deleted**: List files removed
- **Infrastructure Modified**: List infrastructure modified in System Initiative
- **Infrastructure Created**: List infrastructure created in System Initiative
- **Infrastructure Deleted**: List infrastructure deleted in System Initiative

## Technical Decisions

<technical_decisions/>

Key decisions made during the session and their rationale.

## Issues Encountered

<issues/>

Problems faced and how they were resolved.

## Prompts

```prompt
<prompt/>
```

## Next Steps

<next_steps/>

Outstanding tasks or follow-up work needed.
</example>

## Best Practices

- Keep summaries concise but informative
- Focus on the "why" behind decisions, not just the "what"
- Include enough context for future reference
- Link to relevant documentation or resources when applicable
- Use bullet points for clarity
