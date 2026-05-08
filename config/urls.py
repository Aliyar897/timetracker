# config/urls.py
from django.urls import path
from tracker import views

urlpatterns = [
    path('',                     views.index),
    path('api/entries/',         views.entries),
    path('api/entries/bulk/',    views.bulk_sync),
    path('api/summary/',         views.summary),
]