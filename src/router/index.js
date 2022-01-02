import Vue from "vue";
import VueRouter from "vue-router";
import jwt from "jsonwebtoken";
import Home from "../views/Home";
import CareerPathFinder from "../views/CareerPathFinder";
import PageNotFound from "../views/PageNotFound";
import ManageNodes from "../views/ManageNodes";
import HomeV1 from "../views/Home-v1";

Vue.use(VueRouter);

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: "/login",
      name: "Login",
      component: () => import(/* webpackChunkName: "Login" */ '@/views/Login.vue')
    },
    {
      path: "/sign-up",
      name: "SignUp",
      component: () => import(/* webpackChunkName: "SignUp" */ '@/views/SignUp.vue')
    },
    {
      path: "/",
      component: Home,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/career-path-finder",
      component: CareerPathFinder,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/manage-nodes",
      component: ManageNodes,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/home-v1",
      component: HomeV1
    },
    {
      path: "*",
      name: "PageNotFound",
      component: PageNotFound
    }
  ]
});

router.beforeEach((to, from, next) => {
  if(to.matched.some(record => record.meta.requiresAuth)) {
    const accessToken = localStorage.getItem('access-token');
    if(!accessToken) next({ path: '/login' });

    try {
      const { exp } = jwt.decode(accessToken);
      if(exp > (Date.now() / 1000)) {
        next();
      } else {
        next({ path: '/login' });
      }
    } catch(e) {
      localStorage.removeItem('access-token');
      localStorage.removeItem('refresh-token');
      next({ path: '/login' });
    }
  } else {
    if(to.name == 'Login') {
      const accessToken = localStorage.getItem('access-token');
      if(accessToken) next({ path: '/' });
      else next();
    } else {
      next();
    }
  }
});

export default router;
