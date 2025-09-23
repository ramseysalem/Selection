# Outfit Matcher

An AI-powered wardrobe management and outfit suggestion system that helps users make the most of their existing clothes.

## Features

- 📸 Easy wardrobe building through photos
- 🤖 AI-powered clothing analysis
- 🌤️ Weather-aware outfit suggestions
- 👔 Occasion-specific recommendations
- 📊 Style learning system
- 🔒 Privacy-focused design
- 📱 Cross-platform (Web + Mobile)

## Tech Stack

### Frontend

- React (Web)
- React Native (Mobile)
- TailwindCSS
- Framer Motion

### Backend

- Node.js with Express
- PostgreSQL
- Redis
- AWS S3/Cloudinary

### AI/ML Services

- OpenAI Vision API
- Claude API/GPT-4
- TensorFlow.js
- Custom ML models

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL
- Redis
- Docker (optional)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/outfit-matcher.git
cd outfit-matcher
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

4. Start the development servers:

```bash
npm start
```

## Project Structure

```
outfit-matcher/
├── server/          # Backend API server
├── web/             # React web application
├── mobile/          # React Native mobile app
├── shared/          # Shared types and utilities
├── ai/              # AI processing and ML models
└── database/        # Database schemas and migrations
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the ISC License.
