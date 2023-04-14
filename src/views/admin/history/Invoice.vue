<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Invoice</div>
    <div>
      <div>Student Name: {{ invoiceData.user_name }}</div>
      <div>Phone Number: {{ invoiceData.phone_no }}</div>
      <div>School Name: {{ invoiceData.school }}</div>
      <div>Plan: {{ (invoiceData.data || {}).plan_name }}</div>
      <div v-if="invoiceData.data && invoiceData.data.plan_name">
        <div>Amount: {{ invoiceData.plan_amount }}</div>
        <div>
          Suscription Start:
          {{ invoiceData.data.subscription_start && formatDate(invoiceData.data.subscription_start) }}
        </div>
        <div>
          Suscription End: {{ invoiceData.data.subscription_end && formatDate(invoiceData.data.subscription_end) }}
        </div>
      </div>
    </div>
  </div>
</template>
    
<script>
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import { adminApi } from "../../../utils/api";
import moment from "moment";
// import User from '../../../server/models/User';
export default {
  name: "Students-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  props: ["id"],
  data: () => ({
    invoiceData: {},
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {},
  async mounted() {
    console.log(this.id);
    if (this.id) {
      const res = await adminApi.get(`/api/account/history/${this.id}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
      });
      if (res.data.success) {
        this.invoiceData = res.data.data[0];
      }
    }
  },
  methods: {
    titleize(v) {
      return v.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
    formatDate(date) {
      return moment(date).format("MM/DD/YYYY");
    },
  },
};
</script>
    
    <style>
.container {
  max-width: 100%;
}
.text-ws {
  white-space: nowrap;
}
</style>