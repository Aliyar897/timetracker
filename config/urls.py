# config/urls.py
from django.urls import path
from tracker import views
from django.contrib import admin

urlpatterns = [
    
    path('admin/', admin.site.urls),
    
    path('',                     views.index, name='index'),
    # path('api/entries/',         views.entries),
    path('api/entries/bulk/',    views.bulk_sync),
    path('api/summary/',         views.summary),
    path('api/entries/', views.get_entries),
    
    # Auth
    path('login/', views.login_view, name='login'),
    path('signup/', views.signup_view, name='signup'),
    path('logout/', views.logout_view, name='logout'),

    ## API for CRUD on an entry
    path('api/entries/<str:entry_id>/', views.delete_entry),


]