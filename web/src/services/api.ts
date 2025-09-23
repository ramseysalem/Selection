import axios from 'axios';
import { config } from '../config';

export const api = axios.create({
  baseURL: config.API_URL,
  withCredentials: true,
});

// Example of WebSocket setup
export const createWebSocket = () => {
  return new WebSocket(config.WS_URL);
};
