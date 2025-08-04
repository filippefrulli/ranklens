# RankLens

A modern web application built with SvelteKit, Tailwind CSS, and Supabase.

## 🚀 Tech Stack

- **Framework**: SvelteKit with TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL database + Auth)
- **Build Tool**: Vite

## 🛠️ Setup

### Prerequisites
- Node.js (v22+ recommended)
- npm or yarn

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Update the `.env` file with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Create a production build:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## 📁 Project Structure

```
src/
├── lib/
│   ├── supabase.ts      # Supabase client configuration
│   └── Counter.svelte   # Example component
├── App.svelte           # Main app component
├── app.css             # Global styles (Tailwind directives)
└── main.ts             # App entry point
```

## 🔧 Configuration

- **Tailwind CSS**: Configuration in `tailwind.config.js`
- **PostCSS**: Configuration in `postcss.config.js`
- **TypeScript**: Configuration in `tsconfig.json`
- **Svelte**: Configuration in `svelte.config.js`

## 📝 Features

- ⚡ Fast development with Vite HMR
- 🎨 Responsive design with Tailwind CSS
- 🔒 Database and authentication ready with Supabase
- 📱 Mobile-first responsive design
- 🌙 Type-safe development with TypeScript
- 🧩 Component-based architecture

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
