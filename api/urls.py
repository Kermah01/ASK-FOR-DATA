"""
URLs de l'API
"""
from django.urls import path
from . import views

urlpatterns = [
    path('query', views.query_data, name='query_data'),
    path('suggest', views.suggest_indicators, name='suggest_indicators'),
    path('indicators', views.list_indicators, name='list_indicators'),
    path('indicator/<str:code>', views.indicator_detail, name='indicator_detail'),
    path('dashboard-data', views.dashboard_data, name='dashboard_data'),
    path('health', views.health_check, name='health_check'),
    path('feedback', views.submit_feedback, name='submit_feedback'),
    path('save-api-key', views.save_api_key, name='save_api_key'),
    path('delete-api-key', views.delete_api_key, name='delete_api_key'),
    path('user-status', views.user_status, name='user_status'),
]
