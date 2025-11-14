"""
URLs de l'API
"""
from django.urls import path
from . import views

urlpatterns = [
    path('query', views.query_data, name='query_data'),
    path('indicators', views.list_indicators, name='list_indicators'),
    path('indicator/<str:code>', views.indicator_detail, name='indicator_detail'),
    path('health', views.health_check, name='health_check'),
]
