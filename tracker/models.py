# tracker/models.py
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2)

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance, hourly_rate=0)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()

class TimeEntry(models.Model):
   
    id = models.CharField(primary_key=True, max_length=50)
    
    user = models.ForeignKey(
            User,
            on_delete=models.CASCADE,
            related_name='entries',
            null=True, blank=True
        )

    date      = models.DateField()
    check_in  = models.TimeField()
    check_out = models.TimeField()
    hours     = models.DecimalField(max_digits=5, decimal_places=2)
    note      = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-check_in']
        indexes  = [models.Index(fields=['date'])]

    def __str__(self):
        return f"{self.date} | {self.check_in}–{self.check_out} ({self.hours}h)"