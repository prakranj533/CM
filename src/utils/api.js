import axios from "axios";

const API_URL = process.env.VUE_APP_SERVER;

const api = axios.create({
  baseURL: API_URL
});

api.defaults.headers.common['Authorization'] = "Bearer " + localStorage.getItem('token');

export default api;