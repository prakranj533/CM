import Vue from "vue";
import VueRouter from "vue-router";
import jwt from "jsonwebtoken";
import Home from "../views/Home";
import CareerPathFinder from "../views/CareerPathFinder.vue";
import PageNotFound from "../views/PageNotFound";
import AdminPageNotFound from "../views/admin/PageNotFound";
import ManageNodes from "../views/ManageNodes";
import StudentIndex from '../views/admin/students/Index';
import StudentList from '../views/admin/students/List';
import StudentAdd from '../views/admin/students/Add';
import DeviceIndex from '../views/admin/devices/Index';
import DeviceList from '../views/admin/devices/List';
import DeviceAdd from '../views/admin/devices/Add';
import SchoolIndex from '../views/admin/schools/Index';
import SchoolList from '../views/admin/schools/List';
import SchoolAdd from '../views/admin/schools/Add';
import SchoolCoupans from '../views/admin/schools/Coupans';
import SchoolDevices from '../views/admin/schools/Devices';
import CounsellorIndex from '../views/admin/counsellors/Index';
import CounsellorList from '../views/admin/counsellors/List';
import CounsellorAdd from '../views/admin/counsellors/Add';
import CounsellorAllocate from '../views/admin/counsellors/Allocate';
import QueryIndex from '../views/admin/queries/Index';
import QueryList from '../views/admin/queries/List';
import QueryReply from '../views/admin/queries/Reply';
import ChangePassword from '../views/admin/ChangePassword';
import ContactUsContent from '../views/admin/ContactUsContent';
import SetVideo from '../views/admin/videos/Set';
import HomeV1 from "../views/Home-v1";
import Rank from "../views/Rank.vue";
import PrivacyPolicy from "../views/PrivacyPolicy.vue";
import TermCondition from "../views/TermCondition";
Vue.use(VueRouter);

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: "/",
      component: Home
    },
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
      path: "/admin-login",
      name: "AdminLogin",
      component: () => import(/* webpackChunkName: "AdminLogin" */ '@/views/AdminLogin.vue')
    },
    {
      path: "/career-path-finder",
      component: CareerPathFinder,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: "/rank",
      component: Rank,
    },
    {
      path: "/admin",
      component: () => import(/* webpackChunkName: "AdminHome" */ '@/views/admin/Home.vue'),
      meta: {
        requiresAuth: true,
        is_admin: true
      },
      children: [
        {
          path: "dashboard",
          component: ManageNodes,
        },
        {
          path: "career-path-finder",
          component: CareerPathFinder,
        },
        {
          path: "rank",
          component: CareerPathFinder,
        },
        {
          path: "change-password",
          component: ChangePassword,
        }, {
          path: "contact-us",
          component: ContactUsContent,
        }, {
          path: "set-video",
          component: SetVideo,
        },
        {
          path: "student",
          component: StudentIndex,
          children: [
            {
              path: "list",
              component: StudentList,
            },
            {
              path: "add/:id?",
              name: "student-add",
              component: StudentAdd,
              props: true
            }
          ]
        },
        {
          path: "school",
          component: SchoolIndex,
          children: [
            {
              path: "list",
              component: SchoolList,
            },
            {
              path: "add/:id?",
              name: "school-add",
              component: SchoolAdd,
              props: true
            },
            {
              path: "coupans/:id?",
              name: "school-coupans",
              component: SchoolCoupans,
              props: true
            },
            {
              path: "devices/:id?",
              name: "school-devices",
              component: SchoolDevices,
              props: true
            }
          ]
        },
        {
          path: "device",
          component: DeviceIndex,
          children: [
            {
              path: "list",
              component: DeviceList,
            },
            {
              path: "add/:id?",
              name: "device-add",
              component: DeviceAdd,
              props: true
            }
          ]
        },
        {
          path: "counsellor",
          component: CounsellorIndex,
          children: [
            {
              path: "list",
              component: CounsellorList,
            }, {
              path: "add/:id?",
              name: "counsellor-add",
              component: CounsellorAdd,
              props: true
            }, {
              path: "allocate/:id",
              name: "counsellor-allocate",
              component: CounsellorAllocate,
              props: true
            }
          ]
        },
        {
          path: "query",
          component: QueryIndex,
          children: [
            {
              path: "list",
              component: QueryList,
            },
            {
              path: "reply/:id",
              name: "query-reply",
              component: QueryReply,
              props: true
            }
          ]
        },
        {
          path: "*",
          name: "PageNotFound",
          component: AdminPageNotFound
        }
      ]
    },
    // {
    //   path: "/manage-nodes",
    //   component: ManageNodes,
    //   meta: {
    //     requiresAuth: true
    //   }
    // },
    {
      path: "/home-v1",
      component: HomeV1
    },
    {
      path: "/privacy-policy",
      component: PrivacyPolicy
    },
    {
      path: "/terms-conditions",
      component: TermCondition
    },
    {
      path: "*",
      name: "PageNotFound",
      component: PageNotFound
    }
  ]
});

router.beforeEach((to, from, next) => {

  function checkAccessToken(accessToken, loginPath) {
    try {
      const { exp } = jwt.decode(accessToken);
      if (exp > (Date.now() / 1000)) {
        next();
      } else {
        next({ path: loginPath });
      }
    } catch (e) {
      localStorage.removeItem('access-token');
      localStorage.removeItem('refresh-token');
      next({ path: loginPath });
    }
  }

  if (to.matched.some(record => record.meta.requiresAuth && record.meta.is_admin)) {
    const accessToken = localStorage.getItem('access-token');
    if (!accessToken) next({ path: '/admin-login' });
    checkAccessToken(accessToken, '/admin-login');
  } else if (to.matched.some(record => record.meta.requiresAuth)) {
    let urlParams = new URLSearchParams(window.location.search);
    let accessToken = urlParams.get("token") || localStorage.getItem('access-token');
    if (accessToken) {
      localStorage.setItem("access-token", accessToken);
    } else {
      next({ path: '/login' });
    }
    checkAccessToken(accessToken, '/login');
  } else {
    if (to.name == 'Login') {
      const accessToken = localStorage.getItem('access-token');
      if (accessToken) next({ path: '/' });
      else next();
    } else {
      next();
    }
  }
});

export default router;
