<template>
  <v-sheet
    width="650"
    height="90vh"
    class="pa-4 mx-auto d-flex flex-column justify-center"
  >
    <div class="text-h5 mb-3">Sign Up</div>
    <v-form
      ref="form"
      lazy-validation
    >
      <v-row>
        <v-col
          cols="12"
          sm="6"
          md="6"
          class="pb-0"
        >
          <v-text-field
            v-model="firstName"
            required
            label="First Name"
            outlined
            dense
          />
        </v-col>
        <v-col
          cols="12"
          sm="6"
          md="6"
          class="pb-0"
        >
          <v-text-field
            v-model="lastName"
            required
            label="Surname"
            outlined
            dense
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col
          cols="12"
          class="py-0"
        >
          <v-text-field
            v-model="email"
            :rules="emailRules"
            label="Email"
            outlined
            dense
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col
          cols="12"
          sm="6"
          md="6"
          class="py-0"
        >
          <v-text-field
            v-model="password"
            :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :rules="passwordRules"
            :type="showPassword ? 'text' : 'password'"
            label="Password"
            @click:append="showPassword = !showPassword"
            outlined
            dense
          />
        </v-col>
        <v-col
          cols="12"
          sm="6"
          md="6"
          class="py-0"
        >
          <v-text-field
            v-model="confirmPassword"
            :append-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :rules="passwordRules"
            :type="showConfirmPassword ? 'text' : 'password'"
            label="Confirm Password"
            @click:append="showConfirmPassword = !showConfirmPassword"
            outlined
            dense
          />
        </v-col>
      </v-row>
      <v-radio-group
        v-model="gender"
        row
      >
        <template v-slot:label>
          <div class="text-subtitle-1">Gender</div>
        </template>
        <v-radio
          v-for="n in ['male', 'female', 'others']"
          :key="n"
          :label="titleize(n)"
          :value="n"
        />
      </v-radio-group>
      <v-menu
        ref="dob"
        v-model="dateOfBirth"
        :close-on-content-click="false"
        transition="scale-transition"
        offset-y
        min-width="auto"
      >
        <template v-slot:activator="{ on, attrs }">
          <v-text-field
            v-model="date"
            label="Date of Birth"
            readonly
            v-bind="attrs"
            v-on="on"
            outlined
            dense
          ></v-text-field>
        </template>
        <v-date-picker
          v-model="date"
          :active-picker.sync="activePicker"
          :max="(new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000)).toISOString().substr(0, 10)"
          min="1900-01-01"
          @change="saveDoB"
        ></v-date-picker>
      </v-menu>
      <v-btn
        class="float-right"
        color="primary"
        @click="handleSignUp"
        depressed
      >
        Sign Up
      </v-btn>
    </v-form>
    <div class="mt-3">
      Already registered? <router-link to="/login">Log In</router-link> to continue
    </div>
  </v-sheet>
</template>

<script>
export default {
  name: "SignUp",
  data: () => ({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    dateOfBirth: "",
    activePicker: null,
    date: null,
    showPassword: false,
    showConfirmPassword: false,
    emailRules: [
      v => !!v || 'Email is required',
      v => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) || 'Email must be valid',
    ],
    passwordRules: [
      v => !!v || 'Password is required'
    ]
  }),
  watch: {
    dateOfBirth(val) {
      val && setTimeout(() => (this.activePicker = 'YEAR'))
    },
  },
  methods: {
    handleSignUp() {
      console.log("clicked signup");
    },
    titleize(v) {
      return v.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
    saveDoB(date) {
      this.$refs.dob.save(date);
    }
  }
}
</script>
