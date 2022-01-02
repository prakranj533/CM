import Vue from "vue";
import VueRouter from "vue-router";
import Home from "../views/Home";
import CareerPathFinder from "../views/CareerPathFinder";
import PageNotFound from "../views/PageNotFound";
import ManageNodes from "../views/ManageNodes";
import HomeV1 from "../views/Home-v1";
import Login from "../views/Login";
import SignUp from "../views/SignUp";

Vue.use(VueRouter);

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: "/login",
      component: Login
    },
    {
      path: "/sign-up",
      component: SignUp
    },
    {
      path: "/",
      component: Home,
    },
    {
      path: "/career-path-finder",
      component: CareerPathFinder,
    },
    {
      path: "/manage-nodes",
      component: ManageNodes,
    },
    {
      path: "/home-v1",
      component: HomeV1
    },
    {
      path: "*",
      component: PageNotFound
    }
  ]
})

export default router;
