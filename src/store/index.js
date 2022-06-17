import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    user: null,
    students: [],
    counsellors: [],
    queries: [],
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
  },
  modules: {
  }
});
