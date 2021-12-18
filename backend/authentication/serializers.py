from rest_framework import serializers
from authentication.models import User


class RegisterSerializer(serializers.ModelSerializer):

  first_name = serializers.CharField(max_length=150, write_only=True)
  last_name = serializers.CharField(max_length=150, write_only=True)
  password = serializers.CharField(max_length=128, min_length=6, write_only=True)

  class Meta:
    model = User
    fields = ('username', 'email', 'password', 'first_name', 'last_name')

  def create(self, validated_data):
    return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.ModelSerializer):

  password = serializers.CharField(max_length=128, min_length=6, write_only=True)

  class Meta:
    model = User
    fields = ('email', 'username', 'password', 'token')

    read_only_fields = ['token']
