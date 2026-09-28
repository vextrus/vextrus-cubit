"""The URLs: the API under /api/ and the admin under /admin/. The web app is served apart (ADR 0022)."""

from django.contrib import admin
from django.urls import path

from vextrus.api import api

urlpatterns = [
    path("api/", api.urls),
    path("admin/", admin.site.urls),
]
