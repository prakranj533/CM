import axios from "axios";

const appApi = axios.create({ baseURL: process.env.VUE_APP_SERVER });
const authApi = axios.create({ baseURL: process.env.VUE_APP_AUTH_SERVER });

appApi.defaults.headers.common['Authorization'] = "Bearer " + localStorage.getItem('access-token');

export {
  appApi,
  authApi
};