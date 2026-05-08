# tracker/models.py
import uuid
from django.db import models


class TimeEntry(models.Model):
   
    id = models.CharField(primary_key=True, max_length=50)
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