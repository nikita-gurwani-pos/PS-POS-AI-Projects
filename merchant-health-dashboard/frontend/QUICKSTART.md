# Quick Start Guide

## Installation & Setup

1. **Navigate to frontend directory:**
   ```bash
   cd merchant-health-dashboard/frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Prerequisites

- Make sure the backend API is running on `http://localhost:3001`
- Node.js 18.x or later installed
- Backend API should have CORS configured to allow requests from `http://localhost:3000`

## Features Overview

### 🏠 Dashboard Page
- View all merchants with health status
- Search merchants by organization code
- Filter by time ranges (30d, 7d, 1d, 6h, 1hr, 10m, 1m)
- Click the eye icon to view detailed analytics

### 📊 Merchant Detail Page
- **Recent Transaction Timeline**: See recent transactions with status, amount, and response times
- **Trend Analysis**: Hourly volume charts and today vs yesterday comparison
- **Coralogix Insights**: AI-powered log insights using MCP
- **Overview Metrics**: Success rate, average response time, error counts

### 🤖 AI Chatbot
- Available on every screen (floating button in bottom-right)
- Context-aware responses based on current page
- Ask questions about:
  - Transaction status
  - Merchant health
  - System performance
  - Error analysis
  - Any other dashboard-related queries

## Default Login Credentials

Use the credentials configured in your backend authentication system.

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, Vite will automatically use the next available port. Check the terminal output for the actual port.

### API Connection Issues
- Verify backend is running on port 3001
- Check CORS configuration in backend
- Verify JWT token is being stored in localStorage after login

### TypeScript Errors
After running `npm install`, TypeScript errors should resolve. If they persist:
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Restart your IDE/editor

## Building for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

