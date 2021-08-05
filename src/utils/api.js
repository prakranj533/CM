import axios from 'axios';

const API_URL = process.env.VUE_APP_SERVER;
console.log('MODE', process.env)
console.log('SERVER URL', process.env.VUE_APP_SERVER)
console.log('API_URL', API_URL);
const api = axios.create({
  baseURL: API_URL,
});

export default api;