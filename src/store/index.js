import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    user: null,
    students: [],
    counsellors: [],
    queries: [],
    schools: [],
    devices: [],
    policies: [],
    plans: [],
  },
  mutations: {
    updateUser: (state, payload) => {
      state.user = payload;
    },
    addStudent: (state, payload) => {
      state.students.push(payload);
    },
    updateStudent: (state, payload) => {
      const existsAtIndex = state.students.findIndex(u => u._id === payload._id)

      if (existsAtIndex !== -1) {
        state.students[existsAtIndex] = payload;
      } else {
        state.students.push(payload);
      }
    },
    setStudents: (state, payload) => {
      state.students = payload;
    },
    addCounsellor: (state, payload) => {
      state.counsellors.push(payload);
    },
    updateCounsellor: (state, payload) => {
      const existsAtIndex = state.counsellors.findIndex(u => u._id === payload._id)

      if (existsAtIndex !== -1) {
        state.counsellors[existsAtIndex] = payload;
      } else {
        state.counsellors.push(payload);
      }
    },
    setCounsellors: (state, payload) => {
      state.counsellors = payload;
    },
    setQueries: (state, payload) => {
      state.queries = payload;
    },
    setSchools: (state, payload) => {
      state.schools = payload;
    },
    setDevices: (state, payload) => {
      state.devices = payload;
    },
    setPolicies: (state, payload) => {
      state.policies = payload;
    },
    setPlans: (state, payload) => {
      state.plans = payload;
    },
  },
  actions: {
    updateAuthState: (context, payload) => {
      context.commit('updateUser', payload);
    },
    addStudent: (context, payload) => {
      context.commit('addStudent', payload);
    },
    updateStudent: (context, payload) => {
      context.commit('updateStudent', payload);
    },
    setStudents: (context, payload) => {
      context.commit('setStudents', payload);
    },
    setSchools: (context, payload) => {
      context.commit('setSchools', payload);
    },
    addCounsellor: (context, payload) => {
      context.commit('addCounsellor', payload);
    },
    updateCounsellor: (context, payload) => {
      context.commit('updateCounsellor', payload);
    },
    setCounsellors: (context, payload) => {
      context.commit('setCounsellors', payload);
    },
    setQueries: (context, payload) => {
      context.commit('setQueries', payload);
    },
    setDevices: (context, payload) => {
      context.commit('setDevices', payload);
    },
    setPolicies: (context, payload) => {
      context.commit('setPolicies', payload);
    },
    setPlans: (context, payload) => {
      context.commit('setPlans', payload);
    },
  },
  modules: {
  }
});
