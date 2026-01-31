# Jira Filters Automation (Playwright JS)


## Prerequisites
- Node.js 18+ recommended
- A Jira Cloud instance accessible via browser
- A Jira user account with permission to create filters

> Note: If your org uses SSO/MFA, UI automation login may need an alternate approach (stored auth state, or test account).

## Setup
```bash
npm install
npm run install:chromium
npm run test:jira-simple 
