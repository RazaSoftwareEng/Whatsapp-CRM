from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CompanyViewSet,
    InviteInfoView,
    InviteSetPasswordView,
    ProposalViewSet,
    ReviewActionView,
    ReviewInfoView,
)

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="company")
router.register("proposals", ProposalViewSet, basename="proposal")

urlpatterns = [
    path("invites/<str:token>/", InviteInfoView.as_view(), name="invite-info"),
    path("invites/<str:token>/set-password/", InviteSetPasswordView.as_view(), name="invite-set-password"),
    path("review/<str:token>/", ReviewInfoView.as_view(), name="review-info"),
    path("review/<str:token>/<str:action>/", ReviewActionView.as_view(), name="review-action"),
] + router.urls
