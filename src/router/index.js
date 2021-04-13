import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from "../views/Home";
import CareerPathFinder from "../views/CareerPathFinder";
import PageNotFound from "../views/PageNotFound";
import ManageNodes from "../views/ManageNodes";

Vue.use(VueRouter)

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes: [
        {
            path: "/",
            redirect: "/home",
        },
        {
            path: "/home",
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
            path: "*",
            component: PageNotFound
        }
    ]
})

export default router
