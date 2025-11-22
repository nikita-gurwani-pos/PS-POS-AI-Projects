# Merchant Health Dashboard - Frontend

A beautiful, interactive React-based frontend for the Merchant Health Dashboard with AI-powered chatbot integration.

## Features

- 🎨 **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- 📊 **Interactive Dashboards**: Real-time merchant health monitoring
- 🔍 **Advanced Search**: Search and filter merchants by organization code
- ⏱️ **Time Filters**: Multiple time range filters (30d, 7d, 1d, 6h, 1hr, 10m, 1m)
- 📈 **Transaction Timeline**: Recent transaction history with status indicators
- 📉 **Trend Analysis**: Hourly volume charts and day-over-day comparisons
- 🤖 **AI Chatbot**: Context-aware chatbot on every screen using MCP integration
- 🔐 **Authentication**: Secure JWT-based authentication
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Recharts** - Chart library for data visualization
- **Axios** - HTTP client
- **Lucide React** - Icon library
- **date-fns** - Date formatting utilities

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- Backend API running on `http://localhost:3001`

### Installation

1. Navigate to the frontend directory:
```bash
cd merchant-health-dashboard/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, defaults are set):
```env
VITE_API_URL=http://localhost:3001
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable components
│   │   └── Chatbot.tsx   # AI chatbot component
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── pages/            # Page components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   └── MerchantDetail.tsx
│   ├── services/         # API services
│   │   └── api.ts
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Key Components

### Dashboard
- Main merchant listing with health status
- Search and time filtering
- Real-time data refresh
- Eye icon button to view detailed analytics

### Merchant Detail
- Transaction timeline with status indicators
- Trend analysis with hourly volume charts
- Today vs Yesterday comparison
- Coralogix log insights powered by MCP

### Chatbot
- Available on every screen
- Context-aware responses
- Uses MCP (Model Context Protocol) for intelligent answers
- Beautiful floating UI with message history

## API Integration

The frontend integrates with the following backend endpoints:

- `/api/auth/login` - Authentication
- `/api/merchants` - Get merchant list
- `/api/merchants/filter` - Search merchants
- `/api/dashboard/overview` - Dashboard overview
- `/api/dashboard/transactions/timeline` - Transaction timeline
- `/api/dashboard/trends` - Trend analysis
- `/api/coralogix/prompt` - AI chatbot queries
- `/api/coralogix/prompt/org/summary/:orgCode` - Organization summary

## Development

### Running in Development Mode

```bash
npm run dev
```

### Linting

```bash
npm run lint
```

### Type Checking

TypeScript will automatically check types during development and build.

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: `http://localhost:3001`)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT

