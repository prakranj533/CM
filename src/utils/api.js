import axios from "axios";
const appApi = axios.create({ baseURL: process.env.VUE_APP_SERVER });
const authApi = axios.create({ baseURL: process.env.VUE_APP_AUTH_SERVER });
const adminApi = axios.create({ baseURL: process.env.VUE_APP_API_SERVER });
const adminApiAuth = axios.create({ baseURL: process.env.VUE_APP_API_AUTH_SERVER + '/auth' });
appApi.defaults.headers.common['Authorization'] = "Bearer " + localStorage.getItem('access-token');
adminApi.defaults.headers.common['Authorization'] = "Bearer " + localStorage.getItem('access-token');

export {
  appApi,
  authApi,
  adminApi,
  adminApiAuth
};