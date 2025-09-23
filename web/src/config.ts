interface Config {
  API_URL: string;
  WS_URL: string;
}

export const config: Config = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
};
