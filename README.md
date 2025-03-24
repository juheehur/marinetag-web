# MarineTag Web

MarineTag is a web application for identifying and cataloging fish species using AI. Upload fish photos and get instant species identification with detailed information.

## Features

- 🐠 AI-powered fish species identification
- 📱 Mobile-friendly responsive design
- 🌍 Multi-language support (Korean, English, Chinese)
- 📍 Location tracking for habitat information
- 🖼️ Photo gallery with sharing capabilities

## Tech Stack

- React Native Web / Expo
- Supabase
- OpenAI Vision API
- i18next for internationalization

## Environment Variables

Required environment variables:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

## Development

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm start

# Build for web
npm run build
```

## License

MIT 