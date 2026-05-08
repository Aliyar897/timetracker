# tracker/serializers.py
from rest_framework import serializers
from .models import TimeEntry


class TimeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model  = TimeEntry
        fields = ['id', 'date', 'check_in', 'check_out', 'hours', 'note']