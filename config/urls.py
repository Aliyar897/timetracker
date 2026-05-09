# config/urls.py
from django.urls import path
from tracker import views

urlpatterns = [
    path('',                     views.index, name='index'),
    path('api/entries/',         views.entries),
    path('api/entries/bulk/',    views.bulk_sync),
    path('api/summary/',         views.summary),

    
    # Auth
    path('login/', views.login_view, name='login'),
    path('signup/', views.signup_view, name='signup'),
    path('logout/', views.logout_view, name='logout')

]