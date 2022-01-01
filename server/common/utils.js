const dobValidator = v => {
  const dob = v.split('-');

  if(dob.length !== 3) return false;
  if(
    dob[0].length !== 4
    || isNaN(dob[0])
    || parseInt(dob[0]) < 1900
  ) {
    return false; // year validation
  }
  if(
    dob[1].length !== 2
    || isNaN(dob[1])
    || parseInt(dob[1]) < 1
    || parseInt(dob[1]) > 12
  ) {
    return false; // month validation
  }
  if(
    dob[2].length !== 2
    || isNaN(dob[2])
    || parseInt(dob[2]) < 1
    || parseInt(dob[2]) > 31  // this is just basic validation but not every month has 31st so need to improve this
  ) {
    return false; // date validation
  }

  return true;
}

const emailValidator = v => {
  const regex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return regex.test(v);
}

module.exports = {
  dobValidator,
  emailValidator
}