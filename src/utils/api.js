import axios from "axios";

const API_URL = process.env.VUE_APP_SERVER;
axios.defaults.headers.common['Authorization'] = "Bearer " + localStorage.getItem('token');

const api = axios.create({
  baseURL: API_URL
});

export default api;