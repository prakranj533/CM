const mongoose = require('mongoose');
const { dobValidator, emailValidator } = require('../common/utils');

const userSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    minLength: 10,
    validate: {
      validator: emailValidator,
      message: props => `${props.value} is not a valid email address`
    }
  },
  password: {
    type: String,
    required: true
  },
  dob: {
    type: String,
    validate: {
      validator: dobValidator,
      message: props => `${props.value} is not a valid Date of Birth string`
    }
  },
  gender: {
    type: String,
    validate: {
      validator: v => ['male', 'female', 'others'].includes(v),
      message: props => `${props.value} is not a valid gender`
    }
  },
  createdAt: {
    type: Date,
    immutable: true,
    default: () => Date.now()
  },
  updatedAt: {
    type: Date,
    default: () => Date.now()
  }
});

userSchema.methods.display = function() {
  console.log(`${this}`);
}

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

userSchema.post('save', function(doc, next) {
  console.log('Updated user record');
  doc.display();
  next();
});

module.exports = mongoose.model('User', userSchema)