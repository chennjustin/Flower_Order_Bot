import axios from 'axios'

/** Public base URL used by nginx or browser to reach FastAPI */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE,
})
