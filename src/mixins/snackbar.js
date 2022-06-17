export default {
  methods: {
    callSuccess(message) {
      this.snackbar.status = "success";
      this.snackbar.message = message;
      this.snackbar.show = true;
    },
    callError(message, isHtml) {
      this.snackbar.status = "error";
      this.snackbar.message = message;
      this.snackbar.isHtml = isHtml || false;
      this.snackbar.show = true;
    }
  }
}