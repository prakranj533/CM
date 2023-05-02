<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="print-button"><button type="button" class="v-btn v-btn--has-bg theme--light v-size--default primary" onclick="window.print()">Print</button></div>
    <div class="text-h5 text-center">Invoice</div>
    <header>
      <img src="./../../../assets/app_logo.png" alt="Anvil" />
    </header>
    <section class="container">
      <div class="row my-5">
        <div class="col-sm-6 w-50">
          <h5 class="mb-1">{{ invoiceData.user_name }}</h5>
          <p>
            Invoice Date:
            <strong>
              {{ (invoiceData.data||{}).subscription_start && formatDate(invoiceData.data.subscription_start) }}
            </strong>
          </p>
          <p>
            Invoice No:
            <strong>12345</strong>
          </p>
        </div>
        <div class="col-sm-6 text-right w-50">
          <p></p>
          <p v-if="invoiceData.school">
            School Name:
            <strong>{{ invoiceData.school }}</strong>
          </p>
          <p>
            Phone Number:
            <strong>{{ invoiceData.phone_no }}</strong>
          </p>
          <p v-if="invoiceData.email">
            Email:
            <strong>{{ invoiceData.email }}</strong>
          </p>
        </div>
      </div>
      <div class="row mb-5">
        <table class="table">
          <thead>
            <tr>
              <th>Qty</th>
              <th>Description</th>
              <th>Price</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Plan: {{ (invoiceData.data || {}).plan_name }}</td>
              <td>{{ invoiceData.plan_amount }} INR</td>
              <td>
                <strong>{{ invoiceData.plan_amount }} INR</strong>
              </td>
            </tr>
            <tr><td></td></tr>
            <tr><td></td></tr>
            <tr><td></td></tr>
          </tbody>
        </table>
      </div>
      <div class="row mb-5">
        <table class="table total-list">
          <thead>
            <tr>
              <th></th>
              <th>Subscription End</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>&nbsp;</td>
              <td>
                <h5>{{ (invoiceData.data||{}).subscription_end && formatDate(invoiceData.data.subscription_end) }}</h5>
              </td>
              <td>
                <h5 class="text-pink">{{ invoiceData.plan_amount }} INR</h5>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- <div class="row">
                <p class="text-thank-you"><img src="./assets/images/heart.png" alt="Thank you">&nbsp;<span>Thank you!</span></p>
            </div> -->
    </section>
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
.container {
  width: 100%;
  padding-right: 15px;
  padding-left: 15px;
  margin-right: auto;
  margin-left: auto;
}
.row {
  display: -ms-flexbox;
  display: flex;
  -ms-flex-wrap: wrap;
  flex-wrap: wrap;
  margin-right: -15px;
  margin-left: -15px;
}
.col-6 {
  position: relative;
  width: 100%;
  padding-right: 15px;
  padding-left: 15px;
}
.print-button{text-align: right;}
@media (min-width: 576px) {
  .col-sm-6 {
    -ms-flex: 0 0 50%;
    flex: 0 0 50%;
    max-width: 50%;
  }
}
@media print{
.print-button{display: none;}
}
.mb-5,
.my-5 {
  margin-bottom: 3rem !important;
}

.mt-5,
.my-5 {
  margin-top: 3rem !important;
}
.text-right {
  text-align: right !important;
}
h5 {
  font-size: 1.5rem;
  font-weight: 500;
}
th {
  text-transform: uppercase;
  color: #9b9c9d;
}
.table {
  width: 100%;
  margin-bottom: 1rem;
}

table {
  border-collapse: collapse;
}
.table thead th {
  vertical-align: bottom;
  border-bottom: 3px solid #dee2e6;
}
.table td,
.table th {
  padding: 0.75rem;
  vertical-align: top;
}
th {
  text-align: inherit;
  text-align: -webkit-match-parent;
}
th:nth-child(3),
th:nth-child(4),
tr td:nth-child(3),
tr td:nth-child(4) {
  text-align: end;
}
.total-list tr td {
  border-bottom: 3px solid #dee2e6;
}
.text-pink {
  color: #fb7578;
  font-weight: 600;
}
.text-thank-you {
  display: inline-flex;
  align-items: center;
}
.text-thank-you span {
  font-size: 1.8rem;
}
.w-50 {
  width: 50%;
}
header img{width: 250px;
    margin-left: -15px;
    margin-top: -20px;
    margin-bottom: -30px;}
</style>