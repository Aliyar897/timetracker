# tracker/admin.py
from django.contrib import admin
from .models import Profile, TimeEntry

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'hourly_rate')
    search_fields = ('user__username',)


@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'date',
        'check_in',
        'check_out',
        'hours',
        'created_at',
    )

    list_filter = ('date', 'user')
    search_fields = ('note', 'user__username')
    ordering = ('-date', '-check_in')