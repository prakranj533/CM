from django.apps import apps
from django.db import models
from helpers.models import TrackingModel
from django.core.validators import RegexValidator
from django.contrib.auth.hashers import make_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.contrib.auth.models import (AbstractBaseUser, PermissionsMixin, UserManager)
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from django.conf import settings
from datetime import datetime, timedelta
import jwt


class MyUserManager(UserManager):
  def _create_user(self, username, first_name, last_name, email, password, **extra_fields):
    """
    Create and save a user with the given username, email, and password.
    """
    if not username:
      raise ValueError('The given username must be set')
    if not email:
      raise ValueError('The given email must be set')
    if not first_name:
      raise ValueError('First name is required')
    if not last_name:
      raise ValueError('Last name is required')
    email = self.normalize_email(email)
    # Lookup the real model class from the global app registry so this
    # manager method can be used in migrations. This is fine because
    # managers are by definition working on the real model.
    GlobalUserModel = apps.get_model(self.model._meta.app_label, self.model._meta.object_name)
    username = GlobalUserModel.normalize_username(username)
    user = self.model(username=username, email=email, **extra_fields)
    user.password = make_password(password)
    user.save(using=self._db)
    return user

  def create_user(self, username, first_name, last_name, email, password=None, **extra_fields):
    extra_fields.setdefault('is_staff', False)
    extra_fields.setdefault('is_superuser', False)
    return self._create_user(username, first_name, last_name, email, password, **extra_fields)

  def create_superuser(self, username, first_name, last_name, email, password=None, **extra_fields):
    extra_fields.setdefault('is_staff', True)
    extra_fields.setdefault('is_superuser', True)

    if extra_fields.get('is_staff') is not True:
      raise ValueError('Superuser must have is_staff=True.')
    if extra_fields.get('is_superuser') is not True:
      raise ValueError('Superuser must have is_superuser=True.')

    return self._create_user(username, first_name, last_name, email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin, TrackingModel):
  """
  An abstract base class implementing a fully featured User model with
  admin-compliant permissions.

  Username and password are required. Other fields are optional.
  """
  username_validator = UnicodeUsernameValidator()
  letters_validator = RegexValidator(r'^[a-zA-Z]*$', 'Only letters are allowed.')

  username = models.CharField(
    _('username'),
    max_length=150,
    unique=True,
    help_text=_('Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.'),
    validators=[username_validator],
    error_messages={
      'unique': _("A user with that username already exists."),
    },
  )
  first_name = models.CharField(
    _('first_name'),
    max_length=150,
    help_text=_('Required. 150 characters or fewer. Letters only.'),
    validators=[letters_validator],
  )
  last_name = models.CharField(
    _('last_name'),
    max_length=150,
    help_text=_('Required. 150 characters or fewer. Letters only.'),
    validators=[letters_validator],
  )
  email = models.EmailField(_('email address'), blank=False, unique=True)
  is_staff = models.BooleanField(
    _('staff status'),
    default=False,
    help_text=_('Designates whether the user can log into this admin site.'),
  )
  is_active = models.BooleanField(
    _('active'),
    default=True,
    help_text=_(
      'Designates whether this user should be treated as active. '
      'Unselect this instead of deleting accounts.'
    ),
  )
  date_joined = models.DateTimeField(_('date joined'), default=timezone.now)
  email_verified = models.BooleanField(
    _('email_verified'),
    default=False,
    help_text=_(
      'Designates whether this user email is verified. '
    ),
  )

  objects = MyUserManager()

  EMAIL_FIELD = 'email'
  USERNAME_FIELD = 'email'
  REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

  @property
  def token(self):
    token = jwt.encode(
      {
        'username': self.username,
        'email': self.email,
        'exp': datetime.utcnow() + timedelta(hours=24)
      },
      settings.SECRET_KEY,
      algorithm='HS256'
    )

    return token